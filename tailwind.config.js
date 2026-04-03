/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: "#0a0a0f",
          card: "#12121a",
          surface: "#1a1a24",
        },
        accent: {
          green: "#00D4AA",
          blue: "#00B4D8",
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
