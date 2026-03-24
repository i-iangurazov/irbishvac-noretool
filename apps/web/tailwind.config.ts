import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      screens: {
        "3xl": "1800px",
        "4xl": "2200px",
        "5xl": "3000px"
      },
      fontFamily: {
        sans: ["var(--font-montserrat)"]
      }
    }
  },
  plugins: []
} satisfies Config;
