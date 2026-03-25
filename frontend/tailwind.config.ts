import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Pure Apple System Colors ---

        // Dark Mode Base
        bgOnyx: "#000000",
        surface1: "#1C1C1E", // Apple System Gray 6 Dark
        surface2: "#2C2C2E", // Apple System Gray 5 Dark
        surface3: "#3A3A3C", // Apple System Gray 4 Dark

        // Light Mode Base
        bgLuminous: "#F2F2F7", // Apple Grouped Background
        surfaceLight1: "#FFFFFF",
        surfaceLight2: "#F2F2F7",
        surfaceLight3: "#E5E5EA",

        // Semantic tokens backing
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",

        // --- Status colors (Apple standard) ---
        "status-success": "#34C759", // Apple green
        "status-warning": "#FFCC00", // Apple yellow
        "status-error": "#FF3B30", // Apple red
        "status-info": "#007AFF", // Apple blue
      },

      fontFamily: {
        // Pure Apple typography stack
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Icons",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },

      fontSize: {
        "2xs": [
          "0.6875rem",
          { lineHeight: "0.875rem", letterSpacing: "0.01em" },
        ],
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
      },

      boxShadow: {
        // Apple-style soft drop shadows
        shell:
          "0 10px 40px -10px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.05) inset",
        card: "0 1px 2px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.05)",
        "card-lg":
          "0 8px 30px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.05) inset",
        glow: "0 0 20px rgba(10,132,255,0.15)",
        "glow-rose": "0 0 20px rgba(255,59,48,0.15)",
        float: "0 8px 30px rgba(0,0,0,0.12)",
        nav: "0 -0.5px 0 rgba(0,0,0,0.1)",
        // Light mode shadows
        "shell-light":
          "0 10px 40px -10px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "card-light":
          "0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)",
      },

      borderRadius: {
        shell: "24px", // Apple standard for modals/large cards
        card: "16px", // Apple standard continuous curve
        chip: "8px",
        pill: "9999px",
      },

      maxWidth: {
        app: "28rem",
      },

      backgroundImage: {
        // Removed heavy mesh gradients for pure flat/subtle Apple look
        "mesh-dark": "none",
        "mesh-light": "none",
        "gradient-cyan": "linear-gradient(135deg, #0A84FF 0%, #007AFF 100%)",
        "gradient-rose": "linear-gradient(135deg, #FF453A 0%, #FF3B30 100%)",
        "gradient-violet": "linear-gradient(135deg, #5E5CE6 0%, #5856D6 100%)",
        "gradient-gold": "linear-gradient(135deg, #FFD60A 0%, #FFCC00 100%)",
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },

      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },

      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2s linear infinite",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.25, 1, 0.5, 1)",
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
        "600": "600ms",
      },

      backdropBlur: {
        xs: "4px",
        "4xl": "60px", // Standard Apple vibrant blur
      },

      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        "safe-top": "env(safe-area-inset-top, 0px)",
        "safe-left": "env(safe-area-inset-left, 0px)",
        "safe-right": "env(safe-area-inset-right, 0px)",
        "18": "4.5rem",
        "22": "5.5rem",
      },

      zIndex: {
        nav: "100",
        header: "90",
        modal: "200",
        toast: "300",
      },
    },
  },
  plugins: [],
};

export default config;
