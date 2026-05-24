import { useEffect, useState } from "react";
import { CustomerFleetStep } from "../../components/order-wizard/CustomerFleetStep";
import { OrderReviewStep } from "../../components/order-wizard/OrderReviewStep";
import { OrderWizardShell } from "../../components/order-wizard/OrderWizardShell";
import { PlateLookupStep } from "../../components/order-wizard/PlateLookupStep";
import { ServicingStep } from "../../components/order-wizard/ServicingStep";
import { SpecsStep } from "../../components/order-wizard/SpecsStep";
import { VehicleMethodStep } from "../../components/order-wizard/VehicleMethodStep";
import { VinLookupStep } from "../../components/order-wizard/VinLookupStep";
import { emptyCustomerForm, useOrderWizardState } from "../../components/order-wizard/orderWizardState";
import type { VehicleSpecsForm, WizardStep } from "../../components/order-wizard/orderWizardTypes";
import { listActiveCatalogItems } from "../../lib/db/repositories/catalogRepo";
import { createCustomer, getCustomer, searchCustomers } from "../../lib/db/repositories/customersRepo";
import { listActivePackages } from "../../lib/db/repositories/packagesRepo";
import { getSetting } from "../../lib/db/repositories/settingsRepo";
import { createTicketWithItems } from "../../lib/db/repositories/ticketsRepo";
import { createVehicle, searchVehicles, updateVehicle } from "../../lib/db/repositories/vehiclesRepo";
import { calculatePackagePricing } from "../../lib/utils/pricing";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import { useToast } from "../../components/ui/useToast";

interface OrderWizardPageProps {
  onCreated: (ticketId: string) => void;
}

const stepOrder: WizardStep[] = ["vehicle", "specs", "customer", "servicing", "order"];

function specsFromVehicle(vehicle: {
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  plate: string | null;
  plate_state: string | null;
  mileage: number | null;
  oil_type: string | null;
  notes: string | null;
}): VehicleSpecsForm {
  return {
    year: vehicle.year ? String(vehicle.year) : "",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    engine: "",
    vin: vehicle.vin ?? "",
    plate: vehicle.plate ?? "",
    plate_state: vehicle.plate_state ?? "OH",
    mileage: vehicle.mileage ? String(vehicle.mileage) : "",
    oil_type: vehicle.oil_type ?? "",
    notes: vehicle.notes ?? ""
  };
}

