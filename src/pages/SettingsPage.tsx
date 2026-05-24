import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/useToast";
import { getElectronBridgeDebug, isDesktopDatabaseAvailable, type ElectronBridgeDebug } from "../lib/db/sqlite";
import { createCatalogItem, listCatalogItems, updateCatalogItem } from "../lib/db/repositories/catalogRepo";
import { getImportHistoryEntry, listImportBatches } from "../lib/db/repositories/importRepo";
import { listPackages, updatePackage } from "../lib/db/repositories/packagesRepo";
import { getLocalStatus, getSetting, setSetting, type LocalStatus } from "../lib/db/repositories/settingsRepo";
import { importDroptopInventory, previewDroptopInventory } from "../lib/import/droptopInventoryImporter";
import { importDroptopOrders, previewDroptopOrders } from "../lib/import/droptopOrdersImporter";
import type { ImportBatch, ImportHistoryEntry, InventoryImportResult, InventoryPreview, OrdersImportResult, OrdersPreview } from "../lib/import/importTypes";
import type { ServiceCatalogItem } from "../types/catalog";
import type { ServicePackage } from "../types/servicePackage";

const tabs = ["Operations", "Import Data", "Company", "Staff", "Services", "Packages", "Coupons", "API/System"];
const integrations = [
  ["MOTOR", "VIN decoding and vehicle data placeholder"],
  ["AWS or Local Storage", "Sticker, PDF, and upload placeholder"],
  ["Stripe", "Payments placeholder"],
  ["QuickBooks", "Finalized order export placeholder"],
  ["Mailgun", "Email placeholder"],
  ["Twilio", "Text placeholder"],
  ["CARFAX", "License plate search and vehicle history placeholder"],
  ["ShowMeTheParts", "Part catalog placeholder"],
  ["Service Champ", "Oil filter vendor placeholder"]
];

