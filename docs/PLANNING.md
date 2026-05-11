# Implementation Plan

## Phases at a glance
| Phase | What | Est. complexity |
|-------|------|-----------------|
| 1 | Docker + monorepo scaffold | Low |
| 2 | Database schema + Prisma | Low-Medium |
| 3 | Backend foundation (Express + Socket.io) | Medium |
| 4 | Shared types package | Low |
| 5 | Ordering view | High |
| 6 | Barista view (`/barista`) | Medium |
| 7 | Counter view (`/counter`) | Medium |
| 8 | Pickup Display view | Low |
| 9 | Management view | High |
| 10 | QR / mobile polish | Medium |
| 11 | Production Docker + hardening | Medium |

---

## Phase 1 — Docker + monorepo scaffold

**Goal:** `docker compose up -d` starts two containers (db + server) and both hot-reload. Vite runs as Express middleware — no separate client container.

Tasks:
- [x] `docker-compose.yaml` — db + server, hot reload via bind mounts (`docker compose up -d`)
- [ ] `docker-compose.yml` (production, no volumes, compiled builds)
- [x] `client/` — Vite + React + TypeScript scaffold, served via Express middleware
- [x] `server/` — Node.js + TypeScript with `tsx watch` for hot reload
- [x] `packages/shared/` — TypeScript types package (`@coffee/shared`)
- [x] Root `package.json` with npm workspaces
- [x] `.env.example` with all required env vars
- [x] Vite runs as Express middleware in dev (single port, no proxy needed)

**Deliverable:** Both containers run, `localhost:3001/order` serves the React app, `localhost:3001/api/v1/health` returns 200.

---

## Phase 2 — Database schema + Prisma

**Goal:** Schema matches `ARCHITECTURE.md`, migrations run cleanly, seed script populates a sample menu.

Tasks:
- [x] `server/prisma/schema.prisma` — all models (Category, MenuItem, Table, Order, OrderItem, DailyCounter)
- [ ] Initial migration: `prisma migrate dev` (currently using `prisma db push` — migrate before schema stabilises)
- [x] `server/prisma/seed.ts` — 2 categories, 7 coffee + 5 other items, 5 tables; production guard; `npm run db:seed --workspace=server`
- [x] Prisma client singleton — `server/src/lib/prisma.ts`
- [x] `DailyCounter` model for order numbers

**Do not skip the seed script.** Every developer on this project will thank you. It removes the "I have an empty database" problem on first run.

---

## Phase 3 — Backend foundation

**Goal:** Express server + Socket.io running, auth middleware, basic order flow wired.

Tasks:
- [x] `server/src/index.ts` — Express + Socket.io init, port binding
- [x] `server/src/socket/index.ts` — Socket.io init, `view:join` room handler
- [x] `server/src/middleware/auth.ts` — JWT verification middleware
- [x] `POST /api/v1/auth/login` — validate `ADMIN_PASSWORD`, return JWT
- [x] `GET /api/v1/health` — returns `{ ok: true }`
- [x] `GET /api/v1/menu` — full menu snapshot
- [x] `POST /api/v1/orders` — place order, emit `order:placed` to kitchen + table + order rooms
- [x] Socket.io handlers: `order:part:start`, `order:part:done`, `order:part:picked_up`, `order:cancel`
- [x] Order status transition logic in `server/src/services/order.service.ts`
- [x] Zod schemas for all incoming payloads

**Part status machine (enforce in service, not in handlers):**
```
PENDING → IN_PROGRESS  (barista starts the part)
IN_PROGRESS → DONE     (barista marks part complete — appears on pickup display)
DONE → PICKED_UP       (customer collects — removed from pickup display)
Any → CANCELLED        (order:cancel sets all non-null parts to CANCELLED)
```
Each order has up to two independent parts (`coffeeStatus`, `otherStatus`).
A part field is `null` when the order contains no items of that type.

---

## Phase 4 — Shared types package

**Goal:** One source of truth for `Order`, `MenuItem`, `SocketEvent` etc.

Tasks:
- [x] `packages/shared/src/types.ts` — all domain types + socket payload shapes
- [x] `packages/shared/src/events.ts` — typed Socket.io event map
- [x] Both client and server import from `@coffee/shared`

This phase is small but must come before any frontend work. Skipping it means two weeks of type drift.

---

## Phase 5 — Ordering view

The most complex view. Customers use this — it must be good on both a 27" kiosk and a 390px phone screen.

