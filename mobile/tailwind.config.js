/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Reparo Design System (siehe Web-App)
        bg:      "#FAF8F5",
        accent:  "#3D8B7A",
        warm:    "#C4956A",
        danger:  "#C4574B",
        mieter:  "#5B6ABF",
        admin:   "#7C6CAB",
        text:    "#2D2A26",
        muted:   "#8C857B",
        soft:    "#6B665E",
        border:  "#EDE8E1",
        card:    "#FFFFFF",
      },
    },
  },
  plugins: [],
}
