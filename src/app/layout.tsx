import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const REPOSITORY_URL = "https://github.com/ksongProjects/collapse";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Collapse Game",
  description:
    "Collapse Game is a puzzle game with leaderboards for each difficulty.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="app-body">
        <main className="app-main">{children}</main>
        <footer className="site-footer">
          <div className="panel site-footer-panel">
            <p className="site-footer-copy">Copyright (c) {new Date().getFullYear()} ksongProjects</p>
            <a
              className="site-footer-link"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
            >
              View source
            </a>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
