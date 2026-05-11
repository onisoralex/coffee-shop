# Project Tracker

> This is the first file to read at the start of any session.
> It reflects the current state of the project. Update it whenever tasks are completed or decisions are made.

---

## Current status

**Phase:** Phase 10 complete — Phase 11 (improvements & features) planned and prioritised  
**Last updated:** 2026-05-11  
**Active work:** Nothing in progress — ready to start P1 (socket reconnection recovery).

---

## Completed

### Planning
- [x] Design principles and vision — `docs/SOUL.md`
- [x] Architecture document (DB schema, Socket.io events, REST API) — `docs/ARCHITECTURE.md`
- [x] 11-phase implementation roadmap — `docs/PLANNING.md`
- [x] Claude reference guide (tech stack, conventions, coding rules) — `CLAUDE.md`
- [x] Project tracker (this file) — `docs/TRACKER.md`

### Phase 1 — Docker + monorepo scaffold
- [x] Root `package.json` with npm workspaces (`client`, `server`, `packages/shared`)
- [x] `docker-compose.yaml` — db + server, hot reload via bind mounts, `docker compose up -d`
- [x] `server/Dockerfile.dev` — Node 25.9.0-alpine, OpenSSL fix, prisma generate baked in
- [x] `server/` — Node.js + TypeScript, `tsx watch` hot reload, ESM throughout
- [x] `packages/shared/` — TypeScript types package, exported as `@coffee/shared`
- [x] `.env.example` — all required env vars documented
- [x] `client/` — Vite + React + TypeScript scaffold (5 placeholder views: `/order`, `/barista`, `/counter`, `/pickup`, `/management`)
- [x] Vite runs as Express middleware in dev — single port (3001), no proxy, no separate client container
- [x] `server/prisma` bind-mounted so seed changes don't require image rebuild
- [x] `.gitignore` — excludes `node_modules/`, `dist/`, `.vite/`, `.env`, build artifacts
- [ ] `docker-compose.yml` — production variant (nginx, compiled builds) (**not started**)

### Phase 2 — Database schema + Prisma
- [x] `server/prisma/schema.prisma` — full schema: Category, MenuItem, Table, Order, OrderItem, DailyCounter
- [x] Prisma client singleton — `server/src/lib/prisma.ts`
- [x] Schema applied to DB via `prisma db push` (runs on container start)
- [x] `server/prisma/seed.ts` — 2 categories, 7 coffee items, 5 other items, 5 tables; production guard; run with `npm run db:seed --workspace=server`
- [ ] Proper migration files (`prisma migrate dev`) — deferred until schema stabilises

### Phase 3 — Backend foundation
- [x] `server/src/index.ts` — HTTP server, Socket.io wired, port binding
- [x] `server/src/app.ts` — Express, `/api/v1/health`, API routes, Vite middleware (dev) / static serving (prod)
- [x] `server/src/socket/index.ts` — Socket.io init, typed with `ClientToServerEvents`/`ServerToClientEvents`, `view:join` room handler
- [x] `server/src/middleware/auth.ts` — JWT verification middleware
- [x] `POST /api/v1/auth/login` — validates `ADMIN_PASSWORD` env var, returns signed JWT
- [x] `GET /api/v1/menu` — returns `MenuSnapshot` (categories + available items)
- [x] `GET /api/v1/orders/:id` — poll order status (fallback to socket)
- [x] `GET /api/v1/tables/:token` — resolves QR token to table info
- [x] `POST /api/v1/orders` — creates order, assigns daily number, emits `order:placed` to `kitchen` + `order:{id}`
- [x] `server/src/services/order.service.ts` — state machine (startPart, donePart, pickedUpPart, cancelOrder), daily counter, DB mapping
- [x] `server/src/socket/handlers.ts` — `order:part:start`, `order:part:done`, `order:part:picked_up`, `order:cancel`
- [x] Zod schemas for all REST + socket payloads

