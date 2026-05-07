// Canonical transport types for the coffee shop system.
// These are plain object shapes safe to serialize over HTTP and Socket.io.
// Prisma model types live server-side only; these are what the client sees.

export type ItemType = 'COFFEE' | 'OTHER'

// Lifecycle of one part (coffee or other) within an order.
// An order has up to two parts depending on which item types it contains.
// There is no separate order-level status — everything is tracked here.
export type PartStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'PICKED_UP' | 'CANCELLED'

export type OrderPart = 'coffee' | 'other'

export interface Category {
  id: string
  name: string
  sortOrder: number
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  available: boolean
  sortOrder: number
  type: ItemType
  ee: number
  me: number
  categoryId: string
}

export interface MenuSnapshot {
  categories: (Category & { items: MenuItem[] })[]
}

export interface Table {
  id: string
  number: number
  label: string | null
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  menuItem: Pick<MenuItem, 'id' | 'name' | 'type'>
  quantity: number
  notes: string | null
  // No status — tracked at the part level on Order
}

export interface Order {
  id: string
  number: number
  tableId: string
  // Null when the order contains no items of that type
  coffeeStatus: PartStatus | null
  otherStatus: PartStatus | null
  items: OrderItem[]
  createdAt: string  // ISO 8601 — Dates are strings over the wire
  updatedAt: string
}

// ─── Socket.io event payloads ─────────────────────────────────────────────────

export interface ViewJoinPayload {
  room: string
}

export interface OrderPartActionPayload {
  orderId: string
  part: OrderPart
}

export interface OrderCancelPayload {
  orderId: string
}
