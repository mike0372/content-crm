import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SidebarLayout } from "@/components/SidebarLayout";
import { StaticBackground } from "@/components/ui/StaticBackground";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoPilot AI — Content Studio",
  description: "Local-first content production pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans bg-base text-zinc-200 antialiased`}
      >
        <StaticBackground />
        <div className="relative z-0 min-h-screen">
          <SidebarLayout>{children}</SidebarLayout>
        </div>
      </body>
    </html>
  );
}