### Phase 4 — Shared types
- [x] `packages/shared/src/types.ts` — all domain types + socket payload shapes
- [x] `packages/shared/src/events.ts` — typed Socket.io event map (`ServerToClientEvents`, `ClientToServerEvents`)

### Phase 5 — Ordering view (`/order`)
- [x] `useMenuStore` (Zustand) — fetch + cache menu on mount, `retryMenu()` helper
- [x] `useOrderStore` (Zustand) — cart management, submit, `resetCart`
- [x] `useSocket` hook — module-level singleton, typed with shared event maps
- [x] `useTable` hook — resolves `?table=` QR token via `GET /api/v1/tables/:token`
- [x] Two-panel layout in `OrderView` — orientation-aware (landscape: side-by-side, portrait: stacked)
- [x] `MenuPanel` — category tabs, item cards (full-card tap target, quantity badge, blue border when in cart)
- [x] `CartPanel` — two tabs (Order / Open), table selector above tabs
- [x] Order tab — cart lines with per-line collapsible notes and quantity controls, order number field (bar only)
- [x] Cart line grouping by notes — same item can appear as multiple lines; pressing the menu card increments the empty-notes line or creates a new one
- [x] Cart line notes — hidden by default; tap item name to expand; collapses on blur if empty
- [x] Order number field — inline with tab bar (bar only); pre-filled from `GET /api/v1/orders/next-number`; override syncs the daily counter
- [x] Submit clears cart immediately — no blocking status screen; staff place the next order right away
- [x] Open tab — live list of active orders for the selected table; real-time via `table:{tableId}` socket room
- [x] Open tab order cards — item list, part status chips, "Delivered" button when a part is DONE
- [x] Bar table — hardcoded `id = 'bar'`, seeded permanently, default selection on mount
- [x] `tableId` NOT NULL on `Order` — null is a data bug; all orders belong to a table
- [x] `GET /api/v1/orders/open?tableId=X` — returns orders with at least one active part
- [x] `table:{tableId}` socket room — all order placed/updated events also emitted here
- [x] Hot reload fixed for Windows Docker — `nodemon --legacy-watch` (server), Vite `usePolling: true` (client)
- [x] Vite HMR WebSocket attached to existing HTTP server — fixes HMR in Docker single-port setup
- [x] Global design tokens in `client/src/index.css` — three font size CSS vars (`--fs-primary/secondary/small`); dark mode will extend the same file
- [x] `Order.notes` removed — order-level notes dropped from UI, store, API schema, service, shared types, and DB column

---

## Phase 6: Barista view (`/barista`) — Complete

- [x] `GET /api/v1/orders/kitchen` — returns all orders where coffeeStatus is PENDING or IN_PROGRESS
- [x] `BaristaView.tsx` — orientation-aware two-panel layout
- [x] Left/top panel — PENDING; tap card → `order:part:start`; card moves to right panel via socket update
- [x] Right/bottom panel — IN_PROGRESS; tap card → `order:part:done`; card disappears
- [x] Real-time via `kitchen` room; initial state from REST on mount
- [x] Urgency borders: amber >5 min, red >10 min; 60 s interval keeps them live
- [x] Sound toggle (Web Audio API beep on new PENDING order; no asset needed)

## Phase 7: Counter view (`/counter`) — Complete

- [x] `GET /api/v1/orders/counter` — returns orders with otherStatus PENDING/IN_PROGRESS or any part DONE
- [x] `CounterView.tsx` — orientation-aware two-panel layout
- [x] Left/top panel — prep queue for other items; tap PENDING → start, tap IN_PROGRESS → done; status chip on each card; urgency borders
- [x] Right/bottom panel — pickup display; DONE parts as large tappable badges ("42 C" / "42 O"); tap → picked_up
- [x] Joins both kitchen and display rooms; order:updated is idempotent for duplicate deliveries; order:removed cleans up

## Phase 8: Pickup Display (`/pickup`) — Complete

