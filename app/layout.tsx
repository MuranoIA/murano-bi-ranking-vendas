import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./v2.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = { title: "Ranking — Murano" };

export const viewport = {
  themeColor: "#621244",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
