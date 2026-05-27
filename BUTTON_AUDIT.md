# Button Audit

Status values: Working, Fixed, Hidden, Needs Work, Not Tested.

This audit reflects the rule that normal POS UI should only show actions that work locally. Hardware, paid APIs, cloud sync, and export features remain hidden from normal employee workflow unless safely implemented.

## Dashboard

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Quick Start Ticket | Opens Start Ticket workflow | Working |
| Operational KPI cards | Navigate to Active Bays, Orders, or Inventory as appropriate | Working |
| Financial shortcuts | Not shown on employee dashboard | Hidden |

## Start Ticket

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Customer / Phone | Opens customer-first search flow | Working |
| VIN | Opens VIN local search/decode flow | Working |
| License Plate | Opens plate/state local lookup flow | Working |
| Manual Entry | Opens manual vehicle/specs flow | Working |
| Scan VIN | Opens optional camera scanner; manual/USB entry remains available | Needs Work |
| Search Local | Searches local vehicles by VIN | Working |
| Decode VIN | Calls NHTSA only when enabled and VIN is valid | Working |
| Continue Manually | Allows manual flow while preserving validation before servicing | Working |
| Send to Bay | Validates customer, vehicle identifier, mileage, package/filter/quarts, then creates ticket and print job | Working |

## Active Bays

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Open Ticket | Opens Ticket Detail | Working |
| Move Bay | Moves Bay 1 to Bay 2 or Bay 2 to Bay 1 | Working |
| Start Service from queue | Assigns checked-in ticket to bay | Working |
| Payment/finalize/cancel on bay cards | Not shown; handled in Ticket Detail | Hidden |

## Ticket Detail / Invoice

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Add Item | Opens menu for inventory, labor, discount, coupon, fee, custom item | Working |
| Inline quantity edit | Updates quantity, line total, ticket totals, audit log | Working |
| Mark Waiting Payment | Moves in-service ticket to waiting payment | Working |
| Add Payment | Opens manual payment modal and refreshes totals/status | Working |
| Finalize Order | Requires paid ticket and creates service history once | Working |
| Cancel | Confirms and marks ticket canceled without deleting it | Working |
| Print Invoice | Creates invoice print preview job | Working |
| Print Receipt | Creates receipt print preview when paid/completed | Working |
| Reprint Sticker | Creates window sticker print preview job | Working |
| Open Customer / Open Vehicle | Navigates to matching detail screen | Working |
| Edit items on completed/canceled ticket | Not shown or locked | Hidden |

## Payment Modal

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Cash / Check / Credit / Debit / eTransfer / Warranty / Gift Card / ACH / Other | Saves local manual payment record | Working |
| Complete Payment | Saves payment and updates payment status | Working |
| Complete Payment & Finalize | Finalizes only if paid in full | Working |
| Terminal payment | Not shown until configured and tested | Hidden |
| Email/text receipt | Not shown in payment workflow | Hidden |

## Orders

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Date range filters | Filter orders | Working |
| Status/payment filters | Filter orders | Working |
| Search | Search invoice, customer, vehicle, VIN, plate | Working |
| Open | Opens Ticket Detail | Working |

## Customers

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Search | Search only after employee input; no default dump | Working |
| Add Customer | Creates local customer | Working |
| Open/Edit Customer | Loads detail/edit panel | Working |
| Start Ticket | Starts customer-context ticket flow | Working |
| Add Vehicle | Creates vehicle for customer with required identifier validation | Working |
| Delete customer | Not shown | Hidden |

## Vehicles

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Search | Search only after employee input; no default dump | Working |
| Add/Edit Vehicle | Saves local vehicle with VIN/plate normalization | Working |
| Start Ticket | Starts vehicle-context ticket flow | Working |
| Decode / Refresh VIN | Works when VIN decoder is enabled | Working |
| EPA enrichment | Visible only when enabled in settings | Working / Hidden |

## Inventory

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Search / hot filters | Search operational inventory without default dump | Working |
| Add Inventory Item | Creates local item | Working |
| View / Edit | Opens item detail/editor | Working |
| Adjust Quantity | Writes adjustment and movement history | Working |
| Count Sheets | Create, complete, apply adjustments | Working |
| Purchase Orders | Create, mark ordered, receive items | Working |
| Scanner lookup | Keyboard barcode/product lookup | Working |
| Supplier Manager | Add/edit suppliers | Working |
| Financial inventory metrics for employees | Not shown | Hidden |

## Packages

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Add Package | Opens package editor | Working |
| Edit Package | Saves package pricing/config | Working |
| Duplicate Package | Copies package inactive for review | Working |
| Disable/Enable | Toggles package visibility for new tickets | Working |
| Category accordions | Group packages by service type | Working |

## Reports / Admin

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Date filters / refresh | Recalculate local analytics | Working |
| Money metrics | Visible only to roles with admin analytics permission | Working |
| Unsupported export/report buttons | Not shown in main UI | Hidden |

## Employees / Time Clock

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| PIN keypad | Allows touch-friendly PIN entry | Working |
| Clock In / Start Break / End Break / Clock Out | Writes local time entries and session state | Working |
| Employee add/edit in Settings | Saves local employee records | Working |
| Payroll export | Not shown | Hidden |

## Settings

| Button / action | Expected behavior | Status |
| --- | --- | --- |
| Business Profile / Branding / Tax | Save local settings | Working |
| Import data | Preview and run Droptop imports | Working |
| Database check / diagnostics / backup | Runs local tools without reset/delete | Working |
| Printing settings | Save preview/system-print settings | Working |
| Hardware camera scanner test | Opens scanner test | Needs Work |
| Staff / Audit / Daily Closeout | Local management tools | Working |
| Live Firebase writes, QuickBooks, SMS/email, payment terminal, cloud backup | Not exposed in normal workflow | Hidden |

## Known Action Limitations

- Camera VIN scanning still needs physical shop testing and may need OCR/camera tuning.
- Direct raw Godex printing is not exposed; system print/preview is the safe tested path.
- Live customer app sync is dry-run/queue oriented and not enabled for normal workflow.
- Paid part fitment, payment terminal, QuickBooks, and SMS/email remain hidden from employee workflow.
