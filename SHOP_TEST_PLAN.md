# Flynn's POS Shop Test Plan

Use this plan for real shop testing. Do not reset SQLite and do not delete imported data during testing.

Expected result for every test: no dead buttons, no Coming Soon labels, no orphan tickets, no duplicate vehicles, and manual fallback always available.

## Test 1 — Existing Customer By Name

1. Open Start Ticket.
2. Choose Customer / Phone.
3. Confirm no customer list is shown by default.
4. Search for a known customer by name or phone.
5. Select the customer.
6. Confirm only that customer's linked vehicles appear.
7. Select a vehicle.
8. Enter current mileage.
9. Continue to Servicing.
10. Select an oil-change package and oil filter.
11. Send to Bay.

Pass criteria:

- Customer and vehicle are attached to the ticket.
- Mileage is required.
- Ticket reaches bay without creating a duplicate customer or vehicle.

## Test 2 — Existing Vehicle By VIN

1. Open Start Ticket.
2. Choose VIN.
3. Type or USB-scan a VIN that exists locally.
4. Search/decode.
5. Confirm existing vehicle match appears before any new vehicle creation.
6. Confirm linked customer appears if available.
7. Enter current mileage.
8. Use Existing Vehicle.
9. Continue to Servicing.

Pass criteria:

- Existing vehicle is reused.
- Employee only updates mileage when customer is linked.
- No duplicate vehicle is created.

## Test 3 — Existing Vehicle By Plate

1. Open Start Ticket.
2. Choose License Plate.
3. Enter a known local plate and state.
4. Search Plate.
5. Confirm existing vehicle and linked customer appear.
6. Enter current mileage.
7. Use Existing Vehicle.
8. Continue to Servicing.

Pass criteria:

- Plate/state lookup finds local vehicle.
- State is required for plate workflow.
- No duplicate vehicle is created.

## Test 4 — New Customer / New Vehicle

1. Open Start Ticket.
2. Choose Manual Entry or License Plate.
3. Enter a new plate/state or VIN.
4. Enter year, make, model, and mileage.
5. Try continuing without customer and confirm the app blocks servicing.
6. Search for customer.
7. If no match, add customer.
8. Save/link vehicle to customer.
9. Continue to Servicing.

Pass criteria:

- VIN or plate/state is required.
- Year/make/model/mileage are required.
- Customer selection/creation is required before servicing.

## Test 5 — Add Inventory Item To Ticket

1. Open an in-service ticket.
2. Click Add Item.
3. Choose Inventory Item.
4. Search by SKU/product ID, for example `OF1403` if available.
5. Add quantity 1.
6. Confirm invoice updates.

Pass criteria:

- Inventory retail price is used.
- Inventory item appears as its own line.
- Ticket total and amount due update.
- Stock is not double-decremented before finalization.

## Test 6 — Add Labor / Discount / Fee / Custom Item

Run each action from an editable ticket:

1. Add Item -> Labor, add a $50 labor line.
2. Add Item -> Discount, add a $10 discount.
3. Add Item -> Fee, add a $3 environmental fee.
4. Add Item -> Custom Item, add a $20 custom service.

Pass criteria:

- Totals update after each item.
- Discount subtracts and cannot make total negative.
- Audit/Internal tab records edits where supported.
- Completed/canceled tickets do not allow edits.

## Test 7 — Send To Bay / Sticker

1. Complete Start Ticket servicing.
2. Click Send to Bay once.
3. Confirm button disables while saving.
4. Confirm ticket status becomes in_service.
5. Confirm sticker preview opens.
6. Mark printed or skip.
7. Confirm Ticket Detail opens.

Pass criteria:

- No duplicate ticket from double-clicking.
- Sticker preview is printable.
- Ticket appears in the correct bay.

## Test 8 — Payment / Finalize

1. Open in-service ticket.
2. Mark Waiting Payment.
3. Add Payment.
4. Pay full amount with a manual method.
5. Confirm payment summary shows paid in full.
6. Finalize Order.

Pass criteria:

- Payment record exists.
- Amount due reaches zero.
- Finalize is only visible/valid when paid.
- Ticket becomes completed and locks editing.
- Service history is created once.

## Test 9 — Print Invoice / Receipt

1. Open completed or paid ticket.
2. Print Invoice.
3. Confirm print view hides app chrome/buttons.
4. Print Receipt.
5. Confirm receipt is ink-friendly and readable.
6. Reprint Sticker.

Pass criteria:

- Invoice, receipt, and sticker preview work.
- Print output does not include sidebar/topbar/action buttons.
- Invoice disclaimer is present and readable.

## Test 10 — Inventory Edit / Adjust

1. Open Inventory.
2. Search for an item.
3. Open/edit item.
4. Adjust quantity with a reason.
5. Confirm movement history updates.

Pass criteria:

- Quantity changes safely.
- Movement history records the adjustment.
- Employee inventory page does not show financial/admin-only values.

## Test 11 — Package Edit

1. Open Settings -> Packages.
2. Confirm packages are grouped by category.
3. Edit a non-critical package price.
4. Save.
5. Start a new ticket and confirm new price is used.
6. Confirm an existing completed ticket keeps its stored line price.

Pass criteria:

- Package edits affect new tickets only.
- Droptop critical prices remain unchanged unless intentionally edited.
- Inactive packages do not appear in Start Ticket.

## Test 12 — Daily Closeout

1. Complete at least two test tickets with different payment methods.
2. Open Admin / Daily Closeout.
3. Review payment totals, completed count, tax, and discounts.
4. Save/close out only if this is a real closeout test.

Pass criteria:

- Admin reports match completed tickets and payments.
- Money metrics are not shown on employee dashboard.
- Closeout action is not visible to unauthorized employees.

## Regression Checks

- Manual VIN entry still works.
- USB keyboard scanner VIN entry still works.
- NHTSA decode failure does not block ticket creation.
- Plate missing state is blocked.
- Vehicle without VIN and plate is blocked.
- Completed/canceled tickets hide Add Item and inline editing.
- Payment terminal, SMS/email receipts, QuickBooks, cloud backup, and raw direct printer output are hidden unless configured and tested.
