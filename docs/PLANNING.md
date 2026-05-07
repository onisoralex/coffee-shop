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
- [ ] Route: `/barista`
- [ ] Join `kitchen` socket room on mount
- [ ] Two-panel orientation-aware layout (`useMediaQuery('(orientation: landscape)')`)
- [ ] **Left/top panel — PENDING coffee orders (prep person's domain):**
  - Cards ordered by time received; each shows order number, coffee items with quantities and notes
  - Tapping a card emits `order:part:start { orderId, part: 'coffee' }` → card moves to right panel
  - Visual urgency: amber at >5 min waiting, red at >10 min
- [ ] **Right/bottom panel — IN_PROGRESS coffee orders (barista's domain):**
  - Tapping a card emits `order:part:done { orderId, part: 'coffee' }` → card disappears (DONE, now on pickup display)
  - Barista can glance at left panel to anticipate upcoming milk requirements
- [ ] Sound notification on new order arriving in left panel (user-toggleable)

**Key UX insight:** The prep person and barista share one device but own one panel each. Neither needs to navigate anywhere — their work is always visible.

---

## Phase 7 — Counter view

The counter person handles all non-coffee items (teas, cold drinks, food) and owns the pickup display — they physically hand orders to customers and dismiss them from the display.

Tasks:
- [ ] Route: `/counter`
- [ ] Join both `kitchen` and `display` socket rooms on mount
- [ ] Two-panel orientation-aware layout
- [ ] **Left/top panel — other items to prepare:**
  - Shows orders with `otherStatus: PENDING` or `IN_PROGRESS`
  - Tapping a PENDING card emits `order:part:start { orderId, part: 'other' }`
  - A second tap (IN_PROGRESS) emits `order:part:done { orderId, part: 'other' }`
  - Cards show order number, other items with quantities and notes
- [ ] **Right/bottom panel — pickup display (DONE parts):**
  - Shows all parts with status DONE: coffee as "**123 C**", other as "**123 O**"
  - Coffee and other parts shown separately — each can be picked up independently
  - Tapping a part emits `order:part:picked_up { orderId, part }` → removes that badge from the display
  - This panel mirrors what customers see on `/pickup` — counter person and customers see the same state
- [ ] Visual urgency on left panel (same amber/red thresholds as barista view)

---

## Phase 8 — Pickup Display view

The big screen customers watch. Minimal UI, maximum legibility.

Tasks:
- [ ] Route: `/pickup`
- [ ] Join `display` socket room on mount
- [ ] Show order numbers in READY state as large cards
- [ ] Animate new number appearing
- [ ] Remove number when `order:removed` event received
- [ ] No interaction needed — purely display
- [ ] High contrast, large font (readable from 3m away)
- [ ] Option: two columns (Ready for pickup / Being prepared) for better UX

---

## Phase 9 — Management view

Protected by JWT. Staff manage menu and view order history.

Tasks:
- [ ] Route: `/management` — redirect to `/management/login` if no token
- [ ] Login page: password field → POST auth → store JWT in localStorage
- [ ] **Menu management:**
  - Category CRUD (reorderable)
  - Item CRUD (name, description, price, image upload or URL, availability toggle)
  - Drag-to-reorder items within category (nice-to-have, Phase 2)
- [ ] **Table management:**
  - List tables with QR download button
  - Add/remove tables
  - Rotate QR token
- [ ] **Order history:**
  - Filterable list: date range, status
  - Order detail: items, time, table
- [ ] All mutations broadcast `menu:updated` via Socket so ordering screens refresh

---

## Phase 10 — QR / Mobile polish

Tasks:
- [ ] Server-side QR PNG generation (`qrcode` package) at `GET /api/v1/management/tables/:id/qr`
- [ ] Management page renders QR inline + download button
- [ ] Mobile ordering: test full flow on real device
- [ ] PWA manifest for "Add to Home Screen" (optional but nice for table QR use)
- [ ] Prevent kiosk view from being scrollable/zoomable (viewport lock)

---

## Phase 11 — Production hardening

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
