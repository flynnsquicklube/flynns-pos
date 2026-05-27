# Flynn's POS System Audit

Audit date: 2026-05-27

Status values: Working, Fixed, Needs Work, Hidden, Not Tested.

## Executive Summary

The Flynn's POS is in a usable state for structured shop testing. The core local-first workflow is present: start ticket, identify customer/vehicle, select service package, add line items, send to bay, preview/print sticker, take payment, finalize, and print invoice/receipt.

The production data health checks are clean on the highest-risk items: no orphan tickets, no vehicles without VIN or plate, no duplicate VIN groups, no duplicate plate/state groups, no negative inventory, no paid tickets without payments, and the critical Droptop package prices match the provided export.

The main area that still needs real hardware testing is the optional camera VIN scanner. Manual VIN entry, USB keyboard scanner entry, local VIN search, and NHTSA decode remain the reliable fallback path.

No SQLite reset, data deletion, paid API connection, or destructive cleanup was performed.

## Core Workflow Status

| Workflow area | Status | Notes |
| --- | --- | --- |
| Start Ticket entry points | Working | Customer / Phone, VIN, License Plate, and Manual Entry are present. |
| Existing customer/vehicle workflow | Working | Search-first customer flow, linked vehicle selection, and mileage requirement are implemented. |
| VIN workflow | Working | Local search first, NHTSA decode available, manual fallback retained. Camera scan remains Needs Work. |
| License plate workflow | Working | Local plate/state lookup and new vehicle fallback are implemented. |
| Manual vehicle workflow | Working | Requires year/make/model/mileage and VIN or plate/state before servicing. |
| Package selection | Working | Active packages are categorized by service type and use SQLite package pricing. |
| Ticket item editing | Working | Add Item menu and inline quantity editing are available for editable tickets. |
| Send to Bay | Working | Validates workflow, creates/updates ticket, assigns bay, and opens sticker preview. |
| Payment | Working | Local/manual payment modal updates payment status and amount due. |
| Finalize | Working | Paid ticket finalization is guarded; completed tickets are locked from normal edits. |
| Printing | Working | Sticker, invoice, and receipt preview/print paths exist with print-safe invoice CSS. |
| Rewards/punch card | Working / Not Tested | Punch-card UI and finalize hooks exist; needs live shop test confirmation. |
| Inventory stock movement | Working / Not Tested | Inventory line pricing works; final stock movement should be verified during shop tests. |

## Pages Audited

| Page | Status | Notes |
| --- | --- | --- |
| Dashboard | Working | Employee-facing operational dashboard; financial metrics belong in Admin. |
| Start Ticket | Working | Four starting points, validation rules, categorized packages, and send-to-bay flow are present. |
| Active Bays | Working | Bay board focuses on Open Ticket and Move Bay; payment/finalize actions are in Ticket Detail. |
| Ticket Detail | Working | Invoice workspace, top action bar, Add Item menu, payment/finalize/print actions, and tabs are present. |
| Orders | Working | Search/filter/open order behavior is available. |
| Customers | Working | Search-first behavior, add/edit, start ticket, and customer vehicle workflow are present. |
| Vehicles | Working | Search-first behavior, add/edit, start ticket, local plate fields, and VIN decode tools are present. |
| Inventory | Working | Search-first inventory, add/edit/adjust quantity, movement history, count sheets, and purchase orders exist. |
| Packages | Working | Categorized package manager, add/edit/duplicate/disable, and Droptop price validation are present. |
| Admin / Reports | Working / Not Tested | Local analytics and management views exist; hardware/shop verification still recommended. |
| Employees | Working / Not Tested | Time clock and employee management exist; payroll export remains hidden. |
| Settings | Working | Business, tax, packages, imports, printing, database, hardware, staff, audit, and advanced controls are organized. |

## Buttons/Actions Audited

See `BUTTON_AUDIT.md` for the button-by-button status list.

Summary:

- Core employee actions are working or protected by validation.
- Unsupported paid/cloud/hardware actions are hidden from normal workflow.
- Camera VIN scan and hardware camera test remain Needs Work until validated on shop hardware.
- No normal workflow "Coming Soon" labels were found.

## Database/Schema Health

Read-only health check was run against:

`/Users/karaco/Library/Application Support/flynns-pos/flynns-pos.sqlite`

| Table / metric | Count |
| --- | ---: |
| customers | 1,469 |
| vehicles | 1,607 |
| tickets | 1,818 |
| ticket_items | 11,512 |
| payments | 1,800 |
| inventory_items | 709 |
| service_packages | 33 |
| service_history | 1,810 |
| print_jobs | 19 |
| audit_log | 18 |

| Health check | Result |
| --- | ---: |
| tickets without customer | 0 |
| tickets without vehicle | 0 |
| vehicles without VIN or plate | 0 |
| vehicles missing year/make/model | 0 |
| completed tickets without service history | 0 |
| paid tickets without payment | 0 |
| inventory items with negative quantity | 0 |
| duplicate VIN groups | 0 |
| duplicate plate/state groups | 0 |
| duplicate package name groups | 0 |
| tickets with bad totals | 0 |

## Package Price Check

Critical Droptop package prices match the requested source of truth. Existing completed/imported ticket line prices were not changed.

