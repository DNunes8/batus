import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SearchParamToast } from "@/components/search-param-toast";
import { studio } from "@/lib/studio.config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: `${studio.fullName} — ${studio.tagline}`,
  description: `${studio.fullName}: ${studio.tagline}. Marca a tua aula online.`,
  applicationName: studio.fullName,
  appleWebApp: {
    capable: true,
    title: studio.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // viewportFit covers iPhone notch / safe-area, lets us paint into the
  // status bar when launched as PWA.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={studio.locale.primary}
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster position="top-center" />
        <Suspense fallback={null}>
          <SearchParamToast />
        </Suspense>
      </body>
    </html>
  );
}
