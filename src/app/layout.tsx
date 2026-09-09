import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { asTheme, THEME_COOKIE } from "@/components/settings/prefs";
import { THEME_BOOTSTRAP } from "@/components/theme/apply-theme";
import { ThemeSync } from "@/components/theme/ThemeSync";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = asTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeSync theme={theme} />
        {children}
      </body>
    </html>
  );
}
