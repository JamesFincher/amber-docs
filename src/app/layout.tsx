import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Telemetry } from "@/components/Telemetry";

export const metadata: Metadata = {
  title: "Amber Docs",
  description: "AI-native docs workspace for Amber Protocol",
};

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="en" className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}>
      <body className="antialiased">
        <SiteHeader />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
        <SiteFooter />
        <Telemetry />
        {plausibleDomain ? (
          <Script
            src="https://plausible.io/js/script.js"
            data-domain={plausibleDomain}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
