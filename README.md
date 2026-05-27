# Flynn's Quick Lube POS

Step 1 foundation for a production-ready, local-first desktop POS system for Flynn's Quick Lube.

This project uses React, Vite, TypeScript, Tailwind CSS, Electron, and SQLite. It is intentionally limited to the foundation layer: app shell, navigation, local database, schema, seed services, basic repositories, placeholder pages, and safe Firebase placeholders.

Advanced ticket workflows, payments, Firebase sync, punch cards, coupons, referrals, and customer app sync are not implemented yet.

## Install

```bash
npm install
```

## Run Web Dev

```bash
npm run dev
```

The web dev server is useful for UI work. Local SQLite access is available through Electron, so pages that load database data will show a desktop-app message when opened in a browser alone.

## Run Electron Dev

```bash
npm run electron:dev
```

This starts Vite and then opens the Electron desktop shell with SQLite enabled.

## Build

```bash
npm run build
npm run electron:build
```

Installer signing and notarization are not wired yet. `electron-builder` is configured for local package builds, and code signing can be added when the deployment target is ready.

## macOS Setup

1. Install Node.js 20 or newer.
2. Open Terminal.
3. Change into the project folder:

```bash
cd flynns-pos
```

4. Install dependencies:

```bash
npm install
```

5. Run the desktop app:

```bash
npm run electron:dev
```

## Windows Setup

1. Install Node.js 20 or newer.
2. Open PowerShell.
3. Change into the project folder:

```powershell
cd flynns-pos
```

4. Install dependencies:

```powershell
npm install
```

5. Run the desktop app:

```powershell
npm run electron:dev
```

## Local SQLite Storage

The SQLite database is created by Electron at the operating system's standard app data location using `app.getPath("userData")`.

Conceptually:

- macOS: the user's Application Support area for this app
- Windows: the user's AppData area for this app

The app does not hardcode user paths. The database file is named `flynns-pos.sqlite`.

## Backup And Diagnostics

Open **Settings → Database** in the Electron desktop app to see the SQLite database path, app data folder, app/runtime versions, backup history, health check results, and recent local errors.

Safe maintenance actions:

- **Create Backup** copies the current SQLite database to a user-selected `.sqlite` file and records the backup in local history.
- **Export Diagnostics** saves a JSON support bundle with app/platform info, schema/data health summary, import summaries, backup history, sync status, and local error summaries.
- **Open App Data Folder** opens the local Electron `userData` folder.
- **Copy Database Path** copies the local SQLite path for support.

Diagnostics intentionally avoid raw customer names, phone numbers, emails, VINs, full order details, payment details, CSV imports, secrets, and `.env` data.

Restore is intentionally disabled for now. A safe restore flow must create an emergency backup, replace the active database only when SQLite is closed, rerun migrations, and restart the app.

Do not commit local data or backups. Git ignores:

- `imports/`
- `*.csv`
- `.env` and `.env.local`
- `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`
- `backups/`

## Foundation Scope

Included in Step 1:

- Dark POS dashboard shell
- Sidebar navigation
- Top bar with local/offline status and date/time
- SQLite schema for users, customers, vehicles, tickets, ticket items, services, inventory, payments, coupons, referrals, sync queue, and app settings
- First-run service seed data
- Basic CRUD repository files
- Placeholder Firebase client and sync engine
- Loading and error states for pages that read local data

Not included in Step 1:

- Payment processing
- Firebase integration
- Loyalty, coupons, referrals, or punch card workflows
- Customer app sync
- Advanced ticket lifecycle logic

## Step 2 Ticket Workflow Testing

Run the Electron app so SQLite is available:

```bash
npm run electron:dev
```

Test the local-first ticket flow:

1. Open **New Ticket**.
2. Search for an existing customer or enter a new customer's first name, last name, and phone.
3. Search for an existing vehicle or enter a new vehicle with year, make, model, and mileage.
4. Select one or more active services, adjust quantities, or add a custom line item.
5. Add optional customer concern, technician notes, and internal notes.
6. Create the ticket. It is saved locally with status `checked_in`.
7. On the ticket detail screen, choose **Start Service**.
8. Choose **Mark Waiting Payment**.
9. Select Cash, Card, Check, or Other, enter final mileage, and choose **Complete Ticket**.
10. From any non-completed ticket detail screen, choose **Cancel Ticket**.
11. From a canceled ticket detail screen, choose **Reopen Ticket**.

The Tickets screen shows the service bay board with Checked In, In Service, Waiting Payment, and Completed Today columns.

## Step-Based Order Wizard

The Start Order workflow now uses a five-step wizard:

1. **Vehicle**: choose VIN or License Plate, search local vehicle records, or continue manually.
2. **Specs**: confirm year, make, model, mileage, VIN, plate, oil type, and notes.
3. **Customer/Fleet**: search local customers, select a customer, or enter a new customer inline.
4. **Servicing**: select an oil change package, configure actual quarts/filter type, add catalog add-ons, add custom items, and enter service notes.
5. **Order**: review vehicle, customer, line items, notes, and totals before checking in the order.

The wizard uses the local package/catalog repositories for oil change packages, add-on services, fees, and discounts. Package details are snapshotted onto each ticket so later price changes do not alter old orders. No external VIN, plate, payment, Firebase, or camera scanning APIs are integrated yet.

## Package Catalog Testing

See [TESTING.md](./TESTING.md) for the package pricing checklist, including extra quart pricing, cartridge filter fees, add-ons, ticket completion, and order history verification.

## Local Import Files

Real CSV exports for local testing should go in the `imports/` folder. That folder is ignored by Git and should not be committed because it can contain real customer and business data.

Use **Settings → Import Data** inside the POS to select and import the local CSV files.

## White-Label / Reskin Overview

The POS now has a local shop configuration layer so Flynn's Quick Lube remains the default brand while the same app can later be reskinned for another quick-lube business without rewriting workflows.

Use **Settings → Business Profile** to edit the local business name, legal name, location, address, contact info, timezone, currency, tax rate, and invoice/receipt/sticker footer text.

Use **Settings → Theme/Branding** to edit app name, local logo path, brand colors, density, terminology, rewards labels, and module visibility states. The app applies brand colors through CSS variables and falls back to the Flynn's defaults if config is missing.

Use **Settings → Theme/Branding → Export Shop Config** to export settings-only JSON. The export includes:

- Business profile
- Brand/theme config
- Service packages
- Service catalog items
- Loyalty rules
- Print settings

The export intentionally does not include:

- Customers
- Vehicles
- Tickets/orders
- Payments
- Service history
- Inventory quantities or imported customer data
- CSV import files

Importing a shop config updates settings, packages, catalog, loyalty rules, and print settings only. It does not wipe operational data.
