import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { useToast } from "../ui/useToast";
import { getLocalVehicleInfo, getManualVehicleInfoSearchLinks, getVehicleInfoLookupHistory, getVehicleInfoLookupStatus, getVinVehicleData, searchWebVehicleInfo, type LocalHistoryVehicleInfo } from "../../lib/integrations/vehicleInfo/vehicleInfoLookup.service";
import { saveLookupHistory, saveVehicleInfoDefaults, type VehicleInfoLookupHistoryRow, type VehicleInfoDefaultsInput } from "../../lib/db/repositories/vehicleInfoLookupRepo";
import type { VehicleInfoLookupContext, VehicleInfoLookupResult } from "../../lib/integrations/vehicleInfo/vehicleInfo.types";

type Tab = "local" | "vin" | "web" | "defaults";

interface VehicleInfoLookupModalProps {
  open: boolean;
  context: VehicleInfoLookupContext;
  currentDefaults?: Partial<VehicleInfoDefaultsInput>;
  onClose: () => void;
  onSaved?: (defaults: VehicleInfoDefaultsInput) => void;
}

function emptyDefaults(): VehicleInfoDefaultsInput {
  return {
    oil_capacity: null,
    oil_type: null,
    oil_filter_sku: null,
    oil_filter_inventory_item_id: null,
    air_filter_sku: null,
    cabin_filter_sku: null,
    vehicle_info_notes: null,
    vehicle_info_source_url: null,
    vehicle_info_source_title: null
  };
}

function vehicleTitle(context: VehicleInfoLookupContext) {
  return [context.year, context.make, context.model, context.engine].filter(Boolean).join(" ") || context.vin || "Vehicle";
}

