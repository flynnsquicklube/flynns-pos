# Integrations

Flynn's POS is local-first. SQLite remains the shop source of truth, every internet integration is optional, and manual entry must always work.

There is no reliable free public API that provides complete oil capacity, oil filter fitment, wheel torque, and maintenance specs for every vehicle. The POS therefore uses saved vehicle defaults, imported Droptop history, ticket/package history, and employee confirmation first.

## NHTSA vPIC VIN Decoder

- Purpose: VIN decode for year, make, model, trim, engine, body class, fuel type, drive type, and manufacturer.
- Free/public: yes.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: no.
- Used in: Start Ticket VIN path, Vehicle Detail VIN tools, VIN cache.
- Limitations: does not provide complete service specs or part fitment.

## EPA FuelEconomy.gov

- Purpose: optional vehicle metadata enrichment by year/make/model, including fuel type, engine, transmission, drive, vehicle class, and MPG.
- Free/public: yes.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: no.
- Used in: Settings integration test and Vehicle Detail EPA match panel when enabled.
- Limitations: not a parts or maintenance specification database.

## NHTSA Recalls

- Purpose: optional safety recall lookup by year/make/model and external NHTSA recall search links.
- Free/public: yes.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: no.
- Used in: Settings integration test. Vehicle warning surfaces can be added when shop process is ready.
- Limitations: recall data should be treated as informational and verified with NHTSA/OEM sources.

## OpenStreetMap / Nominatim

- Purpose: future address validation, map, and distance workflows.
- Free/public: yes, with usage policy limits.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: no.
- Used in: provider architecture only for now.
- Limitations: calls are manual and rate-limited. The POS must not geocode on every keystroke.

## Square Terminal Sandbox

- Purpose: future terminal payment architecture.
- Free/public: sandbox testing is available, production payments require Square configuration.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: yes, via environment variables only.
- Used in: provider architecture only. Manual payments remain active.
- Limitations: no live terminal payment calls are shown in the payment modal.

## Local History Fitment

- Purpose: free local fitment suggestions from saved vehicle defaults, service history, imported ticket items, ticket package details, and inventory search.
- Free/public: yes, local only.
- Enabled by default: yes.
- Requires internet: no.
- Requires API key: no.
- Used in: oil-change workflow suggestions and Vehicle Detail local fitment panel.
- Limitations: quality depends on local history/imported data and still requires employee confirmation.

## Vehicle Info Lookup

- Purpose: employee-assisted lookup for oil capacity, oil type, oil filter, air filter, cabin filter, and service notes.
- Free/public: local history and manual search links are free; optional Google Programmable Search JSON API requires the shop to provide its own key/CX.
- Enabled by default: local history and manual search links yes; Google JSON search no.
- Requires internet: local history no; manual search links and Google JSON search yes.
- Requires API key: local/manual links no; Google JSON search yes.
- Used in: Start Ticket Specs, Start Ticket Servicing, Vehicle Detail service defaults.
- Storage: confirmed defaults save to the vehicle record and lookup history saves to `vehicle_info_lookup_history`.
- Limitations: no free public source covers all oil capacity/filter/torque data reliably. Web results are snippets/research aids only and must be verified before saving.

### Manual Search Links

The manual provider does not call a search API. It generates browser links for employee research, such as:

- `{year} {make} {model} {engine} oil capacity`
- `{year} {make} {model} {engine} oil filter`
- `{vin} oil capacity`
- `{year} {make} {model} Service Champ oil filter`

The employee manually enters the verified values before saving defaults.

### Google Programmable Search JSON API

The optional provider uses Google’s official Custom Search JSON API endpoint with `key`, `cx`, and `q` parameters when configured. It is disabled by default and reads credentials from:

- `VITE_GOOGLE_SEARCH_API_KEY`
- `VITE_GOOGLE_SEARCH_CX`

Do not commit keys or `.env` files. Search responses are cached in `vehicle_info_search_cache`, and extracted suggestions are labeled “verify before saving.”

## Future Paid Part Fitment Providers

- Purpose: future interfaces for providers such as Service Champ, ShowMeTheParts, MOTOR, or similar.
- Free/public: no.
- Enabled by default: no.
- Requires internet: yes.
- Requires API key: yes.
- Used in: interface only.
- Limitations: no paid/private API calls or scraping are implemented in this pass.

## Messaging And Accounting

- Purpose: future email/SMS receipts and accounting exports.
- Enabled by default: no.
- Requires API key: yes.
- Used in: registry/interface only.
- Limitations: hidden from normal shop workflow until configured and tested.
