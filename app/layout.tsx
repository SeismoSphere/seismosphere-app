import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TopNav from "./components/top-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SeismoSphere Dashboard",
  description: "Dashboard peta cluster gempa bumi berbasis API backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TopNav />
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
