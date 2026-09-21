import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        primary: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          DEFAULT: "#f97316",
          foreground: "#ffffff",
        },
        status: {
          new: {
            bg: "#f1f5f9",
            text: "#475569",
            border: "#cbd5e1",
          },
          confirmed: {
            bg: "#eff6ff",
            text: "#1d4ed8",
            border: "#bfdbfe",
          },
          packing: {
            bg: "#fff7ed",
            text: "#c2410c",
            border: "#fed7aa",
          },
          packed: {
            bg: "#faf5ff",
            text: "#7e22ce",
            border: "#e9d5ff",
          },
          dispatched: {
            bg: "#ecfdf5",
            text: "#047857",
            border: "#a7f3d0",
          },
          smsSent: {
            bg: "#ecfdf5",
            text: "#047857",
            border: "#a7f3d0",
          },
          smsPending: {
            bg: "#fffbeb",
            text: "#b45309",
            border: "#fde68a",
          },
          smsFailed: {
            bg: "#fef2f2",
            text: "#b91c1c",
            border: "#fecaca",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        float: "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
