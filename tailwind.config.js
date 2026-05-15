/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Surfaces / Backgrounds */
        surface: {
          DEFAULT: "#FAF8F5",      // page bg
          card: "#FFFFFF",         // cards / drawers
          muted: "#F5F3F0",        // subtle bg
          warm: "#FAF1DE",         // warm-tinted blocks
        },
        /* Primary brand accent (= verwalter green) */
        accent: {
          DEFAULT: "#3D8B7A",
          hover: "#2D6B5A",        // synced with code
          light: "#E8F4F1",
          muted: "#3D8B7A1A",
        },
        /* Warm secondary (= handwerker amber) */
        warm: {
          DEFAULT: "#C4956A",
          light: "#FAF1DE",
          dark: "#854F0B",
        },
        /* Text tokens */
        ink: {
          DEFAULT: "#2D2A26",
          secondary: "#6B665E",
          muted: "#8C857B",
          faint: "#B5AEA4",
        },
        /* Rollen-Akzente — first-class fürs Designsystem */
        rolle: {
          verwalter: "#3D8B7A",
          handwerker: "#C4956A",
          mieter: "#5B6ABF",
          admin: "#7C6CAB",
        },
        /* Status-Farben — eindeutig pro Workflow-Stufe */
        status: {
          offen: "#C4574B",         // needs attention (rot)
          auktion: "#5B6ABF",       // läuft (blau)
          bearbeitung: "#C4956A",   // in Arbeit (amber)
          erledigt: "#3D8B7A",      // done (grün)
        },
        /* Typ-Farben — sekundär, nur wenn Typ relevant */
        typ: {
          standard: "#6B665E",
          diagnose: "#7C6CAB",
          projekt: "#3D8B7A",
        },
        /* Semantic */
        danger: {
          DEFAULT: "#C4574B",
          light: "#FDEEEC",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FAF1DE",
          dark: "#854F0B",
        },
        info: {
          DEFAULT: "#5B6ABF",
          light: "#E8EAF6",
        },
        success: {
          DEFAULT: "#3D8B7A",
          light: "#E8F4F1",
        },
        /* Border tokens */
        line: {
          DEFAULT: "#EDE8E1",       // bg-line / border-line
          strong: "#D5CFC7",
          muted: "#F5F3F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(45, 42, 38, 0.06)",
        DEFAULT: "0 2px 6px rgba(45, 42, 38, 0.07)",
        md: "0 4px 12px rgba(45, 42, 38, 0.08)",
        lg: "0 8px 24px rgba(45, 42, 38, 0.10)",
        xl: "0 16px 40px rgba(45, 42, 38, 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
}
