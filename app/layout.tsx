import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { copy } from "@/lib/copy";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    url: siteUrl,
    siteName: copy.brand.name,
    type: "website",
    images: [
      {
        url: "/brand/hero-stand-in.jpg",
        alt: "Stand in atmosphere photo for Yuzzy Visa Support",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
