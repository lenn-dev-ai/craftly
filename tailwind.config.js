/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Surface / Background tokens */
        surface: {
          DEFAULT: "#FAF8F5",
          card: "#FFFFFF",
          muted: "#F5F3F0",
          dark: "#1a1a24",
        },
        /* Primary brand accent */
        accent: {
          DEFAULT: "#3D8B7A",
          hover: "#2D7A6A",
          light: "#E8F4F1",
          muted: "#3D8B7A1A",
        },
        /* Warm secondary accent */
        warm: {
          DEFAULT: "#C4956A",
          light: "#F5EDE5",
        },
        /* Text tokens */
        ink: {
          DEFAULT: "#2D2A26",
          secondary: "#6B665E",
          muted: "#8C857B",
          faint: "#B5AEA4",
        },
        /* Semantic status colors */
        danger: {
          DEFAULT: "#C4574B",
          light: "#FDF0EF",
        },
        success: {
          DEFAULT: "#3D8B7A",
          light: "#E8F4F1",
        },
        /* Border tokens */
        border: {
          DEFAULT: "#EDE8E1",
          muted: "#F5F3F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
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
