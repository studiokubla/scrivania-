import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./globals.css";

// Grottesca geometrica, molti pesi, cifre tabellari: regge sia i titoli in
// grassetto stretto sia le tabelle di numeri, che qui sono la maggior parte.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dynasty League",
  description: "Gestionale della Dynasty League: rose, contratti, tetto salariale, mercato e capitale.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3EE68C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
