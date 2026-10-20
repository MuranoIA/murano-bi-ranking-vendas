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
    <html lang="pt-BR" className={inter.className} suppressHydrationWarning>
      <head>
        {/* Dentro do iframe do hub (ou do Pulse/VendasPro), o <html> é marcado antes da primeira
            pintura: o v2.css passa a rolagem para o <body> (barra presa no iPhone). */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(window.self!==window.top)document.documentElement.dataset.embutido='hub'}catch(e){document.documentElement.dataset.embutido='hub'}" }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
