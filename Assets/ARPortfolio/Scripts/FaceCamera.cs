using UnityEngine;

namespace ARPortfolio
{
    // Keeps the avatar turned towards the phone (it only turns left/right, never tilts).
    public class FaceCamera : MonoBehaviour
    {
        [Tooltip("How quickly the avatar turns to face you.")]
        [SerializeField] private float turnSpeed = 6f;

        private Camera cam;

        void LateUpdate()
        {
            if (cam == null)
            {
                cam = Camera.main != null ? Camera.main : FindAnyObjectByType<Camera>();
                if (cam == null)
                {
                    return;
                }
            }

            Vector3 up = transform.parent != null ? transform.parent.up : Vector3.up;
            Vector3 toCamera = Vector3.ProjectOnPlane(cam.transform.position - transform.position, up);
            if (toCamera.sqrMagnitude < 0.000001f)
            {
                return;
            }

            Quaternion target = Quaternion.LookRotation(toCamera, up);
            float t = 1f - Mathf.Exp(-turnSpeed * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, target, t);
        }
    }
}
