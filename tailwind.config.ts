// NOTE: This project uses Tailwind CSS v4 which uses CSS-based configuration.
// The canonical design tokens live in app/globals.css under @theme inline.
// This file is kept as a reference and for tooling that expects it.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mit: {
          "bg-base":     "#1D282A",
          "bg-dark":     "#0F1015",
          "bg-card":     "#1D1F26",
          "bg-elevated": "#252B2D",
          accent:        "#D97757",
          gold:          "#C9A45A",
          text:          "#FFFFFF",
          "text-muted":  "#EFEFEF",
          "text-subtle": "#8A9BA0",
          success:       "#4CAF82",
          warning:       "#F0B429",
          danger:        "#E53E3E",
        },
      },
      fontFamily: {
        display: ["Classy Vogue", "serif"],
        body:    ["Gilroy", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
