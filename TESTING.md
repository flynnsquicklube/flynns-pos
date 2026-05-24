# Flynn's POS Testing Plan

## Local Dev Startup

1. Install dependencies with `npm install`.
2. Start web dev with `npm run dev` for renderer-only checks.
3. Start the desktop app with `npm run electron:dev` for SQLite/import testing.
4. Confirm the Electron bridge status in **Settings > Import Data** says connected.

## Imported Data Verification

1. Go to **Customers** and search for a known imported customer by name or phone.
2. Go to **Vehicles** and search by VIN or plate.
3. Go to **Orders** and use **All Imported Data**.
4. Go to **Inventory** and search by Product ID, brand, viscosity, or UPC.
5. Go to **Reports** and confirm **All Imported Data** shows completed order totals.

## Customer Search

1. Open **Customers**.
2. Confirm the page shows summary cards and recent customers only.
3. Search by name, phone, email, plate, and VIN.
4. Use **Imported**, **With Vehicles**, and **Open Tickets** filters.
5. Open a customer detail.
6. Click **Start Ticket** and confirm the guided ticket flow opens.

## Vehicle Search

1. Open **Vehicles**.
2. Confirm the page shows summary cards and recent vehicles only.
3. Search by VIN, plate, year, make, model, and customer name.
4. Open vehicle detail and confirm service history/tickets show.
5. Click **Start Ticket** and confirm the guided ticket flow opens.

## Inventory Search

1. Open **Inventory**.
2. Confirm it shows summary cards and recently active items only.
3. Search `OF`, `Service Champ`, `5W20`, and `Air Filter`.
4. Use **Low Stock**, **Oil Filters**, **Engine Oil**, and **Imported** filters.
5. Edit quantity on hand and confirm the save toast appears.

## Start Ticket From VIN

1. Go to **Start Ticket**.
2. Choose **VIN**.
3. Enter a known imported VIN or `TESTVIN123456789`.
4. Confirm local lookup prefills when matched, otherwise manual specs entry works.

## Start Ticket From Plate

1. Go to **Start Ticket**.
2. Choose **License Plate**.
3. Search a known imported plate with state `OH`.
4. Confirm local lookup prefills when matched, otherwise manual specs entry works.

## Start Ticket From Customer / Vehicle

1. Search a customer or vehicle.
2. Click **Start Ticket**.
3. Complete the guided flow: vehicle, specs, customer, services, review.
4. Create the ticket and confirm it appears in **Active Bays**.

## Complete Ticket

1. Open a checked-in ticket.
2. Start service in Bay 1.
3. Mark Waiting Payment.
4. Complete with Cash.
5. Confirm payment, service history, vehicle mileage, Orders, Dashboard, and Reports update.

## Reports

1. Open **Reports**.
2. Check Today, Last 7 Days, This Month, and All Imported Data.
3. Confirm no metric shows `NaN` or `undefined`.

## Services / Package Price Update

1. Go to **Settings > Packages**.
2. Change Synthetic Blend pricing.
3. Create a new ticket and confirm the new price applies.
4. Confirm old/imported orders preserve original totals.

## Integration Placeholders

1. Go to **Settings > Integrations**.
2. Confirm VIN Decoder, Loyalty App Sync, Payments, Accounting, Messaging, and Plate Lookup show disabled/not configured states.
3. Confirm setup buttons are disabled/Coming Soon.

## What Is Not Connected Yet

- Firebase loyalty/customer app sync.
- Stripe or card terminal payment collection.
- QuickBooks export.
- Twilio/SMS/email delivery.
- External plate lookup.
- Print hardware, photos, signatures, and scanner hardware.

## Package Pricing Flow

1. Start the desktop app with `npm run electron:dev`.
2. Go to **Start Order**.
3. Choose **VIN**.
4. Enter `TESTVIN123456789` and continue manually if no local match is found.
5. Enter vehicle specs:
   - Year: `2020`
   - Make: `Ford`
   - Model: `F-150`
   - Mileage: `100000`
   - Oil Type: `5W-20`
6. Create or select a customer.
7. On **Servicing**, select **Synthetic Blend Oil Change**.
8. Set **Actual quarts** to `7`.
9. Set filter type to **Cartridge filter**.
10. Add **Air Filter** from the Filters add-on group.
11. Confirm the pricing summary shows:
   - Synthetic Blend base package price
   - 1 extra quart at the package extra-quart price
   - Cartridge filter fee
   - Air Filter add-on
   - Tax and total
12. Review the order and click **Check In / Create Order**.
13. Open the ticket, move it through service, and complete it with a manual payment.
14. Confirm Order History shows the completed ticket.
15. Reopen the ticket detail and confirm the package line items and package snapshot are preserved even if package prices are edited later in Settings.

## Settings Checks

1. Go to **Settings > Packages**.
2. Edit a package base price, included quarts, extra quart price, or cartridge fee.
3. Save the row.
4. Start a new order and confirm the new price is used.
5. Confirm old completed tickets keep their original ticket item prices.

## Catalog Checks

1. Go to **Settings > Services**.
2. Add a catalog item.
3. Start a new order and confirm it appears under Add-On Services.

## Droptop CSV Import Checks

Run the Electron app so SQLite is available:

```bash
npm run electron:dev
```

### Import Droptop Orders

1. Go to **Settings > Import Data**.
2. In **Import Droptop Orders CSV**, choose `droptop_orders_filtered.csv`.
3. Click **Preview Import**.
4. Confirm the preview shows detected rows, estimated tickets, customers, vehicles, and duplicate skipped tickets.
5. Click **Run Import**.
6. Confirm the result shows imported, skipped, failed, customers created, vehicles created, tickets created, payments created, and service history created.

### Import Droptop Inventory

1. Go to **Settings > Import Data**.
2. In **Import Droptop Inventory CSV**, choose `droptop_inventory_list_2026-05-24.csv`.
3. Click **Preview Import**.
4. Confirm the preview shows detected rows and estimated created/updated inventory items.
5. Click **Run Import**.
6. Confirm the result shows created and updated inventory counts.

### Verify Imported Data

1. Go to **Customers** and search for a customer from the Droptop export. Confirm phone/email imported when present.
2. Open a customer detail and confirm imported vehicles, tickets, and service history appear.
3. Go to **Vehicles** and search by VIN or license plate. Confirm mileage and service history imported.
4. Go to **Order History** and confirm finalized Droptop orders appear as completed and paid when payment data exists.
5. Open an imported ticket and confirm package/service/inventory line names are preserved.
6. Go to **Inventory** and search by Product ID, product type, brand, or viscosity. Confirm quantity, retail, cost, UPC, and notes imported.
7. Go to **Reports** or **Overview** and confirm completed imported tickets contribute to totals.

### Duplicate Import Protection

1. Import the same orders CSV a second time.
2. Confirm existing Droptop orders are counted as skipped.
3. Import the same inventory CSV a second time.
4. Confirm matching Product IDs update existing inventory records instead of creating duplicates.
