"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return null;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const links = [
    { href: "/admin", label: "Tableau de bord" },
    { href: "/admin/recipes", label: "Recettes" },
    { href: "/admin/commandes", label: "Commandes" },
  ];

  return (
    <div className="mb-6 flex items-center justify-between border-b border-border pb-3">
      <nav className="flex gap-4 text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "font-medium text-accent" : "text-foreground/70"}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <button onClick={handleLogout} className="text-xs text-muted underline">
        Deconnexion
      </button>
    </div>
  );
}
