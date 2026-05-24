import { formatMoney } from "../../lib/utils/money";
import type { OilSelectionSuggestion } from "../../lib/domain/services/oilSelection";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";
import type { PackagePricingBreakdown } from "../../lib/utils/pricing";
import type { ServicePackage } from "../../types/servicePackage";

interface PackageSelectionsSummaryProps {
  servicePackage: ServicePackage;
  pricing: PackagePricingBreakdown;
  selectedOilFilter: OilFilterSuggestion | null;
  filterChoice: string | null;
  selectedOil: OilSelectionSuggestion | null;
  actualQuarts: string;
  missing: string[];
}

export function PackageSelectionsSummary({ servicePackage, pricing, selectedOilFilter, filterChoice, selectedOil, actualQuarts, missing }: PackageSelectionsSummaryProps) {
  const filterLabel = filterChoice === "customer_supplied"
    ? "Customer supplied filter"
    : filterChoice === "no_filter"
      ? "No filter"
      : selectedOilFilter?.sku ?? selectedOilFilter?.productId ?? selectedOilFilter?.name ?? "Not selected";
  return (
    <aside className="sticky top-4 h-fit rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-5">
      <h3 className="text-xl font-black text-[var(--pos-text)]">Package Selections</h3>
      <div className="mt-1 text-sm text-[var(--pos-muted)]">{servicePackage.name}</div>
      <div className="mt-5 space-y-3 text-sm">
        <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-3">
          <div className="font-black text-[var(--pos-text)]">Engine Oil Filter Remove & Replace</div>
          <div className="mt-1 text-[var(--pos-muted)]">{filterLabel} · 1 EA · Included</div>
        </div>
        <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-3">
          <div className="font-black text-[var(--pos-text)]">Engine Oil Drain & Refill</div>
          <div className="mt-1 text-[var(--pos-muted)]">{selectedOil?.sku ?? selectedOil?.name ?? servicePackage.oil_type ?? "Oil"} · {actualQuarts || servicePackage.included_quarts} QT</div>
          <div className="mt-1 text-[var(--pos-muted)]">Included {servicePackage.included_quarts} QT · Extra {pricing.extraQuarts} QT</div>
        </div>
      </div>
      {missing.length ? (
        <div className="mt-4 rounded-xl border border-[var(--pos-warning)]/40 bg-yellow-500/10 p-3 text-sm font-semibold text-[var(--pos-warning)]">
          {missing.join(" ")}
        </div>
      ) : null}
      <div className="mt-5 space-y-2 border-t border-[var(--pos-border)] pt-4 text-sm">
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Package</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(pricing.packageBase)}</span></div>
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Extra quarts</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(pricing.extraQuartTotal)}</span></div>
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Filter fee</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(pricing.filterFee)}</span></div>
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Tax estimate</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(pricing.taxTotal)}</span></div>
        <div className="flex justify-between text-xl font-black text-[var(--pos-blue-2)]"><span>Total</span><span>{formatMoney(pricing.total)}</span></div>
      </div>
    </aside>
  );
}
