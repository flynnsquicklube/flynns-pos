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
