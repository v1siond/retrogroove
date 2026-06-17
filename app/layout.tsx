import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RetroGroove — Disco & Rock en Vivo",
  description: "RetroGroove es tu banda de covers de disco y rock. Mira nuestro repertorio, pide tu canción favorita y entérate de nuestros próximos shows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
