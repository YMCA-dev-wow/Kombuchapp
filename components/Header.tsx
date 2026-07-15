import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Kombucha maison
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-foreground/80 hover:text-foreground">
            Boutique
          </Link>
          <Link href="/sur-commande" className="text-foreground/80 hover:text-foreground">
            Sur commande
          </Link>
        </nav>
      </div>
    </header>
  );
}