Tasks:
- [x] Route: `/order` (staff/kiosk) and `/order?table={token}` (QR/mobile)
- [x] Resolve table token on load via `GET /api/v1/tables/:token`
- [x] Category tabs with horizontal scroll
- [x] Menu item grid — name, description, full-card tap target, quantity badge
- [x] Cart panel — item lines with collapsible per-line notes, quantity controls
- [x] Order submission → `POST /api/v1/orders`
- [x] Post-submission: cart clears immediately; Open tab shows live status (replaced confirmation screen — see decision log)
- [x] Socket subscription to `table:{tableId}` room → live order updates (replaced per-order `order:{id}` room)
- [x] Open tab: live order cards with part status chips and Deliver button
- [x] Order number field (bar only) inline in tab row; auto-filled, overridable
- [x] Global design tokens in `client/src/index.css` (CSS custom properties)
- [x] Orientation-aware two-panel layout (`useMediaQuery('(orientation: landscape)')`)
- [ ] Responsive mobile polish — test full flow on real phone at 390px (deferred to Phase 10)

**UX note:** The ordering flow must be completable in under 60 seconds. Anything that adds friction will cause abandonment.

---

## Phase 6 — Barista view

Shared screen for two roles: the prep person (works the espresso machine/grinder) and the barista (adds milk, finishes drinks). One URL, one screen, two panels — each person naturally owns one panel.