- [x] `GET /api/v1/orders/display` — returns orders with at least one DONE part, sorted by number
- [x] `PickupView.tsx` — full-screen dark display, read-only, no interaction
- [x] Badges: "42 C" / "42 O" sorted by order number ascending; fade+scale animation on mount
- [x] `order:updated` → add badge when part becomes DONE, remove when no longer DONE
- [x] `order:removed` → removes all badges for that order (picked up or cancelled)
- [x] Two-column "Preparing" option deferred — would require joining kitchen room; kept out of scope for now

## Phase 9: Management view (`/management`) — Complete

- [x] `server/src/api/management.ts` — full management router, all routes JWT-protected via `router.use(requireAuth)`
- [x] Category CRUD (`GET/POST /categories`, `PUT/DELETE /categories/:id`) — delete rejects with 409 if items exist
- [x] Item CRUD (`POST /items`, `PUT/DELETE /items/:id`, `PATCH /items/:id/availability`)
- [x] Table management (`GET/POST/DELETE /tables`, `POST /tables/:id/rotate-qr`) — Bar table protected, delete rejects if orders exist
- [x] Order history (`GET /orders?from=&to=`, `GET /orders/:id`) — defaults to today, max 200
- [x] `menu:updated` broadcast to `management` socket room after every menu mutation
- [x] `menuStore.setSnapshot` + ordering view subscribes to `menu:updated` so menu refreshes mid-service
- [x] Login page (password → JWT → localStorage), sign-out clears token
- [x] Three-tab shell: Menu (accordion with availability toggles + add/edit/delete dialogs), Tables (list + add/delete/rotate), Orders (date-range filter + expandable rows)

## UI polish pass (post-Phase 9)

- [x] `@mui/icons-material` added as client dependency; Docker image rebuilt
- [x] MUI icons replacing emoji/text in all views: `DeleteForeverIcon`, `EditIcon`, `AddIcon`, `RemoveIcon`, `CoffeeIcon`, `FastfoodIcon`, `RefreshIcon`
- [x] Management > Menu: `+ Category` and `+ Item` buttons use `AddIcon`; item row edit/delete use `EditIcon`/`DeleteForeverIcon`
- [x] Management > Tables: "Rotate QR" renamed to "NEW QR CODE"; Delete text replaced with `DeleteForeverIcon` icon button; `+ Table` uses `AddIcon`
- [x] Management > Orders: refresh button added; PENDING chip color changed to blue (`primary`)
- [x] Barista / Counter: panel titles centred; sound toggle button hidden (code preserved for future use)
- [x] Order view: order number field no longer clears after submit — re-fetches next number from API instead
- [x] Sort order defaults to 1 (not 0) in add dialogs for both categories and items

## Post-Phase 9 additions

### Orders summary cards
- [x] Management orders endpoint now includes `ee` and `me` on each `menuItem` in the response
- [x] `computeSummary()` aggregates non-cancelled orders client-side: total order count, total EE (portions), total milk (L, converted from ml), per-item breakdown sorted by quantity
- [x] Three scalar stat cards above the list: Orders, Coffee equivalent (portions), Milk (L)
- [x] Per-item breakdown card: all items with quantity, ee portions, milk L; shows `—` when zero

### Admin password change
- [x] `AdminConfig` DB table (single row, `id = 'singleton'`, `passwordHash`)
- [x] Startup seed: hashes `ADMIN_PASSWORD` env var and writes to DB on first run; no-op if row exists
- [x] Login endpoint updated to verify against DB hash (bcryptjs) instead of plain env var comparison
- [x] `PUT /api/v1/auth/password` — requires valid JWT + `{ currentPassword, newPassword (min 8 chars) }`; verifies current before accepting new
- [x] `SettingsSection.tsx` — change-password form with inline validation (length, mismatch); Settings tab added to management shell
- [x] `bcryptjs` added as server dependency; Docker image rebuilt

---

## Post-Phase 9 additions (continued)

