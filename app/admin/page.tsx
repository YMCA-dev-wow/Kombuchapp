import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NotifyStockButton } from "@/components/admin/NotifyStockButton";

// Cette page depend de donnees live (stock, commandes en attente) et est
// protegee par le proxy (session admin) : elle ne doit jamais etre mise
// en cache statiquement au build.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [{ count: recipesCount }, { count: pendingCount }, { data: lowStock }] = await Promise.all([
    supabaseAdmin.from("recipes").select("*", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin
      .from("custom_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "en_attente"),
    supabaseAdmin
      .from("recipes")
      .select("id, name, quantity")
      .eq("active", true)
      .lte("quantity", 2)
      .order("quantity", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/recipes"
          className="rounded-xl border border-border bg-white/60 p-4"
        >
          <p className="text-2xl font-semibold">{recipesCount ?? 0}</p>
          <p className="text-sm text-muted">recettes actives</p>
        </Link>
        <Link
          href="/admin/commandes"
          className="rounded-xl border border-border bg-white/60 p-4"
        >
          <p className="text-2xl font-semibold">{pendingCount ?? 0}</p>
          <p className="text-sm text-muted">demandes en attente</p>
        </Link>
      </div>

      {lowStock && lowStock.length > 0 && (
        <div className="rounded-xl border border-border bg-white/60 p-4">
          <p className="mb-2 text-sm font-medium">Stock bas</p>
          <ul className="space-y-1 text-sm text-muted">
            {lowStock.map((r) => (
              <li key={r.id}>
                {r.name} — {r.quantity} restante{r.quantity > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <NotifyStockButton />
    </div>
  );
}
