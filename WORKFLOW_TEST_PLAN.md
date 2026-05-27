# Start Ticket Workflow Test Plan

## A. Existing customer by name
1. Open Start Ticket.
2. Choose Customer / Phone.
3. Confirm no customers are shown before typing.
4. Search a known customer by name or phone.
5. Select the customer.
6. Select a linked vehicle.
7. Enter current mileage.
8. Choose an oil package.
9. Resolve oil filter selection with inventory, customer supplied, or no filter.
10. Confirm quarts are valid.
11. Send to Bay.
12. Confirm sticker preview opens.
13. Skip or mark printed.
14. Open Ticket Detail, mark Waiting Payment, add payment, and finalize.

## B. Existing vehicle by VIN
1. Open Start Ticket.
2. Choose VIN.
3. Enter or scan a VIN for a saved vehicle.
4. Confirm local match appears with linked customer.
5. Enter current mileage.
6. Continue to servicing.
7. Complete package/filter/quarts, Send to Bay, payment, and finalize.

## C. Existing vehicle by plate
1. Open Start Ticket.
2. Choose License Plate.
3. Enter a saved plate and state.
4. Search Plate.
5. Confirm existing vehicle and linked customer appear.
6. Enter current mileage.
7. Continue to servicing.
8. Complete package/filter/quarts, Send to Bay, payment, and finalize.

## D. New vehicle by VIN
1. Open Start Ticket.
2. Choose VIN.
3. Enter a VIN not saved locally.
4. Decode with NHTSA if internet is available.
5. Confirm specs are prefilled when decode succeeds.
6. Enter mileage.
7. Select or add customer.
8. Complete package/filter/quarts, Send to Bay, payment, and finalize.

## E. New vehicle by manual entry
1. Open Start Ticket.
2. Choose Manual Entry.
3. Enter year, make, model, and mileage with no VIN/plate.
4. Confirm Next is blocked with VIN-or-plate message.
5. Add VIN or plate/state.
6. Select or add customer.
7. Complete package/filter/quarts, Send to Bay, payment, and finalize.

## F. Duplicate protection
1. Try creating a new vehicle using an existing VIN.
2. Confirm the existing vehicle is shown instead of creating a duplicate.
3. Try creating a new vehicle using an existing plate/state.
4. Confirm the existing vehicle is shown instead of creating a duplicate.
5. Double-click Send to Bay.
6. Confirm only one ticket is created.
7. Try finalizing a completed ticket again.
8. Confirm finalization is blocked and service history is not duplicated.
