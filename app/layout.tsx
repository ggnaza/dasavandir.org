import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gor LMS",
  description: "Learning Management System with AI Coach",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
