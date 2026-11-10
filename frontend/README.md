# C-Mopol Frontend — Authentication System

A modern, responsive React authentication frontend built with **TanStack Query** and **Reach Router**, styled according to the design specification with fluid CSS properties (`clamp()`, `min()`, `max()`, `rem`, `vh`, `vw`, `%`), and zero `px` units.

---

## 🚀 Getting Started

To launch the frontend development server:

```bash
cd frontend
npm run dev
```

The application runs at `http://localhost:3000` with automated proxying to the backend API at `http://localhost:5000`.

---

## 📁 Architecture & File Structure

```
frontend/
├── index.html                    # HTML entry point with Plus Jakarta Sans typography
├── vite.config.js                # Vite build config with backend API proxy (/api -> http://localhost:5000)
├── package.json                  # Dependencies: @reach/router, @tanstack/react-query, React 18
├── README.md                     # Documentation
└── src/
    ├── main.jsx                  # React DOM mount point
    ├── App.jsx                   # Application root with TanStack QueryClientProvider & Reach Router
    │
    ├── context/
    │   └── AuthContext.jsx       # Global Auth state, profile fetching, session tracking
    │
    ├── services/
    │   ├── api.js                # Fetch wrapper with credentials (httpOnly cookies) & auto-refresh
    │   └── authService.js        # Authentication API service methods (login, register, verify, sessions, etc.)
    │
    ├── components/               # Pure JSX components (completely separated from styles)
    │   ├── common/
    │   │   ├── Navbar.jsx        # Top navbar with animated Hamburger-to-X toggle button
    │   │   ├── SideNav.jsx       # Sliding drawer from the right on mobile screens
    │   │   ├── Overlay.jsx       # Transparent backdrop overlay with scroll-lock coordination
    │   │   ├── SunLogo.jsx       # Radiant sunburst logo from screenshots (vector SVG)
    │   │   ├── Icons.jsx         # Google, Apple, Eye, Lock, Mail, Shield, and User icons
    │   │   ├── InputField.jsx    # Fluid input control with password visibility toggle & error states
    │   │   ├── Button.jsx        # Primary, outline, and loading button states
    │   │   └── AlertNotice.jsx   # Error and success feedback banners
    │   ├── auth/
    │   │   ├── AuthLayout.jsx    # Split-card container (Form on left, Hero visual card on right)
    │   │   ├── AuthHeroCard.jsx  # Atmospheric visual card with 4-dash carousel indicators & narratives
    │   │   ├── SocialAuthButtons.jsx # "Continue with Google" & "Continue with Apple"
    │   │   ├── AuthDivider.jsx   # Horizontal "OR" divider
    │   │   ├── AuthLegalFooter.jsx # Terms & Conditions and Privacy Policy disclaimer
    │   │   ├── LoginForm.jsx     # Login form with TanStack Query mutation
    │   │   ├── RegisterForm.jsx  # Registration form with first/last name, email, phone, password
    │   │   ├── VerifyEmailForm.jsx # Email verification code screen matching screenshot 2
    │   │   ├── ForgotPasswordForm.jsx # Forgot password request screen
    │   │   └── ResetPasswordForm.jsx  # New password & token reset screen
    │   └── pages/
    │       ├── LoginPage.jsx     # Route: /login and /
    │       ├── RegisterPage.jsx  # Route: /signup and /register
    │       ├── VerifyEmailPage.jsx # Route: /verify-email
    │       ├── ForgotPasswordPage.jsx # Route: /forgot-password
    │       ├── ResetPasswordPage.jsx  # Route: /reset-password and /reset-password/:token
    │       ├── SecurityPage.jsx  # Route: /security and /sessions (session limits & password change)
    │       ├── DashboardPage.jsx # Route: /dashboard (authenticated profile overview)
    │       └── NotFoundPage.jsx  # Route: 404 fallback
    │
    └── styles/                   # Dedicated styling folder (under src/)
        ├── global.css            # Base reset, typography, and CSS variables (0 px units)
        ├── navbar.css            # Desktop navbar, animated hamburger, right drawer, overlay
        ├── auth-layout.css       # Split-card container, flex layout, layout-only media query
        ├── auth-forms.css        # Social buttons, fields, verification code input, buttons, alerts
        ├── auth-hero.css         # Visual card styling, atmospheric radial glows, indicators
        ├── dashboard.css         # Authenticated dashboard card grid & badges
        └── security.css          # Device sessions manager & password update card
```

---

## 🎨 Design & CSS Unit Standards

- **Zero `px` Units:** Strictly zero occurrences of `px` in the styling system.
- **Fluid Spaces (`clamp()`):** All paddings, margins, and font sizes use `clamp()` for continuous fluid responsiveness across all screen sizes.
- **Fluid Layout Dimensions:** Dimensions use `vh`, `vw`, `%`, `min()`, and `max()`.
- **rem Measurements:** Borders (`0.0625rem`), border radii (`0.625rem`, `1.25rem`), gaps (`0.75rem`, `1.25rem`), and shadows (`rem`-based).
- **Flexbox Architecture:** Utilizes `flex`, `flex-shrink`, `flex-wrap`, and `flex-basis`.
- **Media Queries:** Exclusively used for structural layout reorganization (e.g. converting desktop split card to single-column card and showing the hamburger button).
- **Responsive Mobile Navigation:**
  - On smaller screens, the top menu transitions to a hamburger button on the top right.
  - Clicking the hamburger smoothly animates the bars into an **"X"** button.
  - The side navbar slides in from the right edge of the screen (`transform: translateX(0)`).
  - A transparent backdrop overlay covers the page and body scrolling is disabled (`overflow: hidden`).
  - Clicking either the "X" button or the transparent backdrop hides the drawer, restores the hamburger, and re-enables body scrolling.
