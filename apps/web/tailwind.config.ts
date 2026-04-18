import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0d6e6e",
          50: "#eef7f7",
          100: "#d6ecec",
          500: "#0d6e6e",
          600: "#0a5757",
          700: "#084444",
        },
        risk: {
          low: "#16a34a",
          medium: "#d97706",
          high: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Pretendard", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
