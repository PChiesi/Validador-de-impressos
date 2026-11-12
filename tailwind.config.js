/** Tokens visuais do Validador de Impressos (identidade corporativa verde). */
module.exports = {
  darkMode: "class",
  content: ["./src/template.html", "./src/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Consolas", "monospace"],
      },
      colors: {
        brand: { 50: "#EEF7F2", 100: "#D6EDE0", 200: "#AEDBC3", 300: "#7CC29F", 400: "#46A276", 500: "#1F8758", 600: "#0B6B47", 700: "#08573A", 800: "#074530", 900: "#053626", 950: "#021F15" },
        ink: { 50: "#F5F7F6", 100: "#ECEFEE", 200: "#DADFDD", 300: "#BCC4C1", 400: "#8F9A96", 500: "#66716D", 600: "#4D5754", 700: "#38413E", 800: "#252C2A", 850: "#1C2321", 900: "#151B19", 950: "#0D1110" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(13,17,16,.04), 0 4px 16px -6px rgba(13,17,16,.10)",
        lift: "0 2px 4px rgba(13,17,16,.05), 0 18px 44px -14px rgba(13,17,16,.28)",
      },
    },
  },
};
