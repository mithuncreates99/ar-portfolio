using UnityEngine;

namespace ARPortfolio
{
    // Calms the small shakes that come from camera tracking.
    // Put it on an object inside the ImageTarget (the builder adds it to "Portfolio Content"):
    // instead of copying every tiny jump of the card, the object glides smoothly after it.
    [DefaultExecutionOrder(10000)]
    public class PoseSmoother : MonoBehaviour
    {
        [Tooltip("Higher = steadier but follows a little more slowly. 0.08 - 0.15 works well. 0 = off.")]
        [SerializeField, Range(0f, 0.5f)] private float smoothTime = 0.12f;

        [Tooltip("If the card jumps further than this (metres) it snaps instead of gliding, e.g. when it is found again.")]
        [SerializeField] private float snapDistance = 0.05f;

        [Tooltip("Same as above, for sudden turns (degrees).")]
        [SerializeField] private float snapAngle = 25f;

        private Transform parent;
        private Vector3 localPos;
        private Quaternion localRot;
        private Vector3 smoothPos;
        private Quaternion smoothRot;
        private bool hasPose;
        private float lastTime;

        void Awake()
        {
            parent = transform.parent;
            localPos = transform.localPosition;
            localRot = transform.localRotation;
        }

        void OnEnable()
        {
            hasPose = false;
        }

        void OnDisable()
        {
            Application.onBeforeRender -= Apply;
        }

        void LateUpdate()
        {
            Apply();

            // Re-register every frame so this runs after the AR camera's own last-moment update.
            Application.onBeforeRender -= Apply;
            Application.onBeforeRender += Apply;
        }

        void Apply()
        {
            if (parent == null)
            {
                return;
            }

            // Where the content would be without smoothing.
            Vector3 targetPos = parent.TransformPoint(localPos);
            Quaternion targetRot = parent.rotation * localRot;

            float now = Time.unscaledTime;
            float dt = now - lastTime;
            lastTime = now;

            bool snap = !hasPose
                        || smoothTime <= 0f
                        || dt > 0.25f
                        || Vector3.Distance(smoothPos, targetPos) > snapDistance
                        || Quaternion.Angle(smoothRot, targetRot) > snapAngle;

            if (snap)
            {
                smoothPos = targetPos;
                smoothRot = targetRot;
                hasPose = true;
            }
            else if (dt > 0f)
            {
                float t = 1f - Mathf.Exp(-dt / smoothTime);
                smoothPos = Vector3.Lerp(smoothPos, targetPos, t);
                smoothRot = Quaternion.Slerp(smoothRot, targetRot, t);
            }

            transform.SetPositionAndRotation(smoothPos, smoothRot);
        }
    }
}
