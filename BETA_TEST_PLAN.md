# Flynn's Quick Lube POS Local Beta Test Plan

## Purpose

This beta verifies that the local-first desktop POS can run real shop workflows at Flynn's Quick Lube without cloud dependencies. The focus is stability, data safety, local SQLite reliability, and clear employee workflows.

## Ready For Local Beta

- Local Electron desktop app with SQLite source of truth.
- Droptop CSV import for orders and inventory.
- Dashboard, Start Ticket, Active Bays, Orders, Customers, Vehicles, Inventory, Reports, and Settings.
- Customer/vehicle search and global search.
- Oil-change package workflow with filter, oil/quarts, bay assignment, and sticker preview.
- Manual payments, finalization, invoice and receipt views.
- Local inventory editing and quantity movements.
- Local coupons/rewards architecture and queue-only loyalty sync.
- Staff, audit log, daily closeout, backup, diagnostics, and database health tools.
- White-label business profile and branding defaults.

## Hidden / Not Connected

- Live Firebase customer app sync.
- Live payment terminal integration.
- Direct raw Godex RT200i printing.
- QuickBooks export.
- Paid VIN/parts fitment APIs.
- Cloud backup.
- Email/SMS receipts.

## Daily Test Workflow

1. Start the desktop app with `npm run electron:dev`.
2. Go to **Settings > Database** and run the health check.
3. Create a database backup before shop testing.
4. Confirm **Settings > Import Data** shows Electron SQLite connected.
5. Start a ticket from Customer / Phone.
6. Select an existing vehicle or add a new vehicle.
7. Choose an oil package.
8. Select or search the oil filter inventory item.
9. Confirm oil type and quarts.
10. Send to Bay and choose Bay 1 or Bay 2.
11. Preview the window sticker and mark printed or skip.
12. Open the ticket from Active Bays.
13. Mark Waiting Payment.
14. Add a manual payment.
15. Finalize the order.
16. Confirm the order appears in Orders and Reports.
17. Confirm audit log and service history entries exist.
18. Run Daily Closeout at the end of testing.

## How To Start The App

```bash
npm install
npm run electron:dev
```

## How To Back Up The Database

1. Open **Settings > Database**.
2. Click **Create Backup**.
3. Choose a folder outside the project.
4. Confirm backup history shows the created backup.

## How To Import Data

1. Put real CSV files in the ignored `imports/` folder.
2. Open **Settings > Import Data**.
3. Preview the orders or inventory CSV.
4. Run import only after preview looks correct.
5. Re-importing should skip duplicate orders and update matching inventory.

## Bug Reports

For every issue, capture:

- Page or workflow step.
- What the employee clicked.
- Expected behavior.
- Actual behavior.
- Screenshot if useful.
- Whether the ticket/customer/vehicle/order was imported or local.
- Diagnostic export from **Settings > Database** when possible.

Do not send CSV imports, raw database files, customer phone numbers, emails, VINs, or payment details in bug reports unless explicitly requested and handled securely.
