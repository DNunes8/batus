import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { studio } from "@/lib/studio.config";
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
  title: `${studio.fullName} — ${studio.tagline}`,
  description: `${studio.fullName}: ${studio.tagline}. Marca a tua aula online.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={studio.locale.primary}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
