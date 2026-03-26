/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: "#1D9E75", light: "#E1F5EE", dark: "#0F6E56" },
      },
      fontFamily: { sans: ["DM Sans", "sans-serif"] },
    },
  },
  plugins: [],
}
