import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/layout/BottomNav";
import { SiteNav } from "@/components/layout/SiteNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Munim",
  description: "Marwari shop intelligence — daily parta, debt engine, and supplier trust score.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-[--background]">
        <SiteNav />
        {/* pb-20 on mobile leaves space for fixed bottom nav (64px + gap) */}
        <div className="flex-1 pb-20 sm:pb-0">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
