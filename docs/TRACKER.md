# Project Tracker

> This is the first file to read at the start of any session.
> It reflects the current state of the project. Update it whenever tasks are completed or decisions are made.

---

## Current status

**Phase:** Phase 5 complete (including ordering view redesign and UI polish), Phase 6 next  
**Last updated:** 2026-05-07  
**Active work:** None — ordering view polished (font scale, CSS tokens, collapsible notes, order number in tab row, order-level notes removed). Start Barista view next.

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

## Next up — Phase 6: Barista view (`/barista`)

Two panels sharing one screen, one role per panel. Both update in real time via the `kitchen` socket room.

1. Create `client/src/views/BaristaView.tsx` — orientation-aware two-panel layout (reuse the same `useMediaQuery` pattern as `OrderView`)
2. On mount, emit `view:join { room: 'kitchen' }` via `getSocket()`
3. **Left/top panel — PENDING coffee orders (prep person):**
   - Fetch initial state via `GET /api/v1/orders/open` filtered to coffeeStatus PENDING (add a `status` query param or reuse the existing endpoint)
   - Subscribe to `order:placed` and `order:updated` on the `kitchen` room
   - Each card: order number, coffee items with qty + notes
   - Tap card → emit `order:part:start { orderId, part: 'coffee' }` → card moves to right panel
   - Visual urgency: amber border at >5 min, red at >10 min (use `createdAt` timestamp)
4. **Right/bottom panel — IN_PROGRESS coffee orders (barista):**
   - Same real-time subscription; filter to coffeeStatus IN_PROGRESS
   - Tap card → emit `order:part:done { orderId, part: 'coffee' }` → card disappears
5. Register the route in `client/src/App.tsx`
6. Sound notification on new PENDING order (user-toggleable; a simple `<audio>` element is fine for v1)

See `docs/PLANNING.md` Phase 6 for full task list.

---

## Upcoming phases

| Phase | What | Status |
|-------|------|--------|
| 1 | Docker + monorepo scaffold | Complete (prod compose deferred to Phase 11) |
| 2 | Database schema + Prisma | Complete (migrations deferred until schema stabilises) |
| 3 | Backend foundation | Complete |
| 4 | Shared types | Complete |
| 5 | Ordering view (`/order`) | Complete |
| 6 | Barista view (`/barista`) | Not started |
| 7 | Counter view (`/counter`) | Not started |
| 8 | Pickup Display (`/pickup`) | Not started |
| 9 | Management view (`/management`) | Not started |
| 10 | QR / mobile polish | Not started |
| 11 | Production hardening | Not started |

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
