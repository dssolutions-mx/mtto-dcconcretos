"use client";

import { Fuel } from "lucide-react";

type FuelTx = {
  id: string;
  quantity_liters?: number | null;
  transaction_date?: string | null;
  diesel_products?: { product_type?: string } | null;
  assets?: { asset_id?: string | null; name?: string | null } | null;
};

type Props = {
  dieselLiters30d: number;
  ureaLiters30d: number;
  recentTransactions: FuelTx[];
};

export function CompositeFuelSummary({
  dieselLiters30d,
  ureaLiters30d,
  recentTransactions,
}: Props) {
  if (dieselLiters30d <= 0 && ureaLiters30d <= 0 && recentTransactions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Fuel className="h-4 w-4 text-amber-600" />
        Combustible (últimos 30 días, componente de carga)
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Diésel: </span>
          <span className="font-semibold tabular-nums">
            {dieselLiters30d.toLocaleString("es-MX", { maximumFractionDigits: 1 })} L
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Urea: </span>
          <span className="font-semibold tabular-nums">
            {ureaLiters30d.toLocaleString("es-MX", { maximumFractionDigits: 1 })} L
          </span>
        </div>
      </div>
      {recentTransactions.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
          {recentTransactions.map((tx) => {
            const pt = tx.diesel_products?.product_type === "urea" ? "Urea" : "Diésel";
            const label = tx.assets?.asset_id || tx.assets?.name || "—";
            const date = tx.transaction_date
              ? new Date(tx.transaction_date).toLocaleDateString("es-MX")
              : "—";
            return (
              <li key={tx.id} className="flex justify-between gap-2">
                <span>
                  {date} · {pt} · {label}
                </span>
                <span className="tabular-nums font-medium text-foreground">
                  {Number(tx.quantity_liters ?? 0).toLocaleString("es-MX")} L
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
