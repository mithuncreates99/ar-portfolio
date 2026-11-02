using UnityEngine;
using UnityEngine.UI;

namespace ARPortfolio
{
    // Shows one info panel at a time and highlights the button for it.
    // The builder (AR Portfolio > Build Everything) sets this up for you.
    // To wire it by hand: Button OnClick -> + -> drag the Canvas -> PanelSwitcher -> Show (int) -> panel number.
    public class PanelSwitcher : MonoBehaviour
    {
        [Tooltip("Every info panel, in order. Element 0 = first panel, 1 = second, etc.")]
        [SerializeField] private GameObject[] panels;

        [Tooltip("Background image of each menu button, same order as the panels.")]
        [SerializeField] private Image[] buttonBackgrounds;

        [SerializeField] private Color normalButtonColor = new Color32(30, 36, 64, 255);
        [SerializeField] private Color activeButtonColor = new Color32(108, 140, 255, 255);

        [Tooltip("Which panel is open when the app starts. -1 = none.")]
        [SerializeField] private int panelShownAtStart = 0;

        void Start()
        {
            Show(panelShownAtStart);
        }

        // Opens one panel and closes all the others.
        public void Show(int index)
        {
            if (panels != null)
            {
                for (int i = 0; i < panels.Length; i++)
                {
                    if (panels[i] != null)
                    {
                        panels[i].SetActive(i == index);
                    }
                }
            }

            if (buttonBackgrounds != null)
            {
                for (int i = 0; i < buttonBackgrounds.Length; i++)
                {
                    if (buttonBackgrounds[i] != null)
                    {
                        buttonBackgrounds[i].color = i == index ? activeButtonColor : normalButtonColor;
                    }
                }
            }
        }

        // Opens a panel, or closes it if it's already open.
        public void Toggle(int index)
        {
            bool alreadyOpen = panels != null && index >= 0 && index < panels.Length
                               && panels[index] != null && panels[index].activeSelf;
            Show(alreadyOpen ? -1 : index);
        }

        public void HideAll()
        {
            Show(-1);
        }
    }
}
