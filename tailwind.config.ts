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
        // App-wide denser scale (Settings-aligned). rem stays root-relative.
        xs: ["0.6875rem", { lineHeight: "1.35", fontWeight: "400" }], // 11px
        sm: ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }], // 13px
        base: ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }], // 13px
        lg: ["0.9375rem", { lineHeight: "1.35", fontWeight: "400" }], // 15px
        xl: ["1.125rem", { lineHeight: "1.25", fontWeight: "600" }], // 18px
        "2xl": ["1.25rem", { lineHeight: "1.25", fontWeight: "600" }], // 20px
        page: ["var(--text-page)", { lineHeight: "1.25", fontWeight: "600" }],
        section: ["var(--text-section)", { lineHeight: "1.25", fontWeight: "600" }],
        card: ["var(--text-card)", { lineHeight: "1.25", fontWeight: "600" }],
        modal: ["var(--text-modal)", { lineHeight: "1.25", fontWeight: "600" }],
        body: ["var(--text-body)", { lineHeight: "1.4", fontWeight: "400" }],
        muted: ["var(--text-muted)", { lineHeight: "1.35", fontWeight: "400" }],
        caption: ["var(--text-caption)", { lineHeight: "1.35", fontWeight: "400" }],
        stat: ["var(--text-stat)", { lineHeight: "1.25", fontWeight: "600" }],
      },
      height: {
        control: "var(--control-h)",
        "control-sm": "var(--control-h-sm)",
        "control-lg": "var(--control-h-lg)",
      },
      minHeight: {
        control: "var(--control-h)",
        "control-sm": "var(--control-h-sm)",
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
