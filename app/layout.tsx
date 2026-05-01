import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dasavandir.org",
  description: "Learning Management System with AI Coach",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hy">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
