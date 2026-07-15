import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kombucha maison",
  description: "Commande ton kombucha maison directement en ligne.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-md px-4 py-6 text-center text-xs text-muted">
          <Link href="/admin/login">Espace producteur</Link>
        </footer>
      </body>
    </html>
  );
}
