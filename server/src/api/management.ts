// Management REST API — all routes require Authorization: Bearer JWT.
//
// Menu mutations (category/item create, update, delete) fetch the updated public menu
// snapshot and broadcast menu:updated to the management socket room so the ordering
// view can refresh without polling. The management room is joined by the management
// frontend on mount.
//
// Deletion rules:
//   - Categories: rejected with 409 if the category still has items.
//   - Tables: rejected with 409 if the table has any orders (FK integrity + history).
//   - The Bar table (id='bar') cannot be deleted — it is a system constant.
import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import type { Server as IoServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents, MenuSnapshot } from '@coffee/shared'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
})

const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const ItemCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  type: z.enum(['COFFEE', 'OTHER']),
  categoryId: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
  ee: z.number().min(0).optional(),
  me: z.number().min(0).optional(),
  available: z.boolean().optional(),
})

const ItemUpdateSchema = ItemCreateSchema.partial()

const AvailabilitySchema = z.object({
  available: z.boolean(),
})

const TableCreateSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().max(100).nullable().optional(),
})

const OrderFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  tableId: z.string().optional(),
})

// Fetches the public menu snapshot (available items only) and broadcasts it.
async function broadcastMenuUpdate(io: IoServer<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { where: { available: true }, orderBy: { sortOrder: 'asc' } } },
  })
  const snapshot: MenuSnapshot = { categories }
  io.to('management').emit('menu:updated', snapshot)
}

export function createManagementRouter(io: IoServer<ClientToServerEvents, ServerToClientEvents>) {
  const router = Router()
  router.use(requireAuth)

  // ─── Categories ──────────────────────────────────────────────────────────────

  // Returns all categories with ALL items (no availability filter — management needs full visibility).
  router.get('/categories', async (_req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
      res.json({ data: categories })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.post('/categories', async (req, res) => {
    const result = CategoryCreateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const category = await prisma.category.create({ data: result.data })
      await broadcastMenuUpdate(io)
      res.status(201).json({ data: category })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/categories/:id', async (req, res) => {
    const result = CategoryUpdateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const category = await prisma.category.update({
        where: { id: req.params.id },
        data: result.data,
      })
      await broadcastMenuUpdate(io)
      res.json({ data: category })
    } catch {
      res.status(404).json({ error: 'Category not found', code: 'NOT_FOUND' })
    }
  })

  router.delete('/categories/:id', async (req, res) => {
    try {
      const count = await prisma.menuItem.count({ where: { categoryId: req.params.id } })
      if (count > 0) {
        res.status(409).json({ error: 'Category has items — delete or move items first', code: 'HAS_ITEMS' })
        return
      }
      await prisma.category.delete({ where: { id: req.params.id } })
      await broadcastMenuUpdate(io)
      res.status(204).end()
    } catch {
      res.status(404).json({ error: 'Category not found', code: 'NOT_FOUND' })
    }
  })

  // ─── Menu items ───────────────────────────────────────────────────────────────

  router.post('/items', async (req, res) => {
    const result = ItemCreateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const item = await prisma.menuItem.create({ data: result.data })
      await broadcastMenuUpdate(io)
      res.status(201).json({ data: item })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/items/:id', async (req, res) => {
    const result = ItemUpdateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const item = await prisma.menuItem.update({ where: { id: req.params.id }, data: result.data })
      await broadcastMenuUpdate(io)
      res.json({ data: item })
    } catch {
      res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })
    }
  })

  router.patch('/items/:id/availability', async (req, res) => {
    const result = AvailabilitySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data: { available: result.data.available },
      })
      await broadcastMenuUpdate(io)
      res.json({ data: item })
    } catch {
      res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })
    }
  })

  router.delete('/items/:id', async (req, res) => {
    try {
      await prisma.menuItem.delete({ where: { id: req.params.id } })
      await broadcastMenuUpdate(io)
      res.status(204).end()
    } catch {
      res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })
    }
  })

  // ─── Tables ───────────────────────────────────────────────────────────────────

  // Returns all tables including qrToken. Bar table is included — management may want to see it.
  router.get('/tables', async (_req, res) => {
    try {
      const tables = await prisma.table.findMany({ orderBy: { number: 'asc' } })
      res.json({ data: tables })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.post('/tables', async (req, res) => {
    const result = TableCreateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const table = await prisma.table.create({
        data: { ...result.data, qrToken: randomUUID() },
      })
      res.status(201).json({ data: table })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('Unique constraint')) {
        res.status(409).json({ error: 'Table number already exists', code: 'DUPLICATE' })
      } else {
        res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
      }
    }
  })

  router.delete('/tables/:id', async (req, res) => {
    if (req.params.id === 'bar') {
      res.status(409).json({ error: 'The Bar table cannot be deleted', code: 'PROTECTED' })
      return
    }
    try {
      const orderCount = await prisma.order.count({ where: { tableId: req.params.id } })
      if (orderCount > 0) {
        res.status(409).json({ error: 'Table has orders and cannot be deleted', code: 'HAS_ORDERS' })
        return
      }
      await prisma.table.delete({ where: { id: req.params.id } })
      res.status(204).end()
    } catch {
      res.status(404).json({ error: 'Table not found', code: 'NOT_FOUND' })
    }
  })

  router.post('/tables/:id/rotate-qr', async (req, res) => {
    if (req.params.id === 'bar') {
      res.status(409).json({ error: 'The Bar table has no QR code', code: 'PROTECTED' })
      return
    }
    try {
      const table = await prisma.table.update({
        where: { id: req.params.id },
        data: { qrToken: randomUUID() },
      })
      res.json({ data: table })
    } catch {
      res.status(404).json({ error: 'Table not found', code: 'NOT_FOUND' })
    }
  })

  // ─── Orders ───────────────────────────────────────────────────────────────────

  // Supports optional filters: ?from=YYYY-MM-DD &to=YYYY-MM-DD &tableId=X
  // Defaults to the current UTC date if no filter is provided. Returns up to 200 orders.
  router.get('/orders', async (req, res) => {
    const result = OrderFilterSchema.safeParse(req.query)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' })
      return
    }
    const { from, to, tableId } = result.data
    const today = new Date().toISOString().slice(0, 10)
    const fromDate = new Date((from ?? today) + 'T00:00:00.000Z')
    const toDate = new Date((to ?? from ?? today) + 'T23:59:59.999Z')
    try {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          ...(tableId ? { tableId } : {}),
        },
        include: {
          items: { include: { menuItem: { select: { id: true, name: true, type: true, ee: true, me: true } } } },
          table: { select: { id: true, number: true, label: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json({ data: orders })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.get('/orders/:id', async (req, res) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          items: { include: { menuItem: { select: { id: true, name: true, type: true, ee: true, me: true } } } },
          table: { select: { id: true, number: true, label: true } },
        },
      })
      if (!order) {
        res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' })
        return
      }
      res.json({ data: order })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  return router
}
