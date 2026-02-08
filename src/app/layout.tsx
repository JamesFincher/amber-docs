import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amber Protocol Docs",
  description: "Public docs hub for Amber Protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
