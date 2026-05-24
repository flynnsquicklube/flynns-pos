import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { listVehicles } from "../lib/db/repositories/vehiclesRepo";
import type { Vehicle } from "../types/vehicle";

export function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listVehicles(search)
      .then(setVehicles)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load vehicles."))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Vehicles</h2>
          <p className="text-sm text-slate-500">Vehicle records stored locally.</p>
        </div>
        <Button variant="secondary" icon={<Plus size={16} />}>Add Vehicle</Button>
      </div>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicles" />
      {error ? <Card className="p-4 text-sm text-red-200">{error}</Card> : null}
      <Card className="p-4">
        {vehicles.length === 0 ? (
          <EmptyState title={loading ? "Loading vehicles" : "No vehicles yet"} message="Customer vehicles will appear here once created." />
        ) : (
          <div className="divide-y divide-white/10">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold text-slate-950">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                  <div className="text-sm text-slate-500">{vehicle.plate ?? "No plate"} {vehicle.plate_state ?? ""}</div>
                </div>
                <div className="text-sm text-slate-500">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Mileage needed"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
