using UnityEngine;

namespace ARPortfolio
{
    // Opens a web link (or a mailto: link) on the phone.
    // The builder wires each link button to Open(...) with the URL from PortfolioContent.cs.
    // To change a link by hand: select the button -> OnClick -> edit the text box next to "OpenLinks.Open".
    public class OpenLinks : MonoBehaviour
    {
        public void Open(string url)
        {
            if (!string.IsNullOrWhiteSpace(url))
            {
                Application.OpenURL(url);
            }
        }
    }
}
