# Local Beta Release Checklist

## Build

- [ ] `npm install` completed.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run electron:dev` opens the desktop app.
- [ ] No blank pages from sidebar navigation.

## Data Safety

- [ ] `git status` reviewed.
- [ ] `imports/` is not tracked or staged.
- [ ] No `.csv` files are tracked or staged.
- [ ] No `.sqlite`, `.sqlite-wal`, or `.sqlite-shm` files are tracked or staged.
- [ ] No backup files are tracked or staged.
- [ ] `.env` and `.env.local` are ignored.

## Database

- [ ] Settings > Database health check runs.
- [ ] Required tables and columns pass.
- [ ] No destructive migrations are present.
- [ ] Backup created before beta testing.
- [ ] Diagnostics export tested.
- [ ] App data folder path verified.

## Core Workflow

- [ ] Customer-first ticket created.
- [ ] VIN or plate-start ticket created.
- [ ] New customer/new vehicle ticket created.
- [ ] Oil package selected.
- [ ] Oil filter inventory item selected and priced.
- [ ] Oil/quarts math checked.
- [ ] Ticket sent to Bay 1 or Bay 2.
- [ ] Sticker preview opened.
- [ ] Active Bays shows in-service ticket.
- [ ] Mark Waiting Payment works.
- [ ] Manual payment recorded.
- [ ] Finalize Order completes.
- [ ] Service history created.
- [ ] Vehicle defaults updated.
- [ ] Audit log records workflow events.

## Inventory

- [ ] Search by product ID/SKU.
- [ ] Search by Service Champ.
- [ ] Search by OF code.
- [ ] Search by viscosity.
- [ ] Edit inventory item.
- [ ] Adjust quantity.
- [ ] Movement history appears.
- [ ] Retail price feeds ticket line price.
- [ ] Cost is stored for COGS.
- [ ] Low stock badge checked.

## Printing

- [ ] Window sticker preview includes vehicle, oil, quarts, filter, next service, and ticket ID.
- [ ] Mark Printed updates print history.
- [ ] Reprint sticker tested.
- [ ] Invoice print preview tested.
- [ ] Receipt print preview tested.
- [ ] Direct Godex raw print remains disabled.
- [ ] Godex RT200i settings visible.

## Reports / Closeout

- [ ] Dashboard metrics load.
- [ ] Reports date ranges load.
- [ ] Payment method totals checked.
- [ ] No `NaN`, `undefined`, or `null` visible in metrics.
- [ ] Daily closeout loads.
- [ ] Closeout totals reviewed.

## Deployment

- [ ] Windows deployment status reviewed.
- [ ] Printer driver setup pending/completed.
- [ ] Code signing/notarization status documented.
- [ ] Known limitations reviewed with testers.
