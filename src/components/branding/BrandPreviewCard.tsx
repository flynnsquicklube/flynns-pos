import type { BrandConfig } from "../../lib/branding/brandTypes";
import { Button } from "../ui/Button";
import { BrandLogo } from "./BrandLogo";

export function BrandPreviewCard({ brand }: { brand: BrandConfig }) {
  return (
    <div className="rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-card)] p-5">
      <div className="flex items-center gap-3">
        <BrandLogo brand={brand} />
        <div>
          <div className="text-lg font-black text-[var(--pos-text)]">{brand.businessName}</div>
          <div className="text-sm text-[var(--pos-muted)]">{brand.appName} · {brand.density}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button>Primary Action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="mt-4 flex gap-2">
        {[brand.primaryColor, brand.secondaryColor, brand.accentColor, brand.successColor, brand.warningColor, brand.dangerColor].map((color) => (
          <span key={color} className="h-8 w-8 rounded-full border border-white/20" style={{ backgroundColor: color }} title={color} />
        ))}
      </div>
    </div>
  );
}
