import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "@/context/ThemeContext";
import { pwaConfig } from "@/lib/constants/pwa";
import { buildThemeInitScript } from "@/lib/theme/theme";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const themeInitScript = buildThemeInitScript();

export const metadata: Metadata = {
  title: {
    default: "Dotly",
    template: "%s | Dotly",
  },
  description: pwaConfig.description,
  applicationName: pwaConfig.name,
  manifest: "/manifest.webmanifest",
};

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
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bgLuminous text-slate-900 dark:bg-bgOnyx dark:text-white transition-colors">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
