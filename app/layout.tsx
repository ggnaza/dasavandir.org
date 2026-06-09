import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dasavandir.org",
  description: "Learning Management System with AI Coach",
  metadataBase: new URL("https://dasavandir.org"),
  openGraph: {
    title: "Dasavandir — Կրթական Կառավարման Հարթակ",
    description: "AI-powered learning management system for modern education.",
    url: "https://dasavandir.org",
    siteName: "Dasavandir",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Dasavandir — Learning Management System",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dasavandir — Կրթական Կառավարման Հարթակ",
    description: "AI-powered learning management system for modern education.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hy">

      <body>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4R312STBWK"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4R312STBWK');
          `}
        </Script>
      </body>
    </html>
  );
}
