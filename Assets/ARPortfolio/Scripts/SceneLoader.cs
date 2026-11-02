using UnityEngine;
using UnityEngine.SceneManagement;

namespace ARPortfolio
{
    // Used by the Start button on the Home screen to open the AR scene.
    // Both scenes must be in File > Build Profiles > Scene List (the builder does this for you).
    public class SceneLoader : MonoBehaviour
    {
        public void LoadScene(string sceneName)
        {
            SceneManager.LoadScene(sceneName);
        }

        public void ReloadCurrentScene()
        {
            SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }
    }
}
