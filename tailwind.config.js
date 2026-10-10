/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#05060a",
        panel: "#0b0e17",
        line: "#1b2236",
        neon: "#7c5cff",
        cyanx: "#38e1ff",
        limex: "#b6ff5c",
        amberx: "#ffb224",
        roseX: "#ff5c8a",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
