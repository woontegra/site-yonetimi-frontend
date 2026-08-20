import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F3F5F7",
        surface: "#FFFFFF",
        line: "#E3E7EC",
        ink: "#1B2430",
        muted: "#6B7280",
        brand: {
          DEFAULT: "#1E5AAB",
          hover: "#184A8C",
          soft: "#E8F0FA",
        },
        success: "#15803D",
        warning: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16, 24, 40, 0.04)",
        menu: "0 8px 24px rgba(16, 24, 40, 0.10)",
        modal: "0 10px 30px rgba(16, 24, 40, 0.10), 0 2px 8px rgba(16, 24, 40, 0.04)",
      },
      transitionDuration: {
        micro: "160ms",
      },
    },
  },
  plugins: [],
};

export default config;