### i18n — internationalisation (EN / DE / RO)
- [x] `react-i18next` + `i18next-browser-languagedetector` added as client dependencies
- [x] `client/src/i18n/config.ts` — i18next init: browser language detection (localStorage → navigator), fallback `en`, supports `en` / `de` / `ro`
- [x] `client/src/i18n/locales/en.json` / `de.json` / `ro.json` — full translation files covering all user-visible strings in every view
- [x] All views updated: `BaristaView`, `CounterView`, `OrderView`, `PickupView`, `CartPanel`, `ManagementView`, `MenuSection`, `TablesSection`, `OrdersSection`, `SettingsSection`
- [x] Romanian plural forms (`_one` / `_few` / `_other`) wired for item counts
- No language-switcher UI (deliberate — language follows browser preference; switcher can be added later)

### Language setting stored in database
- [x] `AdminConfig.language String @default("en")` — column added to existing singleton row via `prisma db push`
- [x] `getLanguage()` / `setLanguage()` added to `server/src/lib/adminConfig.ts`
- [x] `GET /api/v1/auth/language` — public endpoint, all views fetch this on startup
- [x] `PUT /api/v1/management/settings/language` — auth-protected, validates `en | de | ro`
- [x] `LanguageSync` component in `App.tsx` — fetches DB language on mount, calls `i18n.changeLanguage()` if different from cache
- [x] Language picker added to Settings tab in Management view — saves to DB and applies immediately

---

## Phase 10: QR / Mobile polish — Complete

- [x] QR code generation — client-side via `qr-code-styling` (replaces planned server-side PNG; richer output, no server dependency)
- [x] Management Tables tab: styled QR dialog with live preview, dot shapes, gradients, logo, download PNG
- [x] QR base URL setting in Settings tab (stored in `AdminConfig`; fallback to `window.location.origin`)
- [x] Test full ordering flow on real mobile device
- [x] Viewport lock — `touch-action: manipulation` on body prevents double-tap zoom across all views
- [ ] PWA manifest — permanently dropped; app runs as a kiosk, "Add to Home Screen" is not relevant

---

## Next up — Phase 11: Improvements & features

Priority order as agreed. Each item is independent and can be shipped separately.

### P1 — Socket reconnection recovery
When the server restarts mid-shift, barista and counter views go silently stale — Socket.io reconnects but the views do not re-fetch their state. A barista could miss orders placed while the connection was down.
- Re-fetch kitchen/counter state on socket `connect` event (fires on both first connect and reconnect)
- Show a brief "Reconnected" toast so staff know the state was refreshed

### P2 — Category-level pause
Toggling every coffee item unavailable one by one when the espresso machine goes down is slow and error-prone. A single button to pause/unpause an entire category is a one-shift quality-of-life improvement.
- Add `paused Boolean @default(false)` to `Category` schema
- `PATCH /api/v1/management/categories/:id/pause` toggles the flag
- Paused categories are excluded from the public menu snapshot (same as unavailable items)
- Management accordion shows a "Pause" / "Resume" button per category

### P3 — Dark mode
CSS is already structured for it — `[data-theme="dark"]` override block in `index.css` is the documented extension point. MUI theme needs a `mode` toggle wired to the same attribute.
- Add dark colour tokens to `index.css`
- Toggle stored in `AdminConfig` (shop-wide) — same two-tier pattern as language

### P4 — Composition field on menu items
A free-text field on `MenuItem` describing what the drink is made of (e.g. `1/3 Espresso + 2/3 microfoam`). Displayed on the item card directly below the description. Useful for customers who don't know the menu.
- Add `composition String?` to `MenuItem` schema
- Add field to item create/edit dialogs in management
- Render on item cards in the ordering view (below description, visually distinct)

### P5 — Show/hide toggles for description and composition
Checkboxes in the Settings tab that control whether the description field and composition field are shown on item cards in the ordering view. Stored in `AdminConfig`. Lets the admin tune the visual density of the menu for their specific screen size and audience.
- Add `showDescription Boolean @default(true)` and `showComposition Boolean @default(true)` to `AdminConfig`
- Expose as two checkboxes in Settings tab
- Ordering view reads these flags on startup and applies them to item card rendering

