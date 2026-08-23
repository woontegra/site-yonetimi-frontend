import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        surface: "var(--color-surface)",
        elevated: "var(--color-surface-elevated)",
        line: "var(--color-border)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        brand: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          soft: "var(--color-accent-subtle)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          subtle: "var(--color-success-subtle)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          subtle: "var(--color-warning-subtle)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          subtle: "var(--color-danger-subtle)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          subtle: "var(--color-info-subtle)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        page: ["var(--text-page)", { lineHeight: "1.3", fontWeight: "600" }],
        section: ["var(--text-section)", { lineHeight: "1.4", fontWeight: "500" }],
        card: ["var(--text-card)", { lineHeight: "1.4", fontWeight: "500" }],
        caption: ["var(--text-caption)", { lineHeight: "1.45", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        menu: "var(--shadow-menu)",
        modal: "var(--shadow-modal)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-collapsed)",
        header: "var(--header-height)",
      },
      transitionDuration: {
        micro: "160ms",
      },
    },
  },
  plugins: [],
};

export default config;
