import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./intelligence.css";

export const metadata: Metadata = {
  title: "RFxchange Chassis",
  description: "Reference implementation of the RFxchange operating chassis",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
