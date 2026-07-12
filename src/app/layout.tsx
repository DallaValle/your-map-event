import type { Metadata, Viewport } from "next";
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
  title: {
    default: "Your Map Event",
    template: "%s | Your Map Event",
  },
  description:
    "Interactive event maps for teams: publish a mobile map of your event with points of interest, and let attendees find their way.",
  applicationName: "Your Map Event",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Your Map Event",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Full-bleed maps under the iOS notch; components pad with safe-area insets.
  viewportFit: "cover",
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
        {children}
      </body>
    </html>
  );
}
