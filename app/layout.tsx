import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RetroGroove — Disco & Rock en Vivo",
  description:
    "RetroGroove es tu banda de covers de disco y rock. Mira nuestro repertorio, pide tu canción favorita y entérate de nuestros próximos shows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
