/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: "#FAF8F5",
          card: "#FFFFFF",
          surface: "#1a1a24",
        },
        accent: {
          green: "#3D8B7A",
          blue: "#4A9E8C",
          purple: "#A78BFA",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
}
