import { formatMoney } from "../../../lib/utils/money";
import type { ServicePackageInput } from "../../../types/servicePackage";

type PreviewService = { name: string; description?: string | null };

export function PackagePreview({ servicePackage, services = [] }: { servicePackage: ServicePackageInput; services?: PreviewService[] }) {
  const included = Number(servicePackage.included_quarts) || 0;
  const actual = Math.max(included + 1, 1);
  const extraQuarts = Math.max(actual - included, 0);
  const extraTotal = extraQuarts * (Number(servicePackage.extra_quart_price) || 0);
  const cartridgeFee = Number(servicePackage.cartridge_filter_extra_fee) || 0;
  const packageTotal = Number(servicePackage.package_total ?? servicePackage.base_price) || 0;
  const estimatedTotal = packageTotal + extraTotal + cartridgeFee;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--pos-border)] bg-white shadow-sm">
      <div className="border-b border-[var(--pos-border)] bg-gradient-to-r from-[var(--pos-blue)] to-[var(--pos-blue-2)] px-5 py-4 text-white">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/80">Live Ticket Preview</div>
        <div className="mt-1 text-xl font-black">{servicePackage.name || "New Oil Change Package"}</div>
      </div>
      <div className="space-y-4 p-5">
        <div className="space-y-2 text-sm">
        <PreviewRow label="Package Line" value={formatMoney(packageTotal)} />
        {servicePackage.base_service_amount !== null && servicePackage.base_service_amount !== undefined ? <PreviewRow label="Base Service" value={formatMoney(Number(servicePackage.base_service_amount) || 0)} /> : null}
        {servicePackage.disposal_fee_amount ? <PreviewRow label="Disposal Fee Included" value={formatMoney(Number(servicePackage.disposal_fee_amount) || 0)} /> : null}
        <PreviewRow label="Included Quarts" value={`${included || 0} qt`} />
        <PreviewRow label={`Extra Example (${actual} qt actual)`} value={`${extraQuarts} qt × ${formatMoney(Number(servicePackage.extra_quart_price) || 0)} = ${formatMoney(extraTotal)}`} />
        <PreviewRow label="Cartridge Fee" value={formatMoney(cartridgeFee)} />
        </div>
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
          <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Included Services</div>
          {services.length ? (
            <div className="mt-3 space-y-2">
              {services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--pos-text)] shadow-sm">{index + 1}. {service.name}</div>
              ))}
            </div>
          ) : <p className="mt-2 text-sm font-semibold text-[var(--pos-muted)]">No services selected yet.</p>}
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[var(--pos-blue)] px-4 py-3 font-black text-white">
          <span>Estimated Total</span>
          <span>{formatMoney(estimatedTotal)}</span>
        </div>
        <p className="text-xs font-semibold leading-5 text-[var(--pos-muted)]">Oil filters are priced separately from inventory. Imported disposal fees are included in the package line so tickets do not double-charge them.</p>
      </div>
    </section>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--pos-muted)]">{label}</span>
      <strong className="text-right text-[var(--pos-text)]">{value}</strong>
    </div>
  );
}
