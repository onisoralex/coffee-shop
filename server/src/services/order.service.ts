// Core business logic for orders: creation, status transitions, and number management.
//
// Order number model: numbers are human-readable identifiers on paper tickets (1–999, daily
// reset). They are NOT unique keys — the order UUID is. Staff can override the number when
// switching paper blocks mid-shift; overriding also resets the daily counter so subsequent
// auto-increments resume from the new value rather than from where the counter was before.
//
// Status model: each order has up to two independent parts (coffeeStatus, otherStatus).
// A part is null when the order contains no items of that type — null parts are invisible
// to the kitchen and pickup display. Parts transition independently: coffee can be PICKED_UP
// while other items are still IN_PROGRESS.
import prisma from '../lib/prisma.js'
import type { Order, OrderPart } from '@coffee/shared'
import { type Prisma } from '@prisma/client'

// Narrow Prisma query type so mapToResponse stays type-safe without any casts on fields.
const ITEM_INCLUDE = {
  items: {
    include: {
      menuItem: { select: { id: true, name: true, type: true } },
    },
  },
} as const satisfies Prisma.OrderInclude

type OrderFull = Prisma.OrderGetPayload<{ include: typeof ITEM_INCLUDE }>

// Converts a Prisma query result to the shared Order type. The enum casts on coffeeStatus
// and otherStatus are safe because the DB enforces the PartStatus enum — Prisma just types
// them as string at the TypeScript level when the field is nullable.
function mapToResponse(order: OrderFull): Order {
  return {
    id: order.id,
    number: order.number,
    tableId: order.tableId,
    coffeeStatus: order.coffeeStatus as Order['coffeeStatus'],
    otherStatus: order.otherStatus as Order['otherStatus'],
    items: order.items.map(item => ({
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      menuItem: {
        id: item.menuItem.id,
        name: item.menuItem.name,
        type: item.menuItem.type as 'COFFEE' | 'OTHER',
      },
      quantity: item.quantity,
      notes: item.notes,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}

// Atomically increments the daily counter and wraps at 999.
// Uses a transaction to prevent two concurrent orders getting the same number.
async function getNextOrderNumber(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyCounter.findUnique({ where: { date: today } })
    const next = existing === null ? 1 : existing.counter >= 999 ? 1 : existing.counter + 1
    await tx.dailyCounter.upsert({
      where: { date: today },
      update: { counter: next },
      create: { date: today, counter: next },
    })
    return next
  })
}

// Read-only preview of what the next auto-assigned number would be.
// Does NOT increment the counter — two concurrent previews will return the same number.
// That is acceptable: number is display-only, UUID is the real PK.
export async function peekNextNumber(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const counter = await prisma.dailyCounter.findUnique({ where: { date: today } })
  return counter === null ? 1 : counter.counter >= 999 ? 1 : counter.counter + 1
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ITEM_INCLUDE,
  })
  return order ? mapToResponse(order) : null
}

// Creates an order from validated input. Validates that all referenced menu items are
// available and that the table exists (if provided), then determines which parts to open
// based on item types. coffeeStatus and otherStatus are set to PENDING only when the order
// contains at least one item of that type; otherwise they remain null and are invisible
// to the kitchen queue and pickup display for that part.
export async function placeOrder(input: {
  tableId: string
  number?: number
  items: { menuItemId: string; quantity: number; notes?: string }[]
}): Promise<Order> {
  const uniqueIds = [...new Set(input.items.map(i => i.menuItemId))]
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: uniqueIds }, available: true },
  })
  if (menuItems.length !== uniqueIds.length) {
    throw new Error('One or more menu items are unavailable or do not exist')
  }

  const table = await prisma.table.findUnique({ where: { id: input.tableId } })
  if (!table) throw new Error('Table not found')

  const menuItemMap = new Map(menuItems.map(m => [m.id, m]))
  const hasCoffee = input.items.some(i => menuItemMap.get(i.menuItemId)?.type === 'COFFEE')
  const hasOther = input.items.some(i => menuItemMap.get(i.menuItemId)?.type === 'OTHER')

  // If a number is provided, use it and sync the daily counter to match so that
  // the next auto-increment resumes from there (e.g. override 200 → next auto is 201).
  let number: number
  if (input.number !== undefined) {
    number = input.number
    const today = new Date().toISOString().slice(0, 10)
    await prisma.dailyCounter.upsert({
      where: { date: today },
      update: { counter: input.number },
      create: { date: today, counter: input.number },
    })
  } else {
    number = await getNextOrderNumber()
  }

  const order = await prisma.order.create({
    data: {
      number,
      tableId: input.tableId,
      coffeeStatus: hasCoffee ? 'PENDING' : null,
      otherStatus: hasOther ? 'PENDING' : null,
      items: {
        create: input.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes ?? null,
        })),
      },
    },
    include: ITEM_INCLUDE,
  })

  return mapToResponse(order)
}

// State transition helpers. Return null if the order doesn't exist or the transition is invalid
// (wrong current status). updateMany accepts arbitrary where conditions so we can enforce the
// required precondition atomically without a separate read.

export async function startPart(orderId: string, part: OrderPart): Promise<Order | null> {
  const field = part === 'coffee' ? 'coffeeStatus' : 'otherStatus'
  const result = await prisma.order.updateMany({
    where: { id: orderId, [field]: 'PENDING' },
    data: { [field]: 'IN_PROGRESS' },
  })
  return result.count === 0 ? null : getOrder(orderId)
}

export async function donePart(orderId: string, part: OrderPart): Promise<Order | null> {
  const field = part === 'coffee' ? 'coffeeStatus' : 'otherStatus'
  const result = await prisma.order.updateMany({
    where: { id: orderId, [field]: 'IN_PROGRESS' },
    data: { [field]: 'DONE' },
  })
  return result.count === 0 ? null : getOrder(orderId)
}

export async function pickedUpPart(orderId: string, part: OrderPart): Promise<Order | null> {
  const field = part === 'coffee' ? 'coffeeStatus' : 'otherStatus'
  const result = await prisma.order.updateMany({
    where: { id: orderId, [field]: 'DONE' },
    data: { [field]: 'PICKED_UP' },
  })
  return result.count === 0 ? null : getOrder(orderId)
}

// Sets all active (non-null, non-CANCELLED) parts to CANCELLED in a single DB transaction.
// The two updateMany operations target different columns, so Postgres applies them sequentially
// within the transaction with no conflict.
export async function cancelOrder(orderId: string): Promise<Order | null> {
  const active = ['PENDING', 'IN_PROGRESS', 'DONE', 'PICKED_UP'] as const
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: orderId, coffeeStatus: { in: [...active] } },
      data: { coffeeStatus: 'CANCELLED' },
    }),
    prisma.order.updateMany({
      where: { id: orderId, otherStatus: { in: [...active] } },
      data: { otherStatus: 'CANCELLED' },
    }),
  ])
  return getOrder(orderId)
}
