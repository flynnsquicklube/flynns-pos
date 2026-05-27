import { initialsForBrand } from "../../lib/branding/brandService";
import type { BrandConfig } from "../../lib/branding/brandTypes";
import flynnsLogoUrl from "../../assets/brand/flynns-quick-lube-logo.png";

type BrandLogoSize = "sm" | "md" | "lg" | "invoice" | "sidebar";

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: "h-9 w-9",
  md: "h-12 w-16",
  lg: "h-16 w-24",
  invoice: "h-[135px] w-[280px]",
  sidebar: "h-20 w-full"
};

interface BrandLogoProps {
  brand?: BrandConfig;
  compact?: boolean;
  size?: BrandLogoSize;
  className?: string;
}

export function BrandLogo({ brand, compact = false, size, className = "" }: BrandLogoProps) {
  const resolvedSize = size ?? (compact ? "sm" : "md");
  const src = brand?.logoPath || flynnsLogoUrl;
  const alt = brand?.logoAltText || "Flynn's Quick Lube";
  const fallbackName = brand?.businessName || "Flynn's Quick Lube";

  if (src) {
    return (
      <span className={`inline-flex ${sizeClasses[resolvedSize]} max-w-full items-center justify-center ${className}`}>
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <span className="hidden rounded-2xl bg-[var(--pos-blue)] px-3 py-2 text-sm font-black text-white pos-glow">
          {initialsForBrand(fallbackName)}
        </span>
      </span>
    );
  }
  return (
    <div className={`${sizeClasses[resolvedSize]} flex items-center justify-center rounded-2xl bg-[var(--pos-blue)] text-sm font-black text-white pos-glow ${className}`}>
      {initialsForBrand(fallbackName)}
    </div>
  );
}