| Package | Expected | Current | Status |
| --- | ---: | ---: | --- |
| Synthetic Blend Oil Change | 58.99 | 58.99 | Working |
| Duramax Full Syn | 68.99 | 68.99 | Working |
| Mobil 1 Full Synthetic | 93.99 | 93.99 | Working |
| Diesel Oil Change | 92.99 | 92.99 | Working |
| Conventional Oil Change | 38.99 | 38.99 | Working |
| Customer Own Oil And Filter | 31.54 | 31.54 | Working |

## Printing Status

| Area | Status | Notes |
| --- | --- | --- |
| Window sticker preview after Send to Bay | Working | Preview/skip/mark printed flow exists. |
| Invoice print preview | Working | Invoice uses shared modern invoice component and print CSS. |
| Receipt print preview | Working | Available when paid/completed. |
| Print CSS | Working | App chrome/action controls are hidden; invoice is ink-friendly. |
| Direct raw Godex printing | Hidden | Keep hidden until configured and physically tested. |

## Inventory Status

| Area | Status | Notes |
| --- | --- | --- |
| Inventory search | Working | Search/hot filter driven, not a default data dump. |
| Ticket inventory item add | Working | Uses inventory retail price and stores inventory item reference. |
| Quantity adjustment | Working | Local adjustment/movement tooling exists. |
| Inventory movement on finalization | Working / Not Tested | Verify with a live end-to-end shop test before relying on stock counts. |
| Financial inventory metrics on employee pages | Hidden | Owner/admin reporting only. |

## Customer/Vehicle Status

| Area | Status | Notes |
| --- | --- | --- |
| Customer search-first workflow | Working | No default customer dump in ticket flow. |
| Vehicle local VIN lookup | Working | VIN match takes priority. |
| Vehicle local plate lookup | Working | Plate + state match is supported. |
| New vehicle validation | Working | VIN or plate/state required, plus year/make/model/mileage. |
| Duplicate vehicle protection | Working | VIN and plate/state checks are in place. |
| Camera VIN scanner | Needs Work | Optional only; manual/USB/NHTSA fallback works. |

## Payment/Finalize Status

| Area | Status | Notes |
| --- | --- | --- |
| Manual payment entry | Working | Local payment record updates ticket payment status. |
| Paid/partial/unpaid summary | Working | Ticket Detail shows amount due and payment status. |
| Finalize paid ticket | Working | Guarded behind paid status; completed tickets lock edits. |
| Live terminal payments | Hidden | Sandbox/provider architecture only; not in normal payment flow. |
| SMS/email receipts | Hidden | Not exposed until implemented safely. |

## Rewards/Punch Card Status

| Area | Status | Notes |
| --- | --- | --- |
| Invoice rewards panel | Working | Punch-card language, no points wording. |
| Punch update on oil-change finalize | Working / Not Tested | Needs live finalize test to confirm no duplicate punch events. |
| Customer app/Firebase live sync | Hidden | Dry-run/local queue behavior only; no normal workflow dependency. |

## Employee/Timeclock Status

| Area | Status | Notes |
| --- | --- | --- |
| PIN time clock | Working / Not Tested | Visible employee flow exists. |
| Employee add/edit | Working / Not Tested | Managed through Settings/Employees. |
| Payroll export | Hidden | Not exposed in normal UI. |

## Admin/Reports Status

| Area | Status | Notes |
| --- | --- | --- |
| Revenue/admin metrics | Working | Admin/manager area only. |
| Daily closeout | Working / Not Tested | Needs end-of-day shop test. |
| Unsupported export buttons | Hidden | Keep hidden unless verified. |

## Settings Status

| Area | Status | Notes |
| --- | --- | --- |
| Business profile / branding | Working | Real Flynn's logo and business profile support exist. |
| Tax settings | Working | Local settings. |
| Packages | Working | Categorized manager with Droptop fields/prices. |
| Import data | Working | Droptop import tooling exists. |
| Printing | Working | Preview/system-print first. |
| Database tools | Working | Health/backup tooling exists; no reset used in this pass. |
| Hardware scanner settings | Needs Work | Camera test opens scanner but reliability still needs hardware work. |
| Advanced integrations | Hidden / Advanced | Paid/private providers are not normal workflow actions. |

## Known Bugs

- Camera VIN scanner is still not reliable enough to count as a shop-ready primary scanner. It must remain optional; manual VIN typing and USB keyboard scanner input are the reliable path.
- Inventory stock movement on finalization needs a physical workflow test to confirm no duplicate movement in repeated finalize attempts.
- Punch-card finalization needs a live repeat-finalize test to confirm duplicate reward events cannot be created.

## Missing Features

- Live payment terminal processing.
- SMS/email receipt delivery.
- QuickBooks/accounting integration.
- Paid part fitment provider.
- Cloud backup/sync.
- Direct raw label printer output with production printer validation.
- Payroll export.

These should remain hidden from normal employee workflow until fully configured, tested, and permission-gated.

## Recommended Next Steps

1. Run `SHOP_TEST_PLAN.md` on the shop computer with real printer hardware.
2. Complete two full cash/check/credit dry-run tickets and verify service history, punch cards, and inventory movements.
3. Test camera VIN scanning with actual door-jamb labels, windshield labels, and USB scanner fallback.
4. Print one real sticker, one invoice, and one receipt on the actual shop printers.
5. Run a daily closeout test after several completed tickets.
