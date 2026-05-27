import { Copy, Pencil, Power } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { formatMoney } from "../../../lib/utils/money";
import type { ServicePackage } from "../../../types/servicePackage";

export function PackageCard({
  servicePackage,
  onEdit,
  onDuplicate,
  onToggleActive
}: {
  servicePackage: ServicePackage;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
}) {
  const packageTotal = servicePackage.package_total ?? servicePackage.base_price;
  const baseService = servicePackage.base_service_amount ?? servicePackage.base_price;
  const disposalFee = servicePackage.disposal_fee_amount ?? 0;
  const services = [servicePackage.service_1_name, servicePackage.service_2_name].filter(Boolean).join(", ");
  const subhead = servicePackage.package_group_name ?? ([servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" · ") || "Service package");
  const interval = [
    servicePackage.mileage_interval ? `${servicePackage.mileage_interval.toLocaleString()} miles` : null,
    servicePackage.time_interval_months ? `${servicePackage.time_interval_months} months` : null
  ].filter(Boolean).join(" / ");
  return (
    <Card className="overflow-hidden" variant="interactive">
      <div className="h-1 bg-gradient-to-r from-[var(--pos-blue)] to-[var(--pos-blue-2)]" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black tracking-tight text-[var(--pos-text)]">{servicePackage.name}</h3>
            <p className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">{subhead}</p>
          </div>
          <Badge tone={servicePackage.active ? "green" : "slate"}>{servicePackage.active ? "Active" : "Inactive"}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <PackageStat label="Package Total" value={formatMoney(packageTotal)} strong />
          <PackageStat label="Base Service" value={formatMoney(baseService)} />
          <PackageStat label="Disposal Fee" value={disposalFee ? formatMoney(disposalFee) : "None"} />
          <PackageStat label="Interval" value={interval || "Not set"} />
        </div>
        {services ? <p className="mt-4 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-3 text-sm font-semibold text-[var(--pos-muted)]">Services: {services}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" icon={<Pencil size={15} />} onClick={onEdit}>Edit</Button>
          <Button variant="secondary" icon={<Copy size={15} />} onClick={onDuplicate}>Duplicate</Button>
          <Button variant={servicePackage.active ? "subtle" : "primary"} icon={<Power size={15} />} onClick={onToggleActive}>
            {servicePackage.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PackageStat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-[var(--pos-muted)]">{label}</div>
      <div className={`mt-1 ${strong ? "text-xl" : "text-base"} font-black text-[var(--pos-text)]`}>{value}</div>
    </div>
  );
}