Tasks:
- [x] Route: `/barista`
- [x] Join `kitchen` socket room on mount
- [x] Two-panel orientation-aware layout (`useMediaQuery('(orientation: landscape)')`)
- [x] **Left/top panel — PENDING coffee orders (prep person's domain):**
  - Cards ordered by time received; each shows order number, coffee items with quantities and notes
  - Tapping a card emits `order:part:start { orderId, part: 'coffee' }` → card moves to right panel
  - Visual urgency: amber at >5 min waiting, red at >10 min
- [x] **Right/bottom panel — IN_PROGRESS coffee orders (barista's domain):**
  - Tapping a card emits `order:part:done { orderId, part: 'coffee' }` → card disappears (DONE, now on pickup display)
  - Barista can glance at left panel to anticipate upcoming milk requirements
- [x] Sound notification on new order arriving in left panel (implemented; toggle button currently hidden — code preserved for future re-exposure)

**Key UX insight:** The prep person and barista share one device but own one panel each. Neither needs to navigate anywhere — their work is always visible.

---

## Phase 7 — Counter view

The counter person handles all non-coffee items (teas, cold drinks, food) and owns the pickup display — they physically hand orders to customers and dismiss them from the display.

Tasks:
- [x] Route: `/counter`
- [x] Join both `kitchen` and `display` socket rooms on mount
- [x] Two-panel orientation-aware layout
- [x] **Left/top panel — other items to prepare:**
  - Shows orders with `otherStatus: PENDING` or `IN_PROGRESS`
  - Tapping a PENDING card emits `order:part:start { orderId, part: 'other' }`
  - A second tap (IN_PROGRESS) emits `order:part:done { orderId, part: 'other' }`
  - Cards show order number, other items with quantities and notes; status chip on each card
- [x] **Right/bottom panel — pickup display (DONE parts):**
  - Shows all parts with status DONE: coffee as "**42 C**", other as "**42 O**"
  - Coffee and other parts shown separately — each can be picked up independently
  - Badges include item detail lines below the number (counter person needs to know what's in the bag)
  - Tapping a part emits `order:part:picked_up { orderId, part }` → removes that badge from the display
  - This panel mirrors what customers see on `/pickup` — counter person and customers see the same state
- [x] Visual urgency on left panel (same amber/red thresholds as barista view)

---

## Phase 8 — Pickup Display view

The big screen customers watch. Minimal UI, maximum legibility.

Tasks:
- [x] Route: `/pickup`
- [x] Join `display` socket room on mount
- [x] Show order numbers in READY state as large cards ("42 C" / "42 O" format)
- [x] Animate new number appearing (fade + scale keyframe)
- [x] Remove number when `order:updated` (part no longer DONE) or `order:removed` event received
- [x] No interaction needed — purely display
- [x] High contrast, large font (5rem, readable from distance)
- [ ] Two columns (Ready for pickup / Being prepared) — deferred; requires joining kitchen room

---

## Phase 9 — Management view

Protected by JWT. Staff manage menu and view order history.

Tasks:
- [x] Route: `/management` — shows login page if no token in localStorage
- [x] Login page: password field → POST auth → store JWT in localStorage; Enter key submits; inline error display
- [x] **Menu management:**
  - Category CRUD (accordion list, add/edit/delete dialogs)
  - Item CRUD (name, description, price, type, sort order, availability toggle); delete rejects with 409 if items have orders
  - Category delete blocked with 409 if items exist
  - Drag-to-reorder deferred to Phase 2
- [x] **Table management:**
  - List tables; Bar shown as read-only
  - Add tables (label optional)
  - Rotate QR token with confirmation; delete protected if orders exist
  - QR download as PNG — deferred to Phase 10 (server-side generation)
- [x] **Order history:**
  - Date-range filter (defaults to today), expandable rows showing item detail
  - Status chips per part (coffee / other)
- [x] All mutations broadcast `menu:updated` to `management` socket room; ordering view subscribes and refreshes live
- [x] `apiFetch` helper in `client/src/views/management/apiHelper.ts` — injects Bearer token; on 401 clears token + redirects

---

## Post-Phase 9 additions

Tasks completed outside the original phase plan:

- [x] **Admin password change** — `AdminConfig` DB table, bcrypt hashing, `PUT /api/v1/auth/password`, Settings tab in management view
- [x] **Orders summary cards** — aggregate stats (order count, EE portions, milk L) + per-item breakdown; computed client-side from existing endpoint data
- [x] **i18n (EN / DE / RO)** — `react-i18next` + LanguageDetector; translation files for all views; Romanian CLDR plural forms
- [x] **Language stored in DB** — `AdminConfig.language`, public `GET /api/v1/auth/language`, protected `PUT /api/v1/management/settings/language`, `LanguageSync` component, language picker in Settings tab

---

## Phase 10 — QR / Mobile polish

Tasks:
- [x] QR code generation — implemented client-side via `qr-code-styling` instead of server-side `qrcode` package. Richer output (dot shapes, gradients, logo), no server dependency, download handled by the library's own `.download()` method.
- [x] Management Tables tab: styled QR dialog (`QrDialog.tsx`) with live preview, dot shapes, radial/linear gradients, logo upload, PNG download
- [x] QR base URL setting in Settings tab — stored in `AdminConfig.qrBaseUrl`; fallback to `window.location.origin` when blank. Allows generating QR codes that point to the local network IP rather than localhost.
- [x] Mobile ordering: tested full flow on real device
- [x] Viewport lock — `touch-action: manipulation` on `body` in `index.css` prevents double-tap zoom across all views without disabling pinch-zoom
- [ ] PWA manifest — permanently dropped; kiosk deployment makes "Add to Home Screen" irrelevant

---

## Phase 11 — Improvements & features

Priority order as agreed. Each item is independent.

### P1 — Socket reconnection recovery
- [ ] Re-fetch kitchen/counter state on socket `connect` event (fires on reconnect as well as first connect)
- [ ] Brief "Reconnected" toast so staff know a re-fetch happened

### P2 — Category-level pause
- [ ] Add `paused Boolean @default(false)` to `Category` schema
- [ ] `PATCH /api/v1/management/categories/:id/pause` — toggles flag
- [ ] Paused categories excluded from public menu snapshot
- [ ] Pause / Resume button per category in management accordion

### P3 — Dark mode
- [ ] Dark colour tokens in `client/src/index.css` under `[data-theme="dark"]` block
- [ ] `AdminConfig.darkMode Boolean @default(false)` — shop-wide, same two-tier pattern as language
- [ ] Toggle in Settings tab; applied via `document.documentElement.dataset.theme`
- [ ] MUI `ThemeProvider` wired to the same toggle for component-level theming

### P4 — Composition field on menu items
- [ ] Add `composition String?` to `MenuItem` schema
- [ ] Field in item create/edit dialogs in management
- [ ] Rendered on item cards in ordering view, below description, visually distinct

### P5 — Show/hide toggles for description and composition
- [ ] `AdminConfig.showDescription Boolean @default(true)` and `AdminConfig.showComposition Boolean @default(true)`
- [ ] Two checkboxes in Settings tab
- [ ] Ordering view reads flags on startup and applies to item card rendering

### P6 — Menu item images (composition visualization)
- [ ] `imageUrl` already exists on `MenuItem` and stored in DB — nothing renders it yet
- [ ] Render as fixed-size image on item cards in ordering view
- [ ] Show/hide controlled by a third toggle alongside P5

---

## Backlog — lower priority

- [ ] **Sound alerts re-exposed** — code exists in `BaristaView`, button just hidden; add toggle with localStorage persistence
- [ ] **Live shift stats** — "Today so far" stat cards on management home tab without navigating to Orders
- [ ] **Reconnection indicator** — banner when socket drops, disappears on reconnect
- [ ] **CSV export** — "Download CSV" on Orders tab; endpoint already returns all needed data

---

## Phase 12 — Production hardening

Tasks:
- [ ] `docker-compose.yml` (prod): client builds to `dist/`, served by nginx
- [ ] Nginx config: serve static, proxy `/api` and `/socket.io` to server
- [ ] Environment variable validation on server startup (fail fast if missing)
- [ ] Rate limiting on order submission endpoint
- [ ] PostgreSQL container with named volume for data persistence
- [ ] Health check endpoints for all containers
- [ ] `.env.example` complete and documented

---

## What's explicitly out of scope (v1)

- Payment processing
- Order modifiers (size, milk type) — use notes field
- Multi-user admin accounts
- Printer/receipt integration
- Analytics dashboard
- Customer accounts / loyalty
- Multiple locations
