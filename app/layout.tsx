import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkMatch — share music across every service",
  description:
    "Paste a music link from Spotify, Apple Music, YouTube Music, Tidal, Deezer or more — get matching links on every other service.",
};

export const viewport: Viewport = {
  themeColor: "#16130f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