export function OrderWizardPage({ onCreated }: OrderWizardPageProps) {
  const { state, setState, totals } = useOrderWizardState();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    Promise.all([listActivePackages(), listActiveCatalogItems(), getSetting("tax_rate")])
      .then(([activePackages, activeCatalogItems, setting]) => {
        setPackages(activePackages);
        setCatalogItems(activeCatalogItems);
        setState((current) => ({ ...current, taxRate: setting ? Number(setting.value) || 0 : 0 }));
      })
      .catch((error: unknown) => setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to load service catalog." })));
  }, [setState]);

  useEffect(() => {
    searchCustomers(state.customerSearch)
      .then((matches) => setState((current) => ({ ...current, customerMatches: matches })))
      .catch((error: unknown) => setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to search customers." })));
  }, [setState, state.customerSearch]);

  const goToStep = (step: WizardStep) => setState((current) => ({ ...current, step, validation: null }));
  const nextStep = () => {
    const currentIndex = stepOrder.indexOf(state.step);
    goToStep(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]);
  };
  const previousStep = () => {
    const currentIndex = stepOrder.indexOf(state.step);
    goToStep(stepOrder[Math.max(currentIndex - 1, 0)]);
  };

  const applyVehicleLookup = async (query: string, notFoundMessage: string) => {
    const normalizedQuery = query.trim();
    if (state.vehicleMethod === "vin" && normalizedQuery && normalizedQuery.length !== 17) {
      setState((current) => ({ ...current, validation: "VINs are usually 17 characters. You can still continue manually." }));
    }
    const matches = await searchVehicles(query);
    const match = matches[0] ?? null;
    if (!match) {
      setState((current) => ({ ...current, validation: notFoundMessage, specs: { ...current.specs, vin: current.vinInput || current.specs.vin, plate: current.plateInput || current.specs.plate, plate_state: current.plateState } }));
      goToStep("specs");
      return;
    }
    const customer = match.customer_id ? await getCustomer(match.customer_id) : null;
    setState((current) => ({
      ...current,
      lookedUpVehicle: match,
      selectedCustomer: customer,
      customerForm: customer ? emptyCustomerForm : current.customerForm,
      specs: specsFromVehicle(match),
      validation: null,
      step: "specs"
    }));
  };

  const validateSpecs = () => {
    if (!state.specs.year || !state.specs.make.trim() || !state.specs.model.trim() || !state.specs.mileage) {
      setState((current) => ({ ...current, validation: "Year, make, model, and mileage are required before continuing." }));
      notify({ tone: "error", title: "Vehicle specs needed", message: "Enter year, make, model, and mileage." });
      return false;
    }
    return true;
  };

  const validateCustomer = () => {
    if (state.selectedCustomer) return true;
    if (!state.customerForm.first_name.trim() || !state.customerForm.last_name.trim() || !state.customerForm.phone.trim()) {
      setState((current) => ({ ...current, validation: "Select a customer or enter first name, last name, and phone." }));
      notify({ tone: "error", title: "Customer needed", message: "Select a customer or enter first name, last name, and phone." });
      return false;
    }
    return true;
  };

  const validateServices = () => {
    if (state.selectedPackage && (!Number.isFinite(Number(state.actualQuarts)) || Number(state.actualQuarts) <= 0)) {
      setState((current) => ({ ...current, validation: "Enter actual quarts before continuing." }));
      notify({ tone: "error", title: "Quarts needed", message: "Actual quarts must be greater than zero." });
      return false;
    }
    if (state.selectedLines.length === 0) {
      setState((current) => ({ ...current, validation: "Add at least one service or custom item before continuing." }));
      notify({ tone: "error", title: "Service needed", message: "Add at least one service or custom item." });
      return false;
    }
    return true;
  };

  const rebuildPackageLines = (next: {
    selectedPackage: ServicePackage | null;
    actualQuarts: string;
    filterType: typeof state.filterType;
    addOnLines: TicketLineInput[];
  }) => {
    const actualQuarts = Number(next.actualQuarts) || 0;
    const packagePricing = calculatePackagePricing({
      selectedPackage: next.selectedPackage,
      actualQuarts,
      filterType: next.filterType,
      addons: next.addOnLines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        taxable: line.taxable,
        is_fee: line.item_type === "fee" ? 1 : 0,
        is_discount: line.item_type === "discount" ? 1 : 0
      })),
      taxRate: state.taxRate
    });
    const packageLines: TicketLineInput[] = [];
    if (next.selectedPackage) {
      packageLines.push({
        service_id: null,
        item_type: "package",
        package_id: next.selectedPackage.id,
        inventory_item_id: null,
        name: next.selectedPackage.name,
        quantity: 1,
        unit_price: next.selectedPackage.base_price,
        taxable: next.selectedPackage.taxable
      });
      if (packagePricing.extraQuartTotal > 0) {
        packageLines.push({
          service_id: null,
          item_type: "fee",
          package_id: next.selectedPackage.id,
          inventory_item_id: null,
          name: "Extra Oil Quarts",
          quantity: packagePricing.extraQuarts,
          unit_price: next.selectedPackage.extra_quart_price,
          taxable: next.selectedPackage.taxable
        });
      }
      if (packagePricing.filterFee > 0) {
        packageLines.push({
          service_id: null,
          item_type: "fee",
          package_id: next.selectedPackage.id,
          inventory_item_id: null,
          name: "Cartridge Filter Fee",
          quantity: 1,
          unit_price: next.selectedPackage.cartridge_filter_extra_fee,
          taxable: next.selectedPackage.taxable
        });
      }
    }
    return [...packageLines, ...next.addOnLines];
  };

  const syncLines = (updates: Partial<Pick<typeof state, "selectedPackage" | "actualQuarts" | "filterType" | "selectedCatalogItems">>) => {
    setState((current) => {
      const next = {
        selectedPackage: updates.selectedPackage !== undefined ? updates.selectedPackage : current.selectedPackage,
        actualQuarts: updates.actualQuarts !== undefined ? updates.actualQuarts : current.actualQuarts,
        filterType: updates.filterType !== undefined ? updates.filterType : current.filterType,
        addOnLines: updates.selectedCatalogItems !== undefined ? updates.selectedCatalogItems : current.selectedCatalogItems
      };
      return {
        ...current,
        ...updates,
        selectedLines: rebuildPackageLines(next),
        validation: null
      };
    });
  };

  const addCatalogItem = (item: ServiceCatalogItem) => {
    setState((current) => {
      const itemType = item.is_discount ? "discount" : item.is_fee ? "fee" : "service";
      const existing = current.selectedCatalogItems.find((line) => line.service_id === item.id);
      const selectedCatalogItems = existing
        ? current.selectedCatalogItems.map((line) => (line.service_id === item.id ? { ...line, quantity: line.quantity + 1 } : line))
        : [
            ...current.selectedCatalogItems,
            {
              service_id: item.id,
              item_type: itemType,
              package_id: null,
              inventory_item_id: item.inventory_item_id,
              name: item.name,
              quantity: 1,
              unit_price: item.base_price,
              taxable: item.taxable
            } satisfies TicketLineInput
          ];
      return {
        ...current,
        selectedCatalogItems,
        selectedLines: rebuildPackageLines({
          selectedPackage: current.selectedPackage,
          actualQuarts: current.actualQuarts,
          filterType: current.filterType,
          addOnLines: selectedCatalogItems
        }),
        validation: null
      };
    });
  };

  const addCustomLine = () => {
    if (!state.customLine.name.trim()) {
      setState((current) => ({ ...current, validation: "Custom item name is required." }));
      notify({ tone: "error", title: "Custom item needed", message: "Enter a name before adding the item." });
      return;
    }
    setState((current) => ({
      ...current,
      selectedLines: [
        ...current.selectedLines,
        {
          service_id: null,
          item_type: "custom",
          package_id: null,
          inventory_item_id: null,
          name: current.customLine.name.trim(),
          quantity: Math.max(Number(current.customLine.quantity) || 1, 1),
          unit_price: Number(current.customLine.unit_price) || 0,
          taxable: current.customLine.taxable ? 1 : 0
        }
      ],
      selectedCatalogItems: [
        ...current.selectedCatalogItems,
        {
          service_id: null,
          item_type: "custom",
          package_id: null,
          inventory_item_id: null,
          name: current.customLine.name.trim(),
          quantity: Math.max(Number(current.customLine.quantity) || 1, 1),
          unit_price: Number(current.customLine.unit_price) || 0,
          taxable: current.customLine.taxable ? 1 : 0
        }
      ],
      customLine: { name: "", quantity: "1", unit_price: "", taxable: true },
      validation: null
    }));
  };

  const createOrder = async () => {
    if (!validateSpecs() || !validateCustomer() || !validateServices()) return;
    setSaving(true);
    try {
      const customer =
        state.selectedCustomer ??
        (await createCustomer({
          first_name: state.customerForm.first_name.trim(),
          last_name: state.customerForm.last_name.trim(),
          phone: state.customerForm.phone.trim(),
          email: state.customerForm.email.trim() || null,
          notes: state.customerForm.notes.trim() || null,
          firebase_uid: null,
          referral_code: null
        }));
      if (!state.selectedCustomer) notify({ tone: "success", title: "Customer saved", message: `${customer.first_name} ${customer.last_name}` });

      const vehicleInput = {
        customer_id: customer.id,
        vin: state.specs.vin.trim() || null,
        plate: state.specs.plate.trim() || null,
        plate_state: state.specs.plate_state.trim() || null,
        year: Number(state.specs.year),
        make: state.specs.make.trim(),
        model: state.specs.model.trim(),
        mileage: Number(state.specs.mileage),
        oil_type: state.specs.oil_type.trim() || null,
        notes: [state.specs.engine ? `Engine: ${state.specs.engine}` : "", state.specs.notes].filter(Boolean).join(" | ") || null
      };
      const vehicle =
        state.lookedUpVehicle ??
        (await createVehicle(vehicleInput));
      if (state.lookedUpVehicle) {
        await updateVehicle(state.lookedUpVehicle.id, vehicleInput);
      }
      if (!state.lookedUpVehicle) notify({ tone: "success", title: "Vehicle saved", message: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") });

      const ticket = await createTicketWithItems({
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        items: state.selectedLines,
        customer_concern: state.customerConcern.trim() || null,
        technician_notes: state.technicianNotes.trim() || null,
        internal_notes: state.internalNotes.trim() || null,
        taxRate: state.taxRate,
        packageDetails: state.selectedPackage
          ? {
              package_id: state.selectedPackage.id,
              package_name: state.selectedPackage.name,
              oil_brand: state.selectedPackage.oil_brand,
              oil_type: state.selectedPackage.oil_type,
              included_quarts: state.selectedPackage.included_quarts,
              actual_quarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
              extra_quarts: calculatePackagePricing({
                selectedPackage: state.selectedPackage,
                actualQuarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
                filterType: state.filterType,
                addons: [],
                taxRate: state.taxRate
              }).extraQuarts,
              extra_quart_price: state.selectedPackage.extra_quart_price,
              extra_quart_total: calculatePackagePricing({
                selectedPackage: state.selectedPackage,
                actualQuarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
                filterType: state.filterType,
                addons: [],
                taxRate: state.taxRate
              }).extraQuartTotal,
              filter_type: state.filterType,
              cartridge_filter_extra_fee: state.filterType === "cartridge" ? state.selectedPackage.cartridge_filter_extra_fee : 0,
              package_base_price: state.selectedPackage.base_price,
              package_total: calculatePackagePricing({
                selectedPackage: state.selectedPackage,
                actualQuarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
                filterType: state.filterType,
                addons: [],
                taxRate: state.taxRate
              }).packageBase +
                calculatePackagePricing({
                  selectedPackage: state.selectedPackage,
                  actualQuarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
                  filterType: state.filterType,
                  addons: [],
                  taxRate: state.taxRate
                }).extraQuartTotal +
                calculatePackagePricing({
                  selectedPackage: state.selectedPackage,
                  actualQuarts: Number(state.actualQuarts) || state.selectedPackage.included_quarts,
                  filterType: state.filterType,
                  addons: [],
                  taxRate: state.taxRate
                }).filterFee
            }
          : null
      });
      notify({ tone: "success", title: "Ticket created", message: "Order checked in locally." });
      onCreated(ticket.id);
    } catch (error) {
      setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to create order." }));
      notify({ tone: "error", title: "Could not create order", message: error instanceof Error ? error.message : "Unable to create order." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrderWizardShell currentStep={state.step}>
      {state.step === "vehicle" && state.vehicleSubstep === "method" ? (
        <VehicleMethodStep
          onSelectVin={() => setState((current) => ({ ...current, vehicleMethod: "vin", vehicleSubstep: "vin", validation: null }))}
          onSelectPlate={() => setState((current) => ({ ...current, vehicleMethod: "plate", vehicleSubstep: "plate", validation: null }))}
          onSelectManual={() => goToStep("specs")}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "vin" ? (
        <VinLookupStep
          vin={state.vinInput}
          validation={state.validation}
          onChange={(vinInput) => setState((current) => ({ ...current, vinInput, specs: { ...current.specs, vin: vinInput } }))}
          onBack={() => setState((current) => ({ ...current, vehicleSubstep: "method", validation: null }))}
          onSearch={() => void applyVehicleLookup(state.vinInput, "No local VIN match found. Continue with manual specs.")}
          onContinue={() => setState((current) => ({ ...current, specs: { ...current.specs, vin: current.vinInput || current.specs.vin }, step: "specs", validation: null }))}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "plate" ? (
        <PlateLookupStep
          plate={state.plateInput}
          plateState={state.plateState}
          validation={state.validation}
          onPlateChange={(plateInput) => setState((current) => ({ ...current, plateInput, specs: { ...current.specs, plate: plateInput } }))}
          onStateChange={(plateState) => setState((current) => ({ ...current, plateState, specs: { ...current.specs, plate_state: plateState } }))}
          onBack={() => setState((current) => ({ ...current, vehicleSubstep: "method", validation: null }))}
          onSearch={() => void applyVehicleLookup(state.plateInput, "No local plate match found. Continue with manual specs.")}
          onContinue={() => setState((current) => ({ ...current, specs: { ...current.specs, plate: current.plateInput || current.specs.plate, plate_state: current.plateState }, step: "specs", validation: null }))}
        />
      ) : null}
      {state.step === "specs" ? (
        <SpecsStep
          specs={state.specs}
          validation={state.validation}
          onChange={(specs) => setState((current) => ({ ...current, specs }))}
          onPrevious={() => goToStep("vehicle")}
          onNext={() => {
            if (validateSpecs()) nextStep();
          }}
        />
      ) : null}
      {state.step === "customer" ? (
        <CustomerFleetStep
          search={state.customerSearch}
          matches={state.customerMatches}
          selectedCustomer={state.selectedCustomer}
          form={state.customerForm}
          fleetEnabled={state.fleetEnabled}
          validation={state.validation}
          onSearchChange={(customerSearch) => setState((current) => ({ ...current, customerSearch }))}
          onSelectCustomer={(selectedCustomer) => setState((current) => ({ ...current, selectedCustomer, validation: null }))}
          onFormChange={(customerForm) => setState((current) => ({ ...current, customerForm }))}
          onFleetChange={(fleetEnabled) => setState((current) => ({ ...current, fleetEnabled }))}
          onPrevious={previousStep}
          onNext={() => {
            if (validateCustomer()) nextStep();
          }}
        />
      ) : null}
      {state.step === "servicing" ? (
        <ServicingStep
          packages={packages}
          catalogItems={catalogItems}
          selectedPackage={state.selectedPackage}
          actualQuarts={state.actualQuarts}
          filterType={state.filterType}
          lines={state.selectedLines}
          customLine={state.customLine}
          customerConcern={state.customerConcern}
          technicianNotes={state.technicianNotes}
          internalNotes={state.internalNotes}
          pricing={calculatePackagePricing({
            selectedPackage: state.selectedPackage,
            actualQuarts: Number(state.actualQuarts) || state.selectedPackage?.included_quarts || 0,
            filterType: state.filterType,
            addons: state.selectedCatalogItems.map((line) => ({
              name: line.name,
              quantity: line.quantity,
              unit_price: line.unit_price,
              taxable: line.taxable,
              is_fee: line.item_type === "fee" ? 1 : 0,
              is_discount: line.item_type === "discount" ? 1 : 0
            })),
            taxRate: state.taxRate
          })}
          validation={state.validation}
          onSelectPackage={(selectedPackage) => syncLines({ selectedPackage, actualQuarts: state.actualQuarts || String(selectedPackage.included_quarts) })}
          onActualQuartsChange={(actualQuarts) => syncLines({ actualQuarts })}
          onFilterTypeChange={(filterType) => syncLines({ filterType })}
          onAddCatalogItem={addCatalogItem}
          onQuantityChange={(index, quantity) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target || target.item_type === "package" || target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.map((line) =>
              line === target || (line.service_id === target.service_id && line.name === target.name) ? { ...line, quantity: Math.max(quantity, 0.1) } : line
            );
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onPriceChange={(index, price) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target || target.item_type === "package" || target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.map((line) =>
              line === target || (line.service_id === target.service_id && line.name === target.name) ? { ...line, unit_price: Math.max(price, 0) } : line
            );
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onRemoveLine={(index) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target) return current;
            if (target.item_type === "package") {
              return { ...current, selectedPackage: null, actualQuarts: "", filterType: "standard", selectedLines: current.selectedCatalogItems };
            }
            if (target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.filter((line) => !(line.service_id === target.service_id && line.name === target.name));
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onCustomLineChange={(customLine) => setState((current) => ({ ...current, customLine }))}
          onAddCustomLine={addCustomLine}
          onNotesChange={(notes) => setState((current) => ({ ...current, ...notes }))}
          onPrevious={previousStep}
          onNext={() => {
            if (validateServices()) nextStep();
          }}
        />
      ) : null}
      {state.step === "order" ? (
        <OrderReviewStep
          specs={state.specs}
          selectedCustomer={state.selectedCustomer}
          customerForm={state.customerForm}
          lines={state.selectedLines}
          customerConcern={state.customerConcern}
          technicianNotes={state.technicianNotes}
          internalNotes={state.internalNotes}
          totals={totals}
          validation={state.validation}
          saving={saving}
          onPrevious={previousStep}
          onSaveDraft={() => setState((current) => ({ ...current, validation: "Draft saving is reserved for a later step. Use Check In / Create Order to save locally now." }))}
          onCreateOrder={createOrder}
        />
      ) : null}
    </OrderWizardShell>
  );
}
