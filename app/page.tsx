import { StockList } from "@/components/StockList";

export default function HomePage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">La boutique</h1>
      <p className="mb-5 text-sm text-muted">
        Stock disponible en direct. Une recette qui t&apos;interesse mais qui n&apos;est pas encore prete ?
        Passe par la section{" "}
        <a href="/sur-commande" className="text-accent underline">
          Sur commande
        </a>
        .
      </p>
      <StockList />
    </div>
  );
}