### P6 — Menu item images (composition visualization)
`imageUrl` already exists on `MenuItem` and is stored in the DB but nothing renders it. Intended use: a small diagram showing ingredient proportions (e.g. a layered cup illustration for a cappuccino) rather than a photo.
- Render `imageUrl` as a fixed-size image on item cards in the ordering view
- Show/hide controlled by a third toggle alongside P5 (or always shown when set)
- No server changes needed — field and CRUD already exist

---

## Backlog — lower priority improvements

- **Sound alerts re-exposed** — beep code already written in `BaristaView`, button is just hidden. Re-expose as a toggle button with localStorage persistence per device.
- **Live shift stats** — "Today so far" stat cards (orders, ee portions, milk) visible directly in the management home without navigating to the Orders tab and filtering.
- **Reconnection indicator** — small banner that appears when the socket drops and disappears on reconnect. Purely informational, prevents confusion when the server restarts.
- **CSV export** — "Download CSV" button next to the date filter on the Orders tab. Orders endpoint already returns all needed data.

---

## Upcoming phases

| Phase | What | Status |
|-------|------|--------|
| 1 | Docker + monorepo scaffold | Complete (prod compose deferred to Phase 11) |
| 2 | Database schema + Prisma | Complete (migrations deferred until schema stabilises) |
| 3 | Backend foundation | Complete |
| 4 | Shared types | Complete |
| 5 | Ordering view (`/order`) | Complete |
| 6 | Barista view (`/barista`) | Complete |
| 7 | Counter view (`/counter`) | Complete |
| 8 | Pickup Display (`/pickup`) | Complete |
| 9 | Management view (`/management`) | Complete |
| 10 | QR / mobile polish | Complete |
| 11 | Improvements & features | In progress |

Full task breakdown per phase: see `docs/PLANNING.md`

---

## Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Order status model | Part-based (`coffeeStatus` / `otherStatus` on `Order`, `PartStatus` enum, no `OrderItem.status`) | Baristas act on whole parts (all coffees, all others), not individual items. PICKED_UP is per-part — one part can be collected while the other is still on the display. No order-level status needed; CANCELLED sets all non-null parts. Simpler schema, no derived aggregates to sync. |
| Real-time communication | Socket.io + REST hybrid | Socket for live push (orders, status changes); REST for management CRUD (simpler, cacheable, standard auth). Polling rejected — adds latency and load for no benefit when Socket.io is already in the stack. |
| Frontend framework | React 18 + Vite + TypeScript + MUI v6 | Vite for fast DX; TypeScript for type safety across the monorepo; MUI v6 for accessible, responsive components without building a design system from scratch. |
| Client/server serving | Vite as Express middleware (dev); `express.static` from `client/dist` (prod) | Single origin — frontend and API both on port 3001. No separate client container. No CORS needed for the browser client. React Router handles all non-API paths; Express registers API routes first so `/api/v1/*` takes priority. |
| Screen naming | `/barista`, `/counter` (dropped `/prep`, `/coordinator`) | `/barista` — both prep person and finishing barista share one screen (two panels, one role per panel). `/counter` — person is stationary at the counter; "runner" was rejected because it implies moving to tables. |
| Two-panel layout | Orientation-aware (`useMediaQuery('(orientation: landscape)')`) not width breakpoints | Staff rotate Kindle tablets mid-shift; orientation is the correct signal. Portrait → vertical stack, landscape → side by side. Width breakpoints misbehave when a phone is held sideways. |
| Counter + pickup display | Counter view (`/counter`) joins both `kitchen` and `display` rooms | Counter person manages other-item preparation (kitchen room) and the pickup display (display room). Joining both rooms from one connection handles all relevant events without separate join per panel. |
| Pickup display format | "123 C" and "123 O" (Coffee / Other) | Parts shown and dismissed independently. "T" (tea) rejected — "Other" covers all non-coffee items. |
| Database | PostgreSQL via Prisma | Relational model fits orders with line items and categories. Prisma enforces type-safe queries and removes raw SQL risk. |
| State management | Zustand | Lightweight, no boilerplate, integrates cleanly with Socket.io listener patterns. |
| Auth | JWT, single admin credential (v1) | Multi-user auth out of scope for v1. Single password → JWT is minimal, stateless, secure for HTTP. |
| Order numbers | Daily counter 1–999, keyed by YYYY-MM-DD | Human-readable ("order 42"). Daily reset keeps numbers short. UUID handles uniqueness; number is display-only. |
| Order number override | Staff can edit the number before placing; override syncs the daily counter | Paper blocks at the bar are numbered in batches of ~100. When a new block starts at e.g. 200, the override resets the counter so auto-increment gives 201, 202, … Staff are responsible for avoiding duplicates when jumping numbers. |
| Bar table identity | Hardcoded `id = 'bar'` in the DB, seeded permanently | A non-CUID string is structurally impossible as a randomly generated ID, so `'bar'` is always distinguishable from real table IDs without a flag or enum. `BAR_TABLE_ID` constant in `@coffee/shared` so both client and server can reference it without a fetch. |
| tableId NOT NULL | Every order must belong to a table; null is a data integrity bug | Removes the ambiguity of "null = kiosk". Bar orders use the Bar table. A null tableId in the DB means something went wrong, not that the order came from the bar. |
| No separate kiosk concept | Staff mode and kiosk are the same view; the bar is just another table | Servers and bar staff all use `/order` with the table dropdown unlocked. Bar is the default selection. QR mode is the only variant — it locks the table and hides the dropdown. Removing "kiosk" as a concept simplifies the mental model and the code. |
| Post-submit behaviour | Cart clears immediately after placing; no blocking status screen | The status screen blocked staff from placing the next order. Replaced with an Open tab that shows live order status non-intrusively alongside the cart. Staff can switch tabs to check status or mark orders as delivered. |
| Open tab socket room | `table:{tableId}` room per table, not per-order `order:{id}` rooms | A table can have multiple concurrent orders. Subscribing per-order requires joining N rooms dynamically. A single `table:{tableId}` room receives all placed/updated events for that table, which is simpler to manage and matches the staff mental model ("I'm watching table 3"). |
| Order number visibility | Order number field shown only when the Bar table is selected | Table orders don't need a spoken order number — the server delivers them and knows the table. The number field is a bar-specific workflow concern (paper ticket sync). |
| Delivered button | Shown in the Open tab when a part is DONE; fires `order:part:picked_up` | Servers are responsible for marking table orders as delivered. Counter staff handle bar orders via the `/counter` view. Both ultimately use the same socket event — the difference is who initiates it. |
| Vite HMR in Docker | `server.hmr.server = httpServer` passed to `createViteServer` | Docker only exposes port 3001. Without this, Vite spawns its HMR WebSocket on port 24678, which is unreachable from the browser. Attaching HMR to the existing HTTP server makes HMR traffic go through 3001. |
| Cart line grouping | Same menu item can appear as multiple `CartLine` entries, keyed by `lineId` (UUID) | Allows per-line notes (e.g. 2× flat white cold milk + 1× flat white oat milk). Menu card press increments the empty-notes line for that item; once notes are filled in that line is locked and the next press creates a new line. Badge shows total across all lines. |
| Order number field | Always visible in cart, pre-filled via `GET /api/v1/orders/next-number` | Staff need to verify the sequence before placing. The endpoint is a read-only preview — it does not increment the counter, so two concurrent previews return the same number (acceptable: number is display-only). |
| Table/QR mode | Order number field and table picker hidden in token mode (`isTokenMode`) | In v1 the kiosk is the only real entry point; table/QR mode is built but not the primary flow. These fields are kiosk-staff concerns and don't belong on a customer self-order screen. |
| Containerization | Docker + Docker Compose (dev: db + server only) | Reproducible environment. Dev uses volume mounts for hot reload. No separate client container — Vite runs as Express middleware. |
| Hot reload (dev) | `tsx watch` (server) + Vite HMR via middleware (client) | Single process, single port. Vite middleware mode provides full HMR on the same origin as the API. |
| Seed data | Dev-only, wipes and recreates on each run; production guard throws if `NODE_ENV=production` | Clean slate on each dev reseed. Guard prevents accidental data loss on prod. |
| Module system | ESM (`import`/`export`) throughout | All `package.json` files have `"type": "module"`. Local TS imports use `.js` extension (Node ESM requirement). |
| Dev schema management | `prisma db push` on container start | No migration files during early dev. Migrate to `prisma migrate dev` before schema stabilises and frontend work begins. |
| Alpine + Prisma | `openssl` via apk + `linux-musl-openssl-3.0.x` binaryTarget | Alpine ships without OpenSSL; Prisma's query engine dynamically links against it. Both required — one without the other fails. |
| Global design tokens | CSS custom properties in `client/src/index.css` consumed via `var(--token)` in MUI `sx` props | One-place change interface for font sizes, future colours. Dark mode will be added as a `[data-theme="dark"]` override block in the same file. No MUI theme changes needed for base token adjustments. |
| Order-level notes removed | `Order.notes` dropped from UI, store, API, service, shared types, and DB column | Unnecessary complexity — item-level notes (`OrderItem.notes`) cover all real modifier use cases (milk type, temperature, extras). An order note had no defined recipient and would have required display space in every view. |
| Collapsible item notes | Notes field hidden by default; tap item name to expand; collapses on blur if left empty | Keeps the cart compact for the common case (no modifiers). Staff who need notes tap the name; the field disappears if unused, leaving no visual noise. |
| Cart line notes — `CartLineItem` component | Each cart line is its own component with local `showNotes` state | Avoids tracking a `Set<lineId>` of open states in the parent. Each line owns its own open/closed state independently. |
| Order number in tab row | `#` field rendered inline to the right of the Order/Open tabs (bar only) | Removes the number field from the scrollable cart body, where it was buried below the item list. Inline with tabs keeps it visible at all times while the Order tab is open. |
| Order number field post-submit | `resetCart` does not clear `orderNumber`; CartPanel re-fetches from API instead | Clearing in the store caused a blank field flash before the fetch resolved. Keeping the old value visible until the new one arrives is less jarring for staff placing rapid orders. |
| Sort order default | Add dialogs for categories and items default to `sortOrder: 1` | Non-technical staff expect counting to start at 1. Defaulting to 0 confused users who had to manually change it on every new item. |
| API auth scope | Management endpoints JWT-protected; ordering/operational endpoints open | Deployment is local-network only — network isolation is the security boundary. Adding app-level auth to operational endpoints would require embedding a credential in the client JS (visible in DevTools) or building per-role login flows for barista/counter screens. Neither is worth the complexity for a local deployment. Revisit if the app ever needs to be internet-facing. |
| Sound toggle hidden | `playBeep` and `soundEnabled` state kept in `BaristaView` but the UI button is not rendered | Feature was requested for future use but the current button placement was visually noisy. Preserving the logic means re-exposing it requires adding one JSX node, not rebuilding the feature. |
| Admin password storage | `AdminConfig` DB table (single bcrypt-hashed row, `id = 'singleton'`); `ADMIN_PASSWORD` env var is the one-time seed only | Storing a plain string in the env var made it impossible to change the password at runtime. Moving to DB + bcrypt enables a UI-driven password change without a redeploy. The env var is still required for first-run seeding. `bcryptjs` chosen over `bcrypt` — pure JS, no native bindings, works on Alpine without additional build deps. |
| Password change minimum length | API enforces 8-char minimum on new passwords; env-var seed bypasses this check | The env-var value may be short for dev convenience (`admin`). The minimum only applies to UI-driven changes, where staff have a keyboard and no excuse for a 4-character password. |
| Orders summary computed client-side | `computeSummary()` in `OrdersSection.tsx` aggregates totals from the already-fetched order array | No second API call needed — the orders endpoint already returns all required data. Adding a `/summary` endpoint would duplicate the query and add a round trip. The client computation is O(orders × items), which is negligible for the 200-order cap. |
| No test suite (v1) | Deliberate decision — no unit or integration tests added | For this app size and team, manual verification is faster than the infrastructure cost of a proper test suite (Vitest + Supertest + test DB). One Playwright smoke test at the end of Phase 10/11 is the only testing investment worth making. |
| Panel header stacking fix | `bgcolor: 'background.paper'` + `position: 'relative'` + `zIndex: 1` on all panel header boxes; `AppBar position="sticky"` in management | MUI `Card` sets `position: relative` internally, placing it ahead of static siblings in the same stacking context. Without an explicit z-index, panel headers (position: static) paint behind scrolled cards. `position: relative + zIndex: 1` on headers and `position: sticky` on AppBar (which MUI maps to `zIndex: 1100`) corrects the paint order. |
| i18n library | `react-i18next` + `i18next-browser-languagedetector` | Industry standard for React. The LanguageDetector plugin gives us the localStorage → navigator fallback chain for free. Alternatives (i18n-ally, lingui) require more setup and have smaller ecosystems. |
| Language storage: two-tier (localStorage + DB) | i18next caches to localStorage; `LanguageSync` component fetches DB on first render and overrides if different | DB is authoritative (admin sets it for the whole shop); localStorage is the fast path (returning devices show correct language immediately without a network round-trip before first render). Pure-DB would cause a language flash on every page load. Pure-localStorage would lose the admin-configured value on first visit to a new device. |
| `GET /auth/language` public (no JWT) | Same rationale as other operational endpoints — auth scope follows API auth scope decision above | All five views call this on startup before any login flow. Protecting it would require embedding a credential in the client JS or building unauthenticated token exchange — both worse than the exposure risk of returning a language code. |
| Badge letters "C"/"O" not translated | Intentionally kept as English abbreviations | These are documented internal identifiers, not user-facing text. Translating them (e.g. "K" for Kaffee) would break the consistency between `/counter` and `/pickup`, which display the same badges, and could confuse staff who are trained on the current format. |
| QR generation: client-side, not server-side | `qr-code-styling` (DOM Canvas) instead of planned `qrcode` (Node PNG) | Client-side gives richer output (dot shapes, gradients, logo, live preview) with zero server involvement. The library's own `.download()` handles PNG export. Server-side generation would require a headless canvas or separate binary, adds complexity, and the result is a plain black-and-white QR with no styling options. |
| QR base URL in AdminConfig | Stored in DB (`qrBaseUrl String @default("")`), not in env var | The URL is a runtime concern — it changes whenever the network changes, not when the app is deployed. Storing it in the DB lets the admin update it through the Settings UI without a redeploy or container restart. Empty string falls back to `window.location.origin`. |
| `crypto.randomUUID` fallback | `newLineId()` in `orderStore.ts` feature-detects and falls back to `Math.random` UUID v4 | The app runs over plain HTTP on a local network IP, which is not a secure context. `crypto.randomUUID()` is undefined in non-secure contexts, crashing the add-to-cart flow on any device accessing via IP. The fallback is sufficient because `lineId` is client-only state, never stored in the DB. |
| `touch-action: manipulation` on body | Applied globally, not per-view | Double-tap zoom is unwanted in every view (kiosk, barista, counter, pickup, management). A global rule is simpler and eliminates the risk of forgetting it on a new view. `manipulation` preserves pinch-zoom unlike `user-scalable=no`. |
| `z.string().url()` avoided for QR URL validation | Custom `.refine()` with `new URL()` + protocol check | `new URL()` throws on exotic schemes (e.g. `h://j`) rather than returning a parse failure, which can propagate through `safeParse` in some Zod versions and crash the route handler. The explicit `http:`/`https:` protocol check is also the correct semantic constraint — only those protocols make sense as an ordering page base URL. |
