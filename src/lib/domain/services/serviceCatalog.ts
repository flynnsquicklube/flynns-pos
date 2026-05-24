import type { ServiceCatalogItem } from "../../../types/catalog";

export function groupCatalogByCategory(items: ServiceCatalogItem[]): Record<string, ServiceCatalogItem[]> {
  return items.reduce<Record<string, ServiceCatalogItem[]>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});
}

