import type { Metadata, Viewport } from "next";
import NextAuthSessionProvider from "./NextAuthSessionProvider"; // Ensure only one import
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asset Tracking App", // Updated title
  description: "A comprehensive application for tracking personal assets, expenses, and net worth.", // Updated description
  manifest: "/manifest.json", // Corrected line break
  appleWebApp: { // iOS specific PWA settings
    capable: true,
    statusBarStyle: "default", // or "black-translucent"
    title: "AssetApp", // Should match short_name or name from manifest
  },
  icons: { // Add icons here as well for better integration
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [ // For apple-touch-icon
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: [ // For shortcut icons
      { url: "/icons/icon-192x192.png" }
    ]
  },
  // viewport: "minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover", // Example viewport settings
};


export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
