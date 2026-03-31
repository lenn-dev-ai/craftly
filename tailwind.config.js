/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: { DEFAULT: "#0a0a0f", card: "#12121a", surface: "#1a1a24" },
        accent: { green: "#00D4AA", blue: "#00B4D8", purple: "#A78BFA" },
      },
      fontFamily: { sans: ["Inter", "sans-serif"], display: ["Space Grotesk", "sans-serif"] },
    },
  },
  plugins: [],
}
