import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Brand accent palette ---
        brandCyan: "#00D4FF", // Electric cyan — dark mode primary CTA
        brandRose: "#FF3366", // Hot rose — light mode primary CTA
        brandViolet: "#7C3AED", // Deep violet — secondary accent

        // --- Dark surface hierarchy (Google Material You) ---
        bgOnyx: "#080808", // True near-black base
        surface1: "#0f0f0f", // Card layer 1
        surface2: "#161616", // Card layer 2 / elevated
        surface3: "#1e1e1e", // Tooltip / overlay

        // --- Light surface hierarchy (Apple-inspired) ---
        bgLuminous: "#F5F5F7", // Apple grey-white
        surfaceLight1: "#FFFFFF",
        surfaceLight2: "#F2F2F7", // Apple grouped secondary
        surfaceLight3: "#E5E5EA", // Apple separator

        // --- Semantic tokens (backed by CSS vars) ---
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",

        // --- Status colors ---
        "status-success": "#30D158", // Apple green
        "status-warning": "#FFD60A", // Apple yellow
        "status-error": "#FF453A", // Apple red
        "status-info": "#0A84FF", // Apple blue
      },

      fontFamily: {
        sans: [
          "var(--font-plus-jakarta-sans)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },

      fontSize: {
        "2xs": [
          "0.625rem",
          { lineHeight: "0.875rem", letterSpacing: "0.08em" },
        ],
        label: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },

      boxShadow: {
        shell:
          "0 20px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset",
        card: "0 1px 0 rgba(255,255,255,0.05) inset, 0 0 0 1px rgba(255,255,255,0.04)",
        "card-lg":
          "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset",
        glow: "0 0 24px rgba(0,212,255,0.18), 0 0 48px rgba(0,212,255,0.08)",
        "glow-rose":
          "0 0 24px rgba(255,51,102,0.24), 0 0 48px rgba(255,51,102,0.10)",
        float: "0 4px 24px rgba(0,0,0,0.32), 0 1px 4px rgba(0,0,0,0.20)",
        nav: "0 -1px 0 rgba(255,255,255,0.04), 0 -20px 60px rgba(0,0,0,0.4)",
        // Light mode shadows
        "shell-light":
          "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-light":
          "0 1px 3px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
      },

      borderRadius: {
        shell: "1.5rem",
        card: "1.25rem",
        chip: "0.625rem",
        pill: "9999px",
      },

      maxWidth: {
        app: "28rem", // tighter mobile-first max
      },

      backgroundImage: {
        // Dark mesh gradient — the "alive" background
        "mesh-dark":
          "radial-gradient(at 20% 20%, rgba(0,212,255,0.06) 0px, transparent 50%), " +
          "radial-gradient(at 80% 80%, rgba(124,58,237,0.06) 0px, transparent 50%), " +
          "radial-gradient(at 50% 0%, rgba(255,51,102,0.04) 0px, transparent 40%)",
        // Light mesh gradient
        "mesh-light":
          "radial-gradient(at 20% 20%, rgba(0,212,255,0.05) 0px, transparent 50%), " +
          "radial-gradient(at 80% 80%, rgba(124,58,237,0.04) 0px, transparent 50%)",
        // Accent gradients
        "gradient-cyan": "linear-gradient(135deg, #00D4FF 0%, #0099FF 100%)",
        "gradient-rose": "linear-gradient(135deg, #FF3366 0%, #FF6B35 100%)",
        "gradient-violet": "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
        "gradient-gold": "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
        // Card shimmer
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },

      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
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
          "50%": { opacity: "0.4" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0,212,255,0.3)" },
          "50%": {
            boxShadow:
              "0 0 24px rgba(0,212,255,0.6), 0 0 48px rgba(0,212,255,0.2)",
          },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },

      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-up": "slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-down": "slide-down 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer: "shimmer 2s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        float: "float 3s ease-in-out infinite",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
        "600": "600ms",
      },

      backdropBlur: {
        xs: "2px",
        "4xl": "80px",
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
