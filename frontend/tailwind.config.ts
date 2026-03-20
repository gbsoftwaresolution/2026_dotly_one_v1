import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brandCyan: "#06B6D4",
        brandRose: "#F43F5E",
        bgOnyx: "#050505",
        bgLuminous: "#F8FAFC",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        shell: "0 16px 40px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        shell: "1.5rem",
      },
      maxWidth: {
        app: "32rem",
      },
    },
  },
  plugins: [],
};

export default config;
