import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: {
      default: "Your Map Event",
      template: "%s | Your Map Event",
    },
    description: t("description"),
    applicationName: "Your Map Event",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Your Map Event",
    },
  };
}

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
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider>
          <ThemeSync theme={theme} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
