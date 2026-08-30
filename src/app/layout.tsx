import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Manrope } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";

const display = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Society Records — Property & Transfer Management",
  description:
    "Society Property, Plot Transfer & Records Management System with immutable ownership history.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Society Records",
  },
};

export const viewport: Viewport = {
  themeColor: "#115e59",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
      </body>
    </html>
  );
}
