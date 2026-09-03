import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NotifyStockButton } from "@/components/admin/NotifyStockButton";

// Cette page dépend de données live (stock, commandes en attente) et est
// protégée par le proxy (session admin) : elle ne doit jamais être mise
// en cache statiquement au build.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [{ count: recipesCount }, { count: pendingCount }, { data: activeRecipes }] = await Promise.all([
    supabaseAdmin.from("recipes").select("*", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin
      .from("custom_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "en_attente"),
    supabaseAdmin
      .from("recipes")
      .select("id, name, quantity")
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const inStock = (activeRecipes ?? []).filter((r) => r.quantity > 0);
  const outOfStock = (activeRecipes ?? []).filter((r) => r.quantity <= 0);

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

      <div className="space-y-3">
        <p className="text-sm font-medium">Stock actuel</p>
        {inStock.length === 0 ? (
          <p className="text-sm text-muted">Tout est en rupture de stock pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {inStock.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/60 p-3"
              >
                <p className="font-medium">{r.name}</p>
                <p className="shrink-0 text-sm text-muted">
                  {r.quantity} bouteille{r.quantity > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {outOfStock.length > 0 && (
          <details className="rounded-xl border border-border bg-white/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Goûts en rupture de stock ({outOfStock.length})
            </summary>
            <div className="mt-2 space-y-2">
              {outOfStock.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white/40 p-2 text-sm text-muted"
                >
                  <p>{r.name}</p>
                  <p className="shrink-0">Rupture</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <NotifyStockButton />
    </div>
  );
}
