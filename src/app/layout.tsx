import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const serifFont = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
});

const sansFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CronCruise — Elegant Scheduler Dashboard",
  description: "A tailored, high-performance distributed task scheduler with custom design principles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serifFont.variable} ${sansFont.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF7F2] text-[#2F2A24] dark:bg-[#17140F] dark:text-[#EAE2D5]">{children}</body>
    </html>
  );
}
