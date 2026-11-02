using System.IO;
using System.Linq;
using TMPro;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace ARPortfolio
{
    // Adds an "AR Portfolio" menu to Unity's top menu bar:
    //   Build Everything  - builds the info board on your card, the Home screen, and the phone settings
    //   Add Avatar        - puts a Mixamo character (select its .fbx first) on your card, waving at the camera
    public static class ARPortfolioBuilder
    {
        const string ContentRootName = "Portfolio Content";
        const string AvatarName = "Avatar";
        const string PlaceholderName = "Initials";
        const string GeneratedFolder = "Assets/ARPortfolio/Generated";
        const string ScenesFolder = "Assets/Scenes";
        const string HomeScenePath = "Assets/Scenes/Home.unity";
        const string DefaultARScenePath = "Assets/Scenes/AR.unity";

        // Canvas layout, in canvas pixels.
        const float CanvasW = 1200f;
        const float CanvasH = 760f;
        const float CanvasWidthInCards = 1.5f;   // board is 1.5x as wide as the card
        const float BoardLiftInCards = 0.62f;    // gap between card and the bottom of the board
        const float AvatarHeightInCards = 0.6f;  // avatar height relative to card width

        static readonly Color BgColor = new Color32(15, 18, 34, 238);
        static readonly Color PanelColor = new Color32(24, 29, 52, 255);
        static readonly Color ButtonColor = new Color32(30, 36, 64, 255);
        static readonly Color AccentColor = new Color32(108, 140, 255, 255);
        static readonly Color TitleColor = new Color32(242, 244, 255, 255);
        static readonly Color BodyColor = new Color32(201, 206, 230, 255);

        // ------------------------------------------------------------------
        // Menu: Build Everything
        // ------------------------------------------------------------------
        [MenuItem("AR Portfolio/Build Everything", false, 1)]
        public static void BuildEverything()
        {
            if (!EnsureTextMeshPro())
            {
                return;
            }

            Component imageTarget = FindImageTarget();
            if (imageTarget == null)
            {
                EditorUtility.DisplayDialog("No Image Target found",
                    "Open the scene with your Vuforia AR Camera and Image Target first.\n\n" +
                    "No Image Target yet? Add one with GameObject > Vuforia Engine > Image Target, " +
                    "set Type to 'From Database' and pick your card. Then run Build Everything again.",
                    "OK");
                return;
            }

            if (!HasTrackableSelected(imageTarget))
            {
                if (!EditorUtility.DisplayDialog("Image Target has no card selected",
                        "Your Image Target doesn't seem to have a card picked yet. Select it, set Type to " +
                        "'From Database' and choose your database and card.\n\nBuild anyway?",
                        "Build anyway", "Cancel"))
                {
                    return;
                }
            }

            Scene arScene = imageTarget.gameObject.scene;
            Vector2 card = GetCardSize(imageTarget);

            BuildBoard(imageTarget.transform, card);
            Camera arCamera = SetUpCameras();
            AssignEventCamera(imageTarget.transform, arCamera);
            EnsureEventSystem();

            EditorSceneManager.MarkSceneDirty(arScene);
            string arScenePath = SaveARScene(arScene);
            if (string.IsNullOrEmpty(arScenePath))
            {
                EditorUtility.DisplayDialog("Couldn't save the scene",
                    "The AR content was built, but the scene couldn't be saved, so the Home screen was skipped. " +
                    "Save the scene (Cmd+S) and run Build Everything again.", "OK");
                return;
            }

            BuildHomeScene(arScenePath);
            SetUpPlayerSettings();

            EditorUtility.DisplayDialog("AR portfolio built",
                "Done!\n\n" +
                "- Press Play and hold your card up to the webcam to test.\n" +
                "- To add a waving avatar: select your Mixamo .fbx in the Project window, then AR Portfolio > Add Avatar.\n" +
                "- To change the text: edit Assets/ARPortfolio/Editor/PortfolioContent.cs and run Build Everything again " +
                "(this rebuilds the board, so changes made by hand to it are replaced).",
                "Great");
        }

        // ------------------------------------------------------------------
        // Menu: Add Avatar
        // ------------------------------------------------------------------
        [MenuItem("AR Portfolio/Add Avatar (select a Mixamo .fbx first)", false, 2)]
        public static void AddAvatarFromSelection()
        {
            string path = Selection.activeObject != null ? AssetDatabase.GetAssetPath(Selection.activeObject) : null;
            ModelImporter importer = string.IsNullOrEmpty(path) ? null : AssetImporter.GetAtPath(path) as ModelImporter;
            if (importer == null)
            {
                EditorUtility.DisplayDialog("Select your avatar first",
                    "In the Project window, click your Mixamo character (.fbx file) so it's selected, " +
                    "then run AR Portfolio > Add Avatar again.", "OK");
                return;
            }

            Component imageTarget = FindImageTarget();
            if (imageTarget == null)
            {
                EditorUtility.DisplayDialog("No Image Target found",
                    "Open the scene with your Vuforia Image Target first, then try again.", "OK");
                return;
            }

            // 1. Humanoid rig + looping animation + unpacked textures.
            if (importer.animationType != ModelImporterAnimationType.Human)
            {
                importer.animationType = ModelImporterAnimationType.Human;
                importer.SaveAndReimport();
            }

            ExtractAvatarTextures(path, importer);

            ModelImporterClipAnimation[] clips = importer.clipAnimations;
            if (clips == null || clips.Length == 0)
            {
                clips = importer.defaultClipAnimations;
            }

            if (clips != null && clips.Length > 0)
            {
                bool changed = false;
                foreach (ModelImporterClipAnimation c in clips)
                {
                    if (!c.loopTime)
                    {
                        c.loopTime = true;
                        changed = true;
                    }
                }

                if (changed)
                {
                    importer.clipAnimations = clips;
                    importer.SaveAndReimport();
                }
            }

            AnimationClip clip = AssetDatabase.LoadAllAssetsAtPath(path)
                .OfType<AnimationClip>()
                .FirstOrDefault(c => !c.name.StartsWith("__preview__"));

            GameObject model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (model == null)
            {
                EditorUtility.DisplayDialog("Couldn't load the model",
                    "Unity couldn't open that file as a 3D model. Try downloading it again from Mixamo as 'FBX for Unity'.",
                    "OK");
                return;
            }

            // 2. Replace the old avatar / placeholder.
            Transform target = imageTarget.transform;
            Transform oldAvatar = target.Find(AvatarName);
            if (oldAvatar != null)
            {
                Undo.DestroyObjectImmediate(oldAvatar.gameObject);
            }

            Transform placeholder = target.Find(ContentRootName + "/" + PlaceholderName);
            if (placeholder != null)
            {
                Undo.DestroyObjectImmediate(placeholder.gameObject);
            }

            // 3. Place it on the card, sized to fit.
            GameObject avatar = (GameObject)PrefabUtility.InstantiatePrefab(model, target);
            avatar.name = AvatarName;
            Undo.RegisterCreatedObjectUndo(avatar, "Add Avatar");
            avatar.transform.localPosition = Vector3.zero;
            avatar.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            avatar.transform.localScale = Vector3.one;

            Vector2 card = GetCardSize(imageTarget);
            Bounds bounds = GetWorldBounds(avatar);
            float parentScale = Mathf.Max(0.0001f, target.lossyScale.y);
            float localHeight = bounds.size.y / parentScale;
            float wantHeight = card.x * AvatarHeightInCards;
            float scale = localHeight > 0.0001f ? wantHeight / localHeight : wantHeight / 1.8f;
            avatar.transform.localScale = Vector3.one * scale;
            avatar.transform.localPosition = new Vector3(0f, 0f, -card.y * 0.1f);

            // 4. Animation + always face the phone.
            Animator animator = avatar.GetComponent<Animator>();
            if (animator == null)
            {
                animator = avatar.AddComponent<Animator>();
            }

            animator.applyRootMotion = false;
            if (clip != null)
            {
                EnsureFolder(GeneratedFolder);
                string controllerPath = GeneratedFolder + "/AvatarAnimator.controller";
                AssetDatabase.DeleteAsset(controllerPath);
                AnimatorController controller = AnimatorController.CreateAnimatorControllerAtPathWithClip(controllerPath, clip);
                animator.runtimeAnimatorController = controller;
            }

            if (avatar.GetComponent<FaceCamera>() == null)
            {
                avatar.AddComponent<FaceCamera>();
            }

            EditorSceneManager.MarkSceneDirty(target.gameObject.scene);
            EditorSceneManager.SaveScene(target.gameObject.scene);
            Selection.activeGameObject = avatar;

            EditorUtility.DisplayDialog("Avatar added",
                clip != null
                    ? "Your avatar is on the card and will wave at the camera. Press Play to test."
                    : "Your avatar is on the card. This file had no animation in it - download it from Mixamo " +
                      "with an animation (e.g. 'Waving') if you want it to move.",
                "Great");
        }

        // ------------------------------------------------------------------
        // Menu: Fix Avatar Textures
        // ------------------------------------------------------------------
        [MenuItem("AR Portfolio/Fix Avatar Textures (select the .fbx first)", false, 3)]
        public static void FixAvatarTexturesFromSelection()
        {
            string path = Selection.activeObject != null ? AssetDatabase.GetAssetPath(Selection.activeObject) : null;
            ModelImporter importer = string.IsNullOrEmpty(path) ? null : AssetImporter.GetAtPath(path) as ModelImporter;
            if (importer == null)
            {
                EditorUtility.DisplayDialog("Select your avatar first",
                    "In the Project window, click your Mixamo character (.fbx file) so it's selected, " +
                    "then run AR Portfolio > Fix Avatar Textures again.", "OK");
                return;
            }

            bool extracted = ExtractAvatarTextures(path, importer);
            EditorUtility.DisplayDialog(extracted ? "Textures fixed" : "No packed textures found",
                extracted
                    ? "The skin and clothes textures were unpacked next to the .fbx. Your avatar should now show its colours."
                    : "This file has no textures packed inside it. If the avatar is still white, download it again from " +
                      "Mixamo with Format 'FBX for Unity' and Skin 'With Skin'.",
                "OK");
        }

        // Unpacks the textures stored inside a Mixamo .fbx so the materials can use them.
        static bool ExtractAvatarTextures(string path, ModelImporter importer)
        {
            string folder = Path.GetDirectoryName(path).Replace('\\', '/') + "/" +
                            Path.GetFileNameWithoutExtension(path) + " Textures";
            EnsureFolder(folder);
            bool extracted = importer.ExtractTextures(folder);
            AssetDatabase.Refresh();
            importer.SaveAndReimport();
            return extracted;
        }

        // ------------------------------------------------------------------
        // The info board
        // ------------------------------------------------------------------
        static void BuildBoard(Transform target, Vector2 card)
        {
            Transform old = target.Find(ContentRootName);
            if (old != null)
            {
                Undo.DestroyObjectImmediate(old.gameObject);
            }

            var root = new GameObject(ContentRootName);
            Undo.RegisterCreatedObjectUndo(root, "Build AR Portfolio");
            root.transform.SetParent(target, false);
            root.AddComponent<PoseSmoother>(); // calms tracking jitter

            // Canvas standing behind the card, tilted back a little.
            var canvasGo = new GameObject("Info Board", typeof(RectTransform), typeof(Canvas),
                typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(root.transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            canvasGo.GetComponent<CanvasScaler>().dynamicPixelsPerUnit = 4f;

            var canvasRt = (RectTransform)canvasGo.transform;
            canvasRt.sizeDelta = new Vector2(CanvasW, CanvasH);
            float s = card.x * CanvasWidthInCards / CanvasW;
            canvasRt.localScale = Vector3.one * s;
            float boardHeight = CanvasH * s;
            canvasRt.localPosition = new Vector3(0f,
                card.x * BoardLiftInCards + boardHeight * 0.5f,
                card.y * 0.5f + card.x * 0.02f);
            canvasRt.localRotation = Quaternion.Euler(15f, 0f, 0f);

            // Background + header.
            RectTransform bg = NewRect("Background", canvasRt, 0f, 0f, CanvasW, CanvasH);
            AddImage(bg.gameObject, BgColor, true, 0.12f);
            AddText("Name", canvasRt, 40f, 26f, 1120f, 72f, PortfolioContent.Name, 56f, TitleColor,
                FontStyles.Bold, TextAlignmentOptions.TopLeft, true);
            AddText("Tagline", canvasRt, 40f, 100f, 1120f, 44f, PortfolioContent.Tagline, 28f, AccentColor,
                FontStyles.Normal, TextAlignmentOptions.TopLeft, true);
            RectTransform divider = NewRect("Divider", canvasRt, 40f, 158f, 1120f, 3f);
            AddImage(divider.gameObject, new Color(1f, 1f, 1f, 0.12f), false, 1f);

            // Menu buttons (left) + panels (right).
            PortfolioContent.Section[] sections = PortfolioContent.Sections;
            int n = sections.Length;
            const float top = 186f;
            const float areaH = CanvasH - top - 30f;
            const float gap = 14f;
            float buttonH = n > 0 ? Mathf.Min(90f, (areaH - gap * (n - 1)) / n) : 0f;

            var switcher = canvasGo.AddComponent<PanelSwitcher>();
            var links = canvasGo.AddComponent<OpenLinks>();
            var panels = new GameObject[n];
            var buttonImages = new Image[n];

            for (int i = 0; i < n; i++)
            {
                PortfolioContent.Section section = sections[i];

                Button button = AddButton("Button - " + section.Button, canvasRt,
                    40f, top + i * (buttonH + gap), 290f, buttonH, section.Button, 32f);
                buttonImages[i] = (Image)button.targetGraphic;
                UnityEventTools.AddIntPersistentListener(button.onClick, switcher.Show, i);

                RectTransform panel = NewRect("Panel - " + section.Button, canvasRt, 360f, top, 800f, areaH);
                AddImage(panel.gameObject, PanelColor, true, 0.25f);
                AddText("Title", panel, 32f, 24f, 736f, 60f, section.Title, 42f, AccentColor,
                    FontStyles.Bold, TextAlignmentOptions.TopLeft, true);

                bool withLinks = section.ShowLinks && PortfolioContent.Links.Length > 0;
                float bodyH = withLinks ? 80f : areaH - 92f - 24f;
                AddText("Body", panel, 32f, 92f, 736f, bodyH, section.Body, 30f, BodyColor,
                    FontStyles.Normal, TextAlignmentOptions.TopLeft, true);

                if (withLinks)
                {
                    for (int k = 0; k < PortfolioContent.Links.Length; k++)
                    {
                        PortfolioContent.Link link = PortfolioContent.Links[k];
                        int col = k % 2;
                        int row = k / 2;
                        Button linkButton = AddButton("Link - " + link.Label, panel,
                            32f + col * 376f, 190f + row * 96f, 356f, 76f, link.Label, 28f);
                        ((Image)linkButton.targetGraphic).color = AccentColor;
                        UnityEventTools.AddStringPersistentListener(linkButton.onClick, links.Open, link.Url);
                    }
                }

                panel.gameObject.SetActive(i == 0);
                panels[i] = panel.gameObject;
            }

            var so = new SerializedObject(switcher);
            SerializedProperty panelsProp = so.FindProperty("panels");
            panelsProp.arraySize = n;
            SerializedProperty imagesProp = so.FindProperty("buttonBackgrounds");
            imagesProp.arraySize = n;
            for (int i = 0; i < n; i++)
            {
                panelsProp.GetArrayElementAtIndex(i).objectReferenceValue = panels[i];
                imagesProp.GetArrayElementAtIndex(i).objectReferenceValue = buttonImages[i];
            }

            so.FindProperty("normalButtonColor").colorValue = ButtonColor;
            so.FindProperty("activeButtonColor").colorValue = AccentColor;
            so.FindProperty("panelShownAtStart").intValue = 0;
            so.ApplyModifiedPropertiesWithoutUndo();

            if (n > 0)
            {
                buttonImages[0].color = AccentColor;
            }

            // Spinning initials on the card until a real avatar is added.
            if (target.Find(AvatarName) == null)
            {
                CreatePlaceholder(root.transform, card);
            }
        }

        static void CreatePlaceholder(Transform parent, Vector2 card)
        {
            var go = new GameObject(PlaceholderName, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var tmp = go.AddComponent<TextMeshPro>();
            tmp.text = PortfolioContent.Initials;
            tmp.fontSize = 10f;
            tmp.fontStyle = FontStyles.Bold;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = AccentColor;
            ((RectTransform)go.transform).sizeDelta = new Vector2(10f, 5f);
            tmp.ForceMeshUpdate();

            float textHeight = tmp.bounds.size.y;
            float wantHeight = card.x * 0.3f;
            float scale = textHeight > 0.0001f ? wantHeight / textHeight : card.x * 0.01f;
            go.transform.localScale = Vector3.one * scale;
            go.transform.localPosition = new Vector3(0f, wantHeight * 0.5f + card.x * 0.05f, -card.y * 0.1f);
            go.AddComponent<Spin>();
        }

        // ------------------------------------------------------------------
        // Home screen
        // ------------------------------------------------------------------
        static void BuildHomeScene(string arScenePath)
        {
            Scene home = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

            Camera cam = Object.FindAnyObjectByType<Camera>();
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color32(11, 13, 26, 255);
            }

            var canvasGo = new GameObject("Home Canvas", typeof(RectTransform), typeof(Canvas),
                typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
            scaler.matchWidthOrHeight = 0.5f;
            Transform c = canvasGo.transform;

            CenteredText("Name", c, 0f, 320f, 960f, 240f, PortfolioContent.Name, 84f, TitleColor, FontStyles.Bold);
            CenteredText("Tagline", c, 0f, 150f, 960f, 120f, PortfolioContent.Tagline, 40f, AccentColor, FontStyles.Normal);
            CenteredText("Hint", c, 0f, -120f, 900f, 100f, PortfolioContent.HomeHint, 40f, BodyColor, FontStyles.Normal);

            RectTransform buttonRt = CenteredRect("Start Button", c, 0f, -320f, 640f, 150f);
            Image buttonImage = AddImage(buttonRt.gameObject, AccentColor, true, 0.3f);
            buttonImage.raycastTarget = true;
            var startButton = buttonRt.gameObject.AddComponent<Button>();
            startButton.targetGraphic = buttonImage;
            TextMeshProUGUI label = AddText("Label", buttonRt, 0f, 0f, 640f, 150f, "Scan my card", 54f,
                Color.white, FontStyles.Bold, TextAlignmentOptions.Center, false);
            label.raycastTarget = false;

            var loader = canvasGo.AddComponent<SceneLoader>();
            UnityEventTools.AddStringPersistentListener(startButton.onClick, loader.LoadScene,
                Path.GetFileNameWithoutExtension(arScenePath));

            EnsureEventSystem();
            EnsureFolder(ScenesFolder);
            EditorSceneManager.SaveScene(home, HomeScenePath);

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(HomeScenePath, true),
                new EditorBuildSettingsScene(arScenePath, true),
            };

            EditorSceneManager.OpenScene(arScenePath, OpenSceneMode.Single);
        }

        // ------------------------------------------------------------------
        // Phone build settings
        // ------------------------------------------------------------------
        static void SetUpPlayerSettings()
        {
            PlayerSettings.productName = PortfolioContent.AppName;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, PortfolioContent.BundleId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, PortfolioContent.BundleId);
            PlayerSettings.iOS.cameraUsageDescription = "Used to scan my AR business card.";

            System.Version current;
            if (!System.Version.TryParse(PlayerSettings.iOS.targetOSVersionString, out current)
                || current < new System.Version(16, 0))
            {
                PlayerSettings.iOS.targetOSVersionString = "16.0";
            }
        }

        // ------------------------------------------------------------------
        // Scene helpers
        // ------------------------------------------------------------------
        static Component FindImageTarget()
        {
            foreach (MonoBehaviour mb in FindInLoadedScenes<MonoBehaviour>())
            {
                if (mb != null && mb.GetType().Name == "ImageTargetBehaviour")
                {
                    return mb;
                }
            }

            return null;
        }

        // Every component of type T in the open scenes, including switched-off objects.
        // (Walks the scenes directly so it works the same on every Unity 6 version.)
        static System.Collections.Generic.List<T> FindInLoadedScenes<T>() where T : Component
        {
            var found = new System.Collections.Generic.List<T>();
            for (int i = 0; i < SceneManager.sceneCount; i++)
            {
                Scene scene = SceneManager.GetSceneAt(i);
                if (!scene.isLoaded)
                {
                    continue;
                }

                foreach (GameObject root in scene.GetRootGameObjects())
                {
                    found.AddRange(root.GetComponentsInChildren<T>(true));
                }
            }

            return found;
        }

        static bool HasTrackableSelected(Component imageTarget)
        {
            SerializedProperty name = new SerializedObject(imageTarget).FindProperty("mTrackableName");
            return name == null || !string.IsNullOrEmpty(name.stringValue);
        }

        // Card width/height in scene units, read from the Vuforia Image Target.
        static Vector2 GetCardSize(Component imageTarget)
        {
            var so = new SerializedObject(imageTarget);
            SerializedProperty w = so.FindProperty("mWidth");
            SerializedProperty h = so.FindProperty("mHeight");
            float width = w != null ? w.floatValue : 0f;
            float height = h != null ? h.floatValue : 0f;
            if (width <= 0f)
            {
                width = 0.085f;
            }

            if (height <= 0f)
            {
                height = width * 0.647f;
            }

            return new Vector2(width, height);
        }

        // Finds the Vuforia AR Camera and switches off any leftover plain camera that would fight with it.
        static Camera SetUpCameras()
        {
            Camera arCamera = null;
            foreach (MonoBehaviour mb in FindInLoadedScenes<MonoBehaviour>())
            {
                if (mb != null && mb.gameObject.activeInHierarchy && mb.GetType().Name == "VuforiaBehaviour")
                {
                    arCamera = mb.GetComponent<Camera>();
                    if (arCamera != null)
                    {
                        break;
                    }
                }
            }

            if (arCamera == null)
            {
                return Camera.main != null ? Camera.main : Object.FindAnyObjectByType<Camera>();
            }

            foreach (Camera other in FindInLoadedScenes<Camera>())
            {
                if (other != arCamera && other.gameObject.activeSelf && other.name == "Main Camera")
                {
                    Undo.RecordObject(other.gameObject, "Disable extra camera");
                    other.gameObject.SetActive(false);
                    Debug.Log("AR Portfolio: switched off the extra 'Main Camera' so it doesn't cover the AR Camera.");
                }
            }

            return arCamera;
        }

        static void AssignEventCamera(Transform target, Camera cam)
        {
            foreach (Canvas canvas in target.GetComponentsInChildren<Canvas>(true))
            {
                if (canvas.renderMode == RenderMode.WorldSpace)
                {
                    canvas.worldCamera = cam;
                }
            }
        }

        static void EnsureEventSystem()
        {
            EventSystem es = Object.FindAnyObjectByType<EventSystem>();
            GameObject go;
            if (es == null)
            {
                go = new GameObject("EventSystem", typeof(EventSystem));
                Undo.RegisterCreatedObjectUndo(go, "Create EventSystem");
            }
            else
            {
                go = es.gameObject;
            }

#if ENABLE_INPUT_SYSTEM
            System.Type newModule = System.Type.GetType("UnityEngine.InputSystem.UI.InputSystemUIInputModule, Unity.InputSystem");
            if (newModule != null)
            {
#if !ENABLE_LEGACY_INPUT_MANAGER
                StandaloneInputModule oldModule = go.GetComponent<StandaloneInputModule>();
                if (oldModule != null)
                {
                    Object.DestroyImmediate(oldModule);
                }
#endif
                if (go.GetComponent<BaseInputModule>() == null)
                {
                    go.AddComponent(newModule);
                }

                return;
            }
#endif
            if (go.GetComponent<BaseInputModule>() == null)
            {
                go.AddComponent<StandaloneInputModule>();
            }
        }

        static string SaveARScene(Scene scene)
        {
            if (string.IsNullOrEmpty(scene.path))
            {
                EnsureFolder(ScenesFolder);
                return EditorSceneManager.SaveScene(scene, DefaultARScenePath) ? DefaultARScenePath : null;
            }

            return EditorSceneManager.SaveScene(scene) ? scene.path : null;
        }

        static bool EnsureTextMeshPro()
        {
            if (Resources.Load<TMP_Settings>("TMP Settings") != null)
            {
                return true;
            }

            bool import = EditorUtility.DisplayDialog("One quick step first",
                "TextMesh Pro (Unity's text tool) needs its basic files before the portfolio can be built.\n\n" +
                "Click Import, wait for it to finish, then run AR Portfolio > Build Everything again.",
                "Import", "Cancel");

            if (import && !EditorApplication.ExecuteMenuItem("Window/TextMeshPro/Import TMP Essential Resources"))
            {
                EditorUtility.DisplayDialog("Import TextMesh Pro",
                    "Open Window > TextMeshPro > Import TMP Essential Resources, click Import, " +
                    "then run AR Portfolio > Build Everything again.", "OK");
            }

            return false;
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path))
            {
                return;
            }

            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }

        static Bounds GetWorldBounds(GameObject go)
        {
            Renderer[] renderers = go.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0)
            {
                return new Bounds(go.transform.position, Vector3.zero);
            }

            Bounds b = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++)
            {
                b.Encapsulate(renderers[i].bounds);
            }

            return b;
        }

        // ------------------------------------------------------------------
        // UI helpers (positions are in pixels from the parent's top-left corner)
        // ------------------------------------------------------------------
        static RectTransform NewRect(string name, Transform parent, float x, float y, float w, float h)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        static RectTransform CenteredRect(string name, Transform parent, float x, float y, float w, float h)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(x, y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        static Image AddImage(GameObject go, Color color, bool rounded, float cornerScale)
        {
            var img = go.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            if (rounded)
            {
                img.sprite = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UISprite.psd");
                img.type = Image.Type.Sliced;
                img.pixelsPerUnitMultiplier = cornerScale;
            }

            return img;
        }

        static TextMeshProUGUI AddText(string name, Transform parent, float x, float y, float w, float h,
            string text, float size, Color color, FontStyles style, TextAlignmentOptions align, bool autoSize)
        {
            RectTransform rt = NewRect(name, parent, x, y, w, h);
            var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.fontStyle = style;
            t.alignment = align;
            t.raycastTarget = false;
            if (autoSize)
            {
                t.enableAutoSizing = true;
                t.fontSizeMax = size;
                t.fontSizeMin = size * 0.5f;
            }

            return t;
        }

        static TextMeshProUGUI CenteredText(string name, Transform parent, float x, float y, float w, float h,
            string text, float size, Color color, FontStyles style)
        {
            RectTransform rt = CenteredRect(name, parent, x, y, w, h);
            var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.fontStyle = style;
            t.alignment = TextAlignmentOptions.Center;
            t.raycastTarget = false;
            t.enableAutoSizing = true;
            t.fontSizeMax = size;
            t.fontSizeMin = size * 0.5f;
            return t;
        }

        static Button AddButton(string name, Transform parent, float x, float y, float w, float h, string label, float fontSize)
        {
            RectTransform rt = NewRect(name, parent, x, y, w, h);
            Image img = AddImage(rt.gameObject, ButtonColor, true, 0.4f);
            img.raycastTarget = true;
            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = img;
            ColorBlock colors = button.colors;
            colors.highlightedColor = new Color(0.9f, 0.93f, 1f);
            colors.pressedColor = new Color(0.75f, 0.78f, 0.9f);
            colors.selectedColor = Color.white;
            button.colors = colors;
            AddText("Label", rt, 0f, 0f, w, h, label, fontSize, TitleColor, FontStyles.Bold,
                TextAlignmentOptions.Center, true);
            return button;
        }
    }
}
