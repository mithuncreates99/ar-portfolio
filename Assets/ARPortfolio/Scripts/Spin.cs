using UnityEngine;

namespace ARPortfolio
{
    // Slowly turns an object (used on the placeholder initials until you add an avatar).
    public class Spin : MonoBehaviour
    {
        [Tooltip("Degrees per second. Negative = spin the other way. 0 = no spin.")]
        [SerializeField] private float degreesPerSecond = 30f;

        void Update()
        {
            transform.Rotate(0f, degreesPerSecond * Time.deltaTime, 0f, Space.Self);
        }
    }
}
