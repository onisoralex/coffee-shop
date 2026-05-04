# Architecture

## Communication model

```
Customer / Kiosk         Barista screens          Pickup display
     │                        │                        │
     │  REST POST /orders      │                        │
     ├────────────────────────►│  (server receives)     │
     │                        │                        │
     │◄── Socket order:placed ─┤── Socket order:placed ─┤
     │    (own order room)     │    (kitchen room)      │    (display room)
     │                        │                        │
     │                        │  Socket order:item:started
     │                        │◄─────────────────────── │ (barista taps item)
     │                        │                        │
     │◄── Socket order:ready ──┤──────────────────────►─┤
     │    (own order room)     │                        │  (number appears)
```

Management screens use **REST only** — no Socket.io needed for CRUD. However, the server broadcasts `menu:updated` on the `management` socket room after any menu change so ordering screens can refresh without polling.

---

## Database schema (Prisma)

### Core tables

```prisma
model Category {
  id        String     @id @default(cuid())
  name      String
  sortOrder Int        @default(0)
  items     MenuItem[]
}

model MenuItem {
  id          String      @id @default(cuid())
  name        String
  description String?
  price       Decimal     @db.Decimal(10,2)
  imageUrl    String?
  available   Boolean     @default(true)
  sortOrder   Int         @default(0)
  categoryId  String
  category    Category    @relation(fields: [categoryId], references: [id])
  orderItems  OrderItem[]
}

model Table {
  id       String  @id @default(cuid())
  number   Int     @unique
  label    String?          // e.g. "Window Table 3"
  qrToken  String  @unique  // part of QR URL, rotatable
  orders   Order[]
}

model Order {
  id         String      @id @default(cuid())
  number     Int         // Human-readable: 001–999 then wraps
  tableId    String?
  table      Table?      @relation(fields: [tableId], references: [id])
  status     OrderStatus @default(PLACED)
  total      Decimal     @db.Decimal(10,2)
  notes      String?
  items      OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model OrderItem {
  id         String          @id @default(cuid())
  orderId    String
  order      Order           @relation(fields: [orderId], references: [id])
  menuItemId String
  menuItem   MenuItem        @relation(fields: [menuItemId], references: [id])
  quantity   Int             @default(1)
  notes      String?         // Free-text modifiers for v1
  status     OrderItemStatus @default(PENDING)
}

enum OrderStatus {
  PLACED        // Just submitted
  IN_PROGRESS   // At least one item being made
  READY         // All items complete
  PICKED_UP     // Customer collected
  CANCELLED
}

enum OrderItemStatus {
  PENDING
  IN_PROGRESS
  DONE
}
```

---

## Socket.io events

### Rooms
| Room | Subscribers |
|------|-------------|
| `kitchen` | Prep view, Coordinator view |
| `display` | Pickup display |
| `order:{id}` | Customer's own device (tracks their order) |
| `management` | Management screens |

### Events: Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `order:item:start` | `{ orderId, itemId }` | Barista starts an item |
| `order:item:done` | `{ orderId, itemId }` | Barista marks item complete |
| `order:picked_up` | `{ orderId }` | Order collected, remove from display |
| `view:join` | `{ room }` | Client joins a socket room on connect |

### Events: Server → Client
| Event | Payload | Rooms |
|-------|---------|-------|
| `order:placed` | `Order` (full) | `kitchen`, `order:{id}` |
| `order:updated` | `Order` (full) | `kitchen`, `display`, `order:{id}` |
| `order:ready` | `{ orderId, number }` | `display`, `order:{id}` |
| `order:removed` | `{ orderId }` | `display` |
| `menu:updated` | `MenuSnapshot` | `management` |

**Rule:** Server always re-emits the full object, not a diff. Simpler client logic, acceptable payload size for a coffee shop.

---

## REST API endpoints

### Public (no auth)
```
POST   /api/v1/orders              Place an order
GET    /api/v1/orders/:id          Poll order status (fallback, primary is Socket)
GET    /api/v1/menu                Full menu snapshot for ordering screen
GET    /api/v1/tables/:token       Resolve QR token → table info
```

### Protected (Bearer JWT)
```
# Menu management
GET    /api/v1/management/categories
POST   /api/v1/management/categories
PUT    /api/v1/management/categories/:id
DELETE /api/v1/management/categories/:id

GET    /api/v1/management/items
POST   /api/v1/management/items
PUT    /api/v1/management/items/:id
DELETE /api/v1/management/items/:id
PATCH  /api/v1/management/items/:id/availability   { available: boolean }

# Tables & QR
GET    /api/v1/management/tables
POST   /api/v1/management/tables
DELETE /api/v1/management/tables/:id
POST   /api/v1/management/tables/:id/rotate-qr     Generate new QR token

# Orders (read-only for management)
GET    /api/v1/management/orders                   Filter by status, date
GET    /api/v1/management/orders/:id

# Auth
POST   /api/v1/auth/login          { password } → { token }
```

---

## Order number strategy

Use a daily counter reset (001–999). Stored in a `DailyCounter` table with a date field. Readable by customers: "Your order is **042**". Wrap back to 001 after 999 or at midnight.

---

## QR code flow

1. Management creates a table, server generates a unique `qrToken` (UUID).
2. Management page renders `GET /api/v1/management/tables/:id/qr` as a downloadable PNG (use `qrcode` npm package server-side).
3. QR encodes: `https://{APP_URL}/order?table={qrToken}`
4. Client resolves token → table ID before displaying the ordering UI.

---

## Frontend state management

Use **Zustand** stores per domain:
- `useOrderStore` — current order being built, submission state
- `useMenuStore` — cached menu data
- `useSocketStore` — socket connection status, reconnection handling

Avoid putting socket listeners in components directly — use a custom `useSocket` hook that wraps the store updates.

---

## Docker services

```yaml
services:
  db:       postgres:16-alpine
  server:   Node.js backend (tsx watch in dev, compiled in prod)
  client:   Vite dev server in dev, nginx serving dist/ in prod
```

In dev: client and server both hot-reload. Vite proxies `/api` and `/socket.io` to the server container to avoid CORS complexity.
