# Known Limitations

This app is a local-first beta for Flynn's Quick Lube POS testing.

## Not Connected Yet

- No live Firebase/customer app sync.
- No live payment terminal integration.
- No direct raw Godex RT200i printing.
- No QuickBooks export.
- No paid VIN, OEM, or part fitment API.
- No cloud backup.
- No email/SMS receipt delivery.
- No production installer signing/notarization.

## Current Safety Choices

- SQLite is the local source of truth.
- Loyalty sync events are queued locally, but Firestore writes are disabled by default.
- Manual payments are recorded locally; card terminal integration is hidden until configured and tested.
- Window stickers, invoices, and receipts use preview/system print flows.
- Restore backup is disabled until a restart-safe database replacement flow is hardened.
- Dangerous delete/reset actions remain disabled.

## Beta Notes

- Imported Droptop data should remain intact and should not be deleted during testing.
- Search-first pages intentionally avoid dumping all customer, vehicle, and inventory records.
- Some terminology and branding is configurable, but not every text label is dynamic yet.
- Coupon/reward logic is local beta behavior and should be verified carefully before live customer app sync.
- Hardware scanner/printer workflows are architecture-ready but not considered production-connected.
