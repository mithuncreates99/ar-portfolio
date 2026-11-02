// =====================================================================
//  YOUR PORTFOLIO TEXT
//  Edit anything below, save, then in Unity run:
//      AR Portfolio > Build Everything
//  and the AR panels and Home screen are rebuilt with the new text.
//
//  Tips:
//   - \n starts a new line.
//   - Rich text works: <b>bold</b>, <i>italic</i>, <color=#6C8CFF>blue</color>.
//   - Add or remove whole sections; the buttons adjust automatically (6 fits best).
// =====================================================================

namespace ARPortfolio
{
    public static class PortfolioContent
    {
        public const string Name = "Mithun Kumar Vijayakumar";
        public const string Tagline = "Master in Management @ NEOMA  |  B.Tech IT  |  Apps & AR";
        public const string Initials = "MK";

        // Shown under your name on the Home screen.
        public const string HomeHint = "Point your camera at my card";

        // App name on the phone, and the app's unique ID (no spaces).
        public const string AppName = "Mithun AR";
        public const string BundleId = "com.mithun.arportfolio";

        public class Section
        {
            public string Button;
            public string Title;
            public string Body;
            public bool ShowLinks; // true = the link buttons appear in this panel
        }

        public class Link
        {
            public string Label;
            public string Url;

            public Link(string label, string url)
            {
                Label = label;
                Url = url;
            }
        }

        public static readonly Section[] Sections =
        {
            new Section
            {
                Button = "About",
                Title = "Hi, I'm Mithun",
                Body = "IT engineer turned business student. I build apps and augmented reality " +
                       "experiences, and I'm now doing a Master in Management at NEOMA Business School " +
                       "in Rouen, France.\n\n" +
                       "<color=#6C8CFF><b>Looking for:</b></color> a 6-month internship from January 2027 " +
                       "in IT, business analysis, data, consulting or digital transformation."
            },
            new Section
            {
                Button = "Education",
                Title = "Education",
                Body = "<b>Master in Management (MiM)</b>\n" +
                       "NEOMA Business School, Rouen, France\n" +
                       "2026 - present\n\n" +
                       "<b>B.Tech, Information Technology</b>\n" +
                       "Bannari Amman Institute of Technology, Tamil Nadu, India\n" +
                       "2022 - 2026"
            },
            new Section
            {
                Button = "Skills",
                Title = "Skills",
                Body = "•  Pega Certified System Architect (CSA)\n" +
                       "•  Web and iPhone app development\n" +
                       "•  Augmented reality with Unity\n" +
                       "•  Business strategy and case analysis\n" +
                       "•  Languages: English, French (intermediate)"
            },
            new Section
            {
                Button = "Projects",
                Title = "Projects",
                Body = "<b>Tell Me</b> - habit-tracker app with daily yes/no check-ins and weekly insights (web + iPhone)\n\n" +
                       "<b>Xpense</b> - expense and group-split tracker app\n\n" +
                       "<b>AR Jet Turbine</b> - augmented reality visualization of a jet turbine\n\n" +
                       "<b>This AR portfolio</b> - built with Unity and Vuforia"
            },
            new Section
            {
                Button = "Awards",
                Title = "Awards",
                Body = "•  <b>Best Paper Award</b> - ICMCCT'25\n\n" +
                       "•  <b>State Gold, Woodworking</b> - Tamil Nadu Skills Competition (Dec 2025)\n\n" +
                       "•  <b>Bronze, Joinery</b> - IndiaSkills Southern Regional 2025-26"
            },
            new Section
            {
                Button = "Connect",
                Title = "Let's connect",
                Body = "Tap a link to open it on your phone.",
                ShowLinks = true
            },
        };

        // Link buttons in the "Connect" panel. Remove the // in front of a line to turn it on.
        public static readonly Link[] Links =
        {
            new Link("Portfolio website", "https://mithuncreates99.github.io"),
            new Link("GitHub", "https://github.com/mithuncreates99"),
            // new Link("LinkedIn", "https://www.linkedin.com/in/YOUR-LINKEDIN-HANDLE"),
            // new Link("Email me", "mailto:your.email@example.com"),
        };
    }
}
