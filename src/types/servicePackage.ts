export type PackageFilterType = "standard" | "cartridge" | "customer_supplied" | "none";

export interface ServicePackage {
  id: string;
  external_source: string | null;
  external_id: string | null;
  name: string;
  internal_name: string | null;
  description: string | null;
  category: string;
  base_price: number;
  package_total: number | null;
  base_service_amount: number | null;
  disposal_fee_amount: number | null;
  disposal_fee_quantity: number | null;
  mileage_interval: number | null;
  time_interval_months: number | null;
  service_1_id: string | null;
  service_1_name: string | null;
  service_2_id: string | null;
  service_2_name: string | null;
  services_json: string | null;
  package_group_name: string | null;
  oil_brand: string | null;
  oil_type: string | null;
  included_quarts: number;
  extra_quart_price: number;
  included_filter_type: string;
  cartridge_filter_extra_fee: number;
  max_included_filter_cost: number | null;
  taxable: number;
  active: number;
  visible_in_start_ticket?: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface ServicePackageInput {
  external_source?: string | null;
  external_id?: string | null;
  name: string;
  internal_name?: string | null;
  description?: string | null;
  category: string;
  base_price: number;
  package_total?: number | null;
  base_service_amount?: number | null;
  disposal_fee_amount?: number | null;
  disposal_fee_quantity?: number | null;
  mileage_interval?: number | null;
  time_interval_months?: number | null;
  service_1_id?: string | null;
  service_1_name?: string | null;
  service_2_id?: string | null;
  service_2_name?: string | null;
  services_json?: string | null;
  package_group_name?: string | null;
  oil_brand?: string | null;
  oil_type?: string | null;
  included_quarts: number;
  extra_quart_price: number;
  included_filter_type?: string;
  cartridge_filter_extra_fee: number;
  max_included_filter_cost?: number | null;
  taxable?: number;
  active?: number;
  visible_in_start_ticket?: number;
  sort_order?: number;
}

export interface TicketPackageDetailsInput {
  package_id: string;
  package_name: string;
  oil_brand: string | null;
  oil_type: string | null;
  included_quarts: number;
  actual_quarts: number;
  extra_quarts: number;
  extra_quart_price: number;
  extra_quart_total: number;
  filter_type: PackageFilterType;
  cartridge_filter_extra_fee: number;
  oil_filter_inventory_item_id?: string | null;
  oil_filter_sku?: string | null;
  oil_filter_name?: string | null;
  oil_filter_source?: string | null;
  oil_inventory_item_id?: string | null;
  oil_sku?: string | null;
  oil_name?: string | null;
  oil_source?: string | null;
  package_base_price: number;
  package_total: number;
}

export interface TicketPackageDetails extends TicketPackageDetailsInput {
  id: string;
  ticket_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
