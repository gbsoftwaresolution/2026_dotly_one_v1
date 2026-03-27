import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "@/context/ThemeContext";
import { RuntimeErrorListener } from "@/components/observability/runtime-error-listener";
import { ToastViewport } from "@/components/shared/toast-viewport";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { pwaConfig } from "@/lib/constants/pwa";
import { buildThemeInitScript } from "@/lib/theme/theme";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const themeInitScript = buildThemeInitScript();

// ── Metadata ────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: dotlyPositioning.seo.title,
    template: "%s | Dotly",
  },
  description: pwaConfig.description,
  applicationName: pwaConfig.name,
  manifest: "/manifest.webmanifest",

  // Apple PWA
  appleWebApp: {
    capable: true,
    title: pwaConfig.name,
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/splash/apple-splash-2048-2732.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1668-2388.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1290-2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1179-2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1170-2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },

  // Open Graph / social
  openGraph: {
    type: "website",
    siteName: "Dotly",
    title: dotlyPositioning.seo.title,
    description: pwaConfig.description,
  },

  // Icons
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },

  other: {
    // Android chrome / PWA
    "mobile-web-app-capable": "yes",
  },
};

// ── Viewport ────────────────────────────────────────────────
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // Enable safe area insets
};

// ── Root Layout ─────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        {/* Block render until theme class is applied — prevents FOUT */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="bg-background text-foreground transition-theme overflow-x-hidden"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <RuntimeErrorListener />
          {children}
          <ToastViewport />
        </ThemeProvider>
      </body>
    </html>
  );
}