export function SettingsPage() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [activeTab, setActiveTab] = useState("Operations");
  const [taxRate, setTaxRate] = useState("0");
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [newCatalogItem, setNewCatalogItem] = useState({ name: "", category: "Filters", base_price: "0", is_fee: false, is_discount: false });
  const [ordersFile, setOrdersFile] = useState<{ name: string; text: string } | null>(null);
  const [inventoryFile, setInventoryFile] = useState<{ name: string; text: string } | null>(null);
  const [ordersPreview, setOrdersPreview] = useState<OrdersPreview | null>(null);
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreview | null>(null);
  const [ordersResult, setOrdersResult] = useState<OrdersImportResult | null>(null);
  const [inventoryResult, setInventoryResult] = useState<InventoryImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ImportHistoryEntry | null>(null);
  const [bridgeDebug, setBridgeDebug] = useState<ElectronBridgeDebug>(() => getElectronBridgeDebug());
  const { notify } = useToast();

  useEffect(() => {
    setBridgeDebug(getElectronBridgeDebug());
    getLocalStatus().then(setStatus).catch(() => setStatus(null));
    getSetting("tax_rate").then((setting) => setTaxRate(setting?.value ?? "0")).catch(() => setTaxRate("0"));
    listPackages().then(setPackages).catch(() => setPackages([]));
    listCatalogItems().then(setCatalogItems).catch(() => setCatalogItems([]));
    listImportBatches().then(setImportHistory).catch(() => setImportHistory([]));
  }, []);

  const readCsvFile = async (file: File): Promise<{ name: string; text: string }> => ({ name: file.name, text: await file.text() });

  const saveTaxRate = async () => {
    await setSetting("tax_rate", taxRate);
    notify({ tone: "success", title: "Tax rate saved", message: `${taxRate}% will be used for new tickets.` });
  };

  const savePackage = async (servicePackage: ServicePackage) => {
    await updatePackage(servicePackage.id, servicePackage);
    setPackages(await listPackages());
    notify({ tone: "success", title: "Package saved", message: servicePackage.name });
  };

  const saveCatalogItem = async (item: ServiceCatalogItem) => {
    await updateCatalogItem(item.id, item);
    setCatalogItems(await listCatalogItems());
    notify({ tone: "success", title: "Catalog item saved", message: item.name });
  };

  const addCatalogItem = async () => {
    if (!newCatalogItem.name.trim()) {
      notify({ tone: "error", title: "Name required", message: "Enter a catalog item name." });
      return;
    }
    await createCatalogItem({
      name: newCatalogItem.name.trim(),
      category: newCatalogItem.category.trim() || "Other",
      base_price: Number(newCatalogItem.base_price) || 0,
      is_fee: newCatalogItem.is_fee ? 1 : 0,
      is_discount: newCatalogItem.is_discount ? 1 : 0,
      taxable: newCatalogItem.is_discount ? 0 : 1,
      active: 1
    });
    setCatalogItems(await listCatalogItems());
    setNewCatalogItem({ name: "", category: "Filters", base_price: "0", is_fee: false, is_discount: false });
    notify({ tone: "success", title: "Catalog item added", message: "Available for new tickets." });
  };

  const previewOrders = async () => {
    if (!ordersFile) return;
    if (!isDesktopDatabaseAvailable()) {
      const message = getElectronBridgeDebug().userAgent.includes("Electron")
        ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
        : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.";
      notify({ tone: "error", title: "SQLite bridge missing", message });
      return;
    }
    try {
      setOrdersPreview(await previewDroptopOrders(ordersFile.text));
      notify({ tone: "success", title: "Orders preview ready", message: ordersFile.name });
    } catch (error) {
      notify({ tone: "error", title: "Orders preview failed", message: error instanceof Error ? error.message : "Unable to parse orders CSV." });
    }
  };

  const runOrdersImport = async () => {
    if (!ordersFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    setImporting(true);
    try {
      const result = await importDroptopOrders(ordersFile.text, ordersFile.name);
      setOrdersResult(result);
      setImportHistory(await listImportBatches());
      notify({ tone: "success", title: "Orders imported", message: `${result.imported} imported, ${result.skipped} skipped.` });
    } catch (error) {
      notify({ tone: "error", title: "Orders import failed", message: error instanceof Error ? error.message : "Unable to import orders." });
    } finally {
      setImporting(false);
    }
  };

  const previewInventory = async () => {
    if (!inventoryFile) return;
    if (!isDesktopDatabaseAvailable()) {
      const message = getElectronBridgeDebug().userAgent.includes("Electron")
        ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
        : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.";
      notify({ tone: "error", title: "SQLite bridge missing", message });
      return;
    }
    try {
      setInventoryPreview(await previewDroptopInventory(inventoryFile.text));
      notify({ tone: "success", title: "Inventory preview ready", message: inventoryFile.name });
    } catch (error) {
      notify({ tone: "error", title: "Inventory preview failed", message: error instanceof Error ? error.message : "Unable to parse inventory CSV." });
    }
  };

  const runInventoryImport = async () => {
    if (!inventoryFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    setImporting(true);
    try {
      const result = await importDroptopInventory(inventoryFile.text, inventoryFile.name);
      setInventoryResult(result);
      setImportHistory(await listImportBatches());
      notify({ tone: "success", title: "Inventory imported", message: `${result.inventoryItemsCreated} created, ${result.inventoryItemsUpdated} updated.` });
    } catch (error) {
      notify({ tone: "error", title: "Inventory import failed", message: error instanceof Error ? error.message : "Unable to import inventory." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
        <p className="text-sm text-slate-500">Shop configuration, services, staff, and integrations.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-3 text-sm font-semibold ${activeTab === tab ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-500 hover:text-slate-900"}`}>{tab}</button>
        ))}
      </div>
      {activeTab === "Operations" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_280px_120px_260px] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Operation</span>
            <span>Address</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="grid grid-cols-[1fr_280px_120px_260px] items-center gap-4 px-5 py-4 text-sm">
            <div>
              <div className="font-bold text-slate-950">Flynn's Quick Lube</div>
              <div className="text-slate-500">Local database: {status?.databaseReady ? "Ready" : "Loading"}</div>
            </div>
            <div className="text-slate-600">1023 Harrison Avenue, Harrison, Ohio 45030</div>
            <div><Badge tone="green">Active</Badge></div>
            <div className="flex gap-2">
              <Button variant="secondary">Till Manager</Button>
              <Button variant="secondary">Settings</Button>
            </div>
          </div>
          <div className="border-t border-slate-200 p-5">
            <h3 className="font-bold text-slate-950">Local Pricing</h3>
            <div className="mt-3 flex max-w-md items-end gap-3">
              <Input label="Tax rate percent" type="number" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} helperText="Example: enter 7.8 for 7.8%." />
              <Button onClick={saveTaxRate}>Save</Button>
            </div>
            <div className="mt-4 text-sm text-slate-500">Database: {status?.databasePath ?? "Electron userData path"} · Pending sync: {status?.syncQueueCount ?? 0}</div>
          </div>
        </Card>
      ) : null}
      {activeTab === "API/System" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map(([name, description]) => (
            <Card key={name} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-950">{name}</h3>
                <Badge>Placeholder</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
            </Card>
          ))}
        </div>
      ) : null}
      {activeTab === "Import Data" ? (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-950">Local SQLite Connection</div>
                <div className="mt-1 text-sm text-slate-500">
                  {bridgeDebug.databaseAvailable
                    ? "Electron SQLite connected."
                    : bridgeDebug.userAgent.includes("Electron")
                      ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
                      : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev."}
                </div>
              </div>
              <Badge tone={bridgeDebug.databaseAvailable ? "green" : "red"}>{bridgeDebug.databaseAvailable ? "Connected" : "Not Connected"}</Badge>
            </div>
            {import.meta.env.DEV ? (
              <div className="mt-3 rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-500">
                isElectronBridgeDetected={String(bridgeDebug.isElectronBridgeDetected)} · databaseAvailable={String(bridgeDebug.databaseAvailable)} · legacyBridgeDetected={String(bridgeDebug.legacyBridgeDetected)} · userAgent={bridgeDebug.userAgent}
              </div>
            ) : null}
          </Card>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-bold text-slate-950">Import Droptop Orders CSV</h3>
              <p className="mt-1 text-sm text-slate-500">Imports finalized order history, customers, vehicles, payments, and service history.</p>
              <input
                className="mt-4 block w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setOrdersFile(loaded);
                    setOrdersPreview(null);
                    setOrdersResult(null);
                  });
                }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={!ordersFile} onClick={previewOrders}>Preview Import</Button>
                <Button disabled={!ordersPreview || importing} onClick={runOrdersImport}>{importing ? "Importing..." : "Run Import"}</Button>
              </div>
              {ordersPreview ? (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Total rows: <strong>{ordersPreview.totalRows}</strong></div>
                    <div>New tickets: <strong>{ordersPreview.estimatedNewTickets}</strong></div>
                    <div>Duplicate tickets skipped: <strong>{ordersPreview.estimatedSkippedDuplicateTickets}</strong></div>
                    <div>Estimated customers: <strong>{ordersPreview.estimatedNewCustomers}</strong></div>
                    <div>Estimated vehicles: <strong>{ordersPreview.estimatedNewVehicles}</strong></div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500">First rows: {ordersPreview.rowsPreview.map((row) => row.values["Order ID"]).filter(Boolean).join(", ") || "None"}</div>
                </div>
              ) : null}
              {ordersResult ? (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  Imported {ordersResult.imported}, skipped {ordersResult.skipped}, failed {ordersResult.failed}. Customers {ordersResult.customersCreated}, vehicles {ordersResult.vehiclesCreated}, tickets {ordersResult.ticketsCreated}, payments {ordersResult.paymentsCreated}, history {ordersResult.serviceHistoryCreated}.
                </div>
              ) : null}
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-bold text-slate-950">Import Droptop Inventory CSV</h3>
              <p className="mt-1 text-sm text-slate-500">Imports product quantities, pricing, vendors, and oil/filter metadata.</p>
              <input
                className="mt-4 block w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setInventoryFile(loaded);
                    setInventoryPreview(null);
                    setInventoryResult(null);
                  });
                }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={!inventoryFile} onClick={previewInventory}>Preview Import</Button>
                <Button disabled={!inventoryPreview || importing} onClick={runInventoryImport}>{importing ? "Importing..." : "Run Import"}</Button>
              </div>
              {inventoryPreview ? (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Total rows: <strong>{inventoryPreview.totalRows}</strong></div>
                    <div>New items: <strong>{inventoryPreview.estimatedNewInventoryItems}</strong></div>
                    <div>Updated items: <strong>{inventoryPreview.estimatedUpdatedInventoryItems}</strong></div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500">First rows: {inventoryPreview.rowsPreview.map((row) => row.values["Product ID"]).filter(Boolean).join(", ") || "None"}</div>
                </div>
              ) : null}
              {inventoryResult ? (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  Imported {inventoryResult.imported}, failed {inventoryResult.failed}. Created {inventoryResult.inventoryItemsCreated}, updated {inventoryResult.inventoryItemsUpdated}.
                </div>
              ) : null}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-slate-950">Import History</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="py-2">File</th><th>Type</th><th>Status</th><th>Imported</th><th>Skipped</th><th>Failed</th><th>Started</th></tr>
                </thead>
                <tbody>
                  {importHistory.map((batch) => (
                    <tr key={batch.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => void getImportHistoryEntry(batch.id).then(setSelectedHistory)}>
                      <td className="py-3 font-semibold text-slate-950">{batch.file_name}</td>
                      <td>{batch.import_type}</td>
                      <td>{batch.status}</td>
                      <td>{batch.rows_imported}</td>
                      <td>{batch.rows_skipped}</td>
                      <td>{batch.rows_failed}</td>
                      <td>{new Date(batch.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedHistory ? (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-bold text-slate-950">{selectedHistory.file_name}</div>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-white p-3 text-xs text-slate-600">{selectedHistory.summary_json ?? "{}"}</pre>
                {selectedHistory.errors.length ? (
                  <div className="mt-3 space-y-2">
                    {selectedHistory.errors.slice(0, 10).map((error) => (
                      <div key={error.id} className="rounded border border-red-100 bg-red-50 p-2 text-red-700">Row {error.row_number ?? "-"}: {error.message}</div>
                    ))}
                  </div>
                ) : <div className="mt-3 text-slate-500">No errors recorded.</div>}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {activeTab === "Packages" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.5fr_110px_120px_120px_130px_90px_90px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Package</span><span>Base</span><span>Included qt</span><span>Extra qt</span><span>Cartridge</span><span>Active</span><span>Save</span>
          </div>
          {packages.map((servicePackage, index) => (
            <div key={servicePackage.id} className="grid grid-cols-[1.5fr_110px_120px_120px_130px_90px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
              <div>
                <div className="font-bold text-slate-950">{servicePackage.name}</div>
                <div className="text-xs text-slate-500">{[servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" / ")}</div>
              </div>
              <Input type="number" step="0.01" value={servicePackage.base_price} onChange={(event) => setPackages((current) => current.map((pkg, i) => i === index ? { ...pkg, base_price: Number(event.target.value) || 0 } : pkg))} />
              <Input type="number" step="0.1" value={servicePackage.included_quarts} onChange={(event) => setPackages((current) => current.map((pkg, i) => i === index ? { ...pkg, included_quarts: Number(event.target.value) || 0 } : pkg))} />
              <Input type="number" step="0.01" value={servicePackage.extra_quart_price} onChange={(event) => setPackages((current) => current.map((pkg, i) => i === index ? { ...pkg, extra_quart_price: Number(event.target.value) || 0 } : pkg))} />
              <Input type="number" step="0.01" value={servicePackage.cartridge_filter_extra_fee} onChange={(event) => setPackages((current) => current.map((pkg, i) => i === index ? { ...pkg, cartridge_filter_extra_fee: Number(event.target.value) || 0 } : pkg))} />
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={Boolean(servicePackage.active)} onChange={(event) => setPackages((current) => current.map((pkg, i) => i === index ? { ...pkg, active: event.target.checked ? 1 : 0 } : pkg))} />
                Active
              </label>
              <Button size="sm" onClick={() => void savePackage(servicePackage)}>Save</Button>
            </div>
          ))}
        </Card>
      ) : null}
      {activeTab === "Services" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold text-slate-950">Add Catalog Item</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px_130px_100px_120px_auto]">
              <Input label="Name" value={newCatalogItem.name} onChange={(event) => setNewCatalogItem((current) => ({ ...current, name: event.target.value }))} />
              <Input label="Category" value={newCatalogItem.category} onChange={(event) => setNewCatalogItem((current) => ({ ...current, category: event.target.value }))} />
              <Input label="Base price" type="number" step="0.01" value={newCatalogItem.base_price} onChange={(event) => setNewCatalogItem((current) => ({ ...current, base_price: event.target.value }))} />
              <label className="mt-7 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={newCatalogItem.is_fee} onChange={(event) => setNewCatalogItem((current) => ({ ...current, is_fee: event.target.checked, is_discount: event.target.checked ? false : current.is_discount }))} /> Fee</label>
              <label className="mt-7 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={newCatalogItem.is_discount} onChange={(event) => setNewCatalogItem((current) => ({ ...current, is_discount: event.target.checked, is_fee: event.target.checked ? false : current.is_fee }))} /> Discount</label>
              <Button className="mt-7" onClick={addCatalogItem}>Add</Button>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1.4fr_140px_110px_90px_90px_90px_90px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <span>Name</span><span>Category</span><span>Price</span><span>Fee</span><span>Discount</span><span>Active</span><span>Save</span>
            </div>
            {catalogItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1.4fr_140px_110px_90px_90px_90px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
                <Input value={item.name} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, name: event.target.value } : catalogItem))} />
                <Input value={item.category} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, category: event.target.value } : catalogItem))} />
                <Input type="number" step="0.01" value={item.base_price} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, base_price: Number(event.target.value) || 0 } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.is_fee)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, is_fee: event.target.checked ? 1 : 0, is_discount: event.target.checked ? 0 : catalogItem.is_discount } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.is_discount)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, is_discount: event.target.checked ? 1 : 0, is_fee: event.target.checked ? 0 : catalogItem.is_fee } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.active)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, active: event.target.checked ? 1 : 0 } : catalogItem))} />
                <Button size="sm" onClick={() => void saveCatalogItem(item)}>Save</Button>
              </div>
            ))}
          </Card>
        </div>
      ) : null}
      {activeTab !== "Operations" && activeTab !== "API/System" ? (
        activeTab !== "Packages" && activeTab !== "Services" && activeTab !== "Import Data" ? <Card className="p-8 text-sm text-slate-500">{activeTab} settings will be configured in a later workflow step.</Card> : null
      ) : null}
    </section>
  );
}