export function VehicleInfoLookupModal({ open, context, currentDefaults, onClose, onSaved }: VehicleInfoLookupModalProps) {
  const [tab, setTab] = useState<Tab>("local");
  const [localInfo, setLocalInfo] = useState<LocalHistoryVehicleInfo | null>(null);
  const [vinInfo, setVinInfo] = useState<string | null>(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [history, setHistory] = useState<VehicleInfoLookupHistoryRow[]>([]);
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<VehicleInfoLookupResult[]>([]);
  const [webMessage, setWebMessage] = useState("");
  const [webLoading, setWebLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("");
  const [form, setForm] = useState<VehicleInfoDefaultsInput>(() => ({ ...emptyDefaults(), ...currentDefaults }));
  const { notify } = useToast();

  const manualLinks = useMemo(() => getManualVehicleInfoSearchLinks(context), [context]);
  const vehicleId = context.vehicleId ?? context.vehicle?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyDefaults(), ...currentDefaults });
    setWebQuery(`${vehicleTitle(context)} oil capacity oil filter`.trim());
    getLocalVehicleInfo(context).then(setLocalInfo).catch(() => setLocalInfo(null));
    getVehicleInfoLookupHistory(vehicleId).then(setHistory).catch(() => setHistory([]));
    getVehicleInfoLookupStatus().then((status) => setGoogleStatus(status.message)).catch(() => setGoogleStatus("Manual search links are available."));
  }, [context, currentDefaults, open, vehicleId]);

  if (!open) return null;

  const applyPartial = (defaults: Partial<VehicleInfoDefaultsInput>) => {
    setForm((current) => ({ ...current, ...defaults }));
    setTab("defaults");
  };

  const saveDefaults = async () => {
    const payload = {
      ...form,
      oil_capacity: form.oil_capacity ? Number(form.oil_capacity) : null
    };
    if (vehicleId) {
      await saveVehicleInfoDefaults(vehicleId, payload);
      await saveLookupHistory({
        vehicle_id: vehicleId,
        vin: context.vin ?? null,
        year: context.year ?? null,
        make: context.make ?? null,
        model: context.model ?? null,
        engine: context.engine ?? null,
        query: webQuery || "manual local vehicle info",
        provider: "local_history",
        source_url: payload.vehicle_info_source_url,
        source_title: payload.vehicle_info_source_title,
        selected_json: payload,
        status: "saved"
      });
    }
    onSaved?.(payload);
    notify({ tone: "success", title: "Vehicle defaults saved", message: vehicleId ? "Future tickets can use these specs." : "Current ticket suggestions were updated." });
    onClose();
  };

  const loadVin = async () => {
    setVinLoading(true);
    try {
      const result = await getVinVehicleData(context);
      if (result?.ok && result.data) {
        const decode = result.data;
        setVinInfo(`${decode.year ?? ""} ${decode.make ?? ""} ${decode.model ?? ""} ${decode.trim ?? ""} · Engine ${decode.engineModel ?? decode.engineDisplacementL ?? "-"} · ${decode.fuelType ?? "-"} · ${decode.source}`);
      } else {
        setVinInfo(result?.message ?? "VIN decode is unavailable. Manual entry is still available.");
      }
    } finally {
      setVinLoading(false);
    }
  };

  const runWebSearch = async () => {
    if (!webQuery.trim()) return;
    setWebLoading(true);
    try {
      const result = await searchWebVehicleInfo(webQuery.trim());
      setWebMessage(result.message);
      setWebResults(result.results);
      if (!result.ok) notify({ tone: "info", title: "Manual search available", message: result.message });
    } finally {
      setWebLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <Card className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden p-0 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--pos-border)] p-5">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue)]">Vehicle Info Lookup</div>
            <h2 className="mt-1 text-2xl font-black text-[var(--pos-text)]">{vehicleTitle(context)}</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Local history first. Web suggestions must be verified before saving.</p>
          </div>
          <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--pos-border)] bg-white text-[var(--pos-text)]" onClick={onClose} aria-label="Close vehicle info lookup">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-[var(--pos-border)] p-3">
          {[
            ["local", "Local History"],
            ["vin", "VIN / Vehicle Data"],
            ["web", "Web Search"],
            ["defaults", "Saved Defaults"]
          ].map(([key, label]) => (
            <button key={key} className={`min-h-12 rounded-xl px-4 font-black ${tab === key ? "bg-[var(--pos-blue)] text-white" : "bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]"}`} onClick={() => setTab(key as Tab)}>
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "local" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-xl font-black text-[var(--pos-text)]">Recommended From Shop History</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <InfoRow label="Last oil change" value={localInfo?.lastOilChangeDate ? new Date(localInfo.lastOilChangeDate).toLocaleDateString() : "No local history"} />
                  <InfoRow label="Last mileage" value={localInfo?.lastMileage ? `${localInfo.lastMileage.toLocaleString()} mi` : "Not recorded"} />
                  <InfoRow label="Oil type" value={localInfo?.lastOilType ?? "Not recorded"} />
                  <InfoRow label="Actual quarts" value={localInfo?.lastActualQuarts ? `${localInfo.lastActualQuarts} qt` : "Not recorded"} />
                  <InfoRow label="Oil filter" value={[localInfo?.lastOilFilterSku, localInfo?.lastOilFilterName].filter(Boolean).join(" · ") || "Not recorded"} />
                  <InfoRow label="Confidence" value={`${localInfo?.confidence ?? "low"} · ${localInfo?.source ?? "local"}`} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => applyPartial({ oil_capacity: localInfo?.lastActualQuarts ?? null })}>Use Last Oil Capacity</Button>
                  <Button variant="secondary" onClick={() => applyPartial({ oil_type: localInfo?.lastOilType ?? null })}>Use Last Oil Type</Button>
                  <Button variant="secondary" onClick={() => applyPartial({ oil_filter_sku: localInfo?.lastOilFilterSku ?? null })}>Use Last Oil Filter</Button>
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-xl font-black text-[var(--pos-text)]">Prior Parts and Lookup History</h3>
                <div className="mt-3 space-y-2 text-sm text-[var(--pos-muted)]">
                  {(localInfo?.previousFilters ?? []).slice(0, 8).map((part, index) => (
                    <div key={`${part.sku}-${index}`} className="rounded-xl border border-[var(--pos-border)] bg-white p-3">
                      <strong className="text-[var(--pos-text)]">{part.sku ?? "No SKU"}</strong> {part.name ?? ""} · {part.source}
                    </div>
                  ))}
                  {!(localInfo?.previousFilters ?? []).length ? <div>No prior filter records found.</div> : null}
                  {history.slice(0, 4).map((row) => <div key={row.id} className="rounded-xl bg-[var(--pos-bg-soft)] p-3">{new Date(row.created_at).toLocaleString()} · {row.provider} · {row.status}</div>)}
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "vin" ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-[var(--pos-text)]">VIN / Vehicle Data</h3>
                  <p className="text-sm text-[var(--pos-muted)]">{context.vin ? `VIN ${context.vin}` : "No VIN is available for this vehicle."}</p>
                </div>
                <Button disabled={!context.vin || vinLoading} onClick={loadVin}>{vinLoading ? "Decoding..." : "Decode VIN"}</Button>
              </div>
              {vinInfo ? <div className="mt-4 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4 text-sm text-[var(--pos-text)]">{vinInfo}</div> : null}
              <p className="mt-4 text-sm text-[var(--pos-muted)]">VIN data can identify the vehicle and engine. It usually does not provide oil capacity or filter fitment.</p>
            </Card>
          ) : null}

          {tab === "web" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="p-5">
                <h3 className="text-xl font-black text-[var(--pos-text)]">Manual Search Links</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">These open a browser search. Employees verify results and enter only the needed specs.</p>
                <div className="mt-4 grid gap-2">
                  {manualLinks.slice(0, 9).map((link) => (
                    <a key={link.id} className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--pos-border)] bg-white px-4 text-sm font-bold text-[var(--pos-blue)]" href={link.url} target="_blank" rel="noreferrer">
                      <span className="truncate">{link.query}</span>
                      <ExternalLink size={16} />
                    </a>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-xl font-black text-[var(--pos-text)]">Optional JSON Search</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">{googleStatus}</p>
                <Input className="mt-4" label="Search query" inputSize="touch" value={webQuery} onChange={(event) => setWebQuery(event.target.value)} />
                <Button className="mt-3 w-full" icon={<Search size={16} />} disabled={webLoading} onClick={runWebSearch}>{webLoading ? "Searching..." : "Search Configured Provider"}</Button>
                {webMessage ? <div className="mt-3 text-sm text-[var(--pos-muted)]">{webMessage}</div> : null}
                <div className="mt-3 space-y-2">
                  {webResults.map((result) => (
                    <button key={result.id} className="w-full rounded-xl border border-[var(--pos-border)] bg-white p-3 text-left text-sm" onClick={() => applyPartial({
                      oil_capacity: result.suggestedOilCapacity ?? null,
                      oil_type: result.suggestedOilType ?? null,
                      oil_filter_sku: result.suggestedOilFilter ?? null,
                      air_filter_sku: result.suggestedAirFilter ?? null,
                      cabin_filter_sku: result.suggestedCabinFilter ?? null,
                      vehicle_info_source_url: result.sourceUrl,
                      vehicle_info_source_title: result.sourceTitle,
                      vehicle_info_notes: result.note ?? null
                    })}>
                      <div className="font-black text-[var(--pos-text)]">{result.sourceTitle}</div>
                      <div className="mt-1 text-[var(--pos-muted)]">{result.snippet}</div>
                      <div className="mt-2 font-bold text-[var(--pos-blue)]">Use extracted suggestion</div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "defaults" ? (
            <Card className="p-5">
              <h3 className="text-xl font-black text-[var(--pos-text)]">Save Vehicle Defaults</h3>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Verify these values before saving. They will not overwrite future tickets automatically without employee selection.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Input label="Oil Capacity (qt)" inputSize="touch" type="number" step="0.1" value={form.oil_capacity ?? ""} onChange={(event) => setForm({ ...form, oil_capacity: Number(event.target.value) || null })} />
                <Input label="Oil Type" inputSize="touch" value={form.oil_type ?? ""} onChange={(event) => setForm({ ...form, oil_type: event.target.value || null })} />
                <Input label="Oil Filter SKU" inputSize="touch" value={form.oil_filter_sku ?? ""} onChange={(event) => setForm({ ...form, oil_filter_sku: event.target.value.toUpperCase() || null })} />
                <Input label="Air Filter SKU" inputSize="touch" value={form.air_filter_sku ?? ""} onChange={(event) => setForm({ ...form, air_filter_sku: event.target.value.toUpperCase() || null })} />
                <Input label="Cabin Filter SKU" inputSize="touch" value={form.cabin_filter_sku ?? ""} onChange={(event) => setForm({ ...form, cabin_filter_sku: event.target.value.toUpperCase() || null })} />
                <Input label="Source Title" inputSize="touch" value={form.vehicle_info_source_title ?? ""} onChange={(event) => setForm({ ...form, vehicle_info_source_title: event.target.value || null })} />
                <Input className="md:col-span-2" label="Source URL" inputSize="touch" value={form.vehicle_info_source_url ?? ""} onChange={(event) => setForm({ ...form, vehicle_info_source_url: event.target.value || null })} />
                <Input className="md:col-span-2" label="Notes" inputSize="touch" value={form.vehicle_info_notes ?? ""} onChange={(event) => setForm({ ...form, vehicle_info_notes: event.target.value || null })} />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={saveDefaults}>Save Defaults</Button>
              </div>
            </Card>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--pos-border)] bg-white px-4 py-3">
      <span className="font-bold text-[var(--pos-muted)]">{label}</span>
      <span className="text-right font-black text-[var(--pos-text)]">{value}</span>
    </div>
  );
}
