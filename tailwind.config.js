/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shop: {
          950: "#090d12",
          900: "#101720",
          850: "#151d28",
          800: "#1b2532",
          700: "#2b3848",
          500: "#64748b",
          accent: "#f0b429",
          green: "#30d158",
          red: "#ff5a5f"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(240,180,41,0.18), 0 24px 80px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};
