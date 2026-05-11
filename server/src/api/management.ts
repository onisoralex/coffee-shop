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
import { setLanguage, getQrBaseUrl, setQrBaseUrl, setDarkMode, setShowDescription, setShowComposition } from '../lib/adminConfig.js'

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
  composition: z.string().max(500).nullable().optional(),
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

// Fetches the public menu snapshot (available items in non-paused categories) and broadcasts it.
// The ordering view subscribes to menu:updated via the management socket room, so this snapshot
// must match the public GET /menu endpoint filter — paused categories and unavailable items excluded.
async function broadcastMenuUpdate(io: IoServer<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { paused: false },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { available: true },
        orderBy: { sortOrder: 'asc' },
        include: { translations: { select: { language: true, description: true, composition: true } } },
      },
    },
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
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: { translations: { select: { language: true, description: true, composition: true } } },
          },
        },
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

  // Toggles the paused flag. Paused categories are excluded from the public menu snapshot
  // and the menu:updated broadcast, so the ordering view stops showing them immediately.
  router.patch('/categories/:id/pause', async (req, res) => {
    try {
      const category = await prisma.category.findUnique({ where: { id: req.params.id } })
      if (!category) {
        res.status(404).json({ error: 'Category not found', code: 'NOT_FOUND' })
        return
      }
      const updated = await prisma.category.update({
        where: { id: req.params.id },
        data: { paused: !category.paused },
      })
      await broadcastMenuUpdate(io)
      res.json({ data: updated })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
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

  const TranslationSchema = z.object({
    description: z.string().max(500).nullable().optional(),
    composition: z.string().max(500).nullable().optional(),
  })

  // Upserts a translation row for the given item + language.
  // If both fields are null/empty after trimming, the row is deleted (no point storing empty translations).
  // language must be a supported non-English code — EN text lives in the base MenuItem fields.
  router.put('/items/:id/translations/:language', async (req, res) => {
    const { id, language } = req.params
    if (!['de', 'ro'].includes(language)) {
      res.status(400).json({ error: 'Unsupported language code', code: 'VALIDATION_ERROR' })
      return
    }
    const result = TranslationSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    const description = result.data.description?.trim() || null
    const composition = result.data.composition?.trim() || null
    try {
      if (description === null && composition === null) {
        await prisma.menuItemTranslation.deleteMany({ where: { itemId: id, language } })
      } else {
        await prisma.menuItemTranslation.upsert({
          where: { itemId_language: { itemId: id, language } },
          create: { itemId: id, language, description, composition },
          update: { description, composition },
        })
      }
      await broadcastMenuUpdate(io)
      res.json({ data: { ok: true } })
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

  // ─── Settings ────────────────────────────────────────────────────────────────

  const LanguageSchema = z.object({
    language: z.enum(['en', 'de', 'ro']),
  })

  router.put('/settings/language', async (req, res) => {
    const result = LanguageSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'language must be one of: en, de, ro', code: 'VALIDATION_ERROR' })
      return
    }
    await setLanguage(result.data.language)
    res.json({ data: { ok: true } })
  })

  // Empty string means "use server origin" — the client falls back to window.location.origin.
  // Explicit http/https check instead of z.string().url(): new URL() can throw on exotic
  // schemes (e.g. "h://j") rather than returning a parse failure, which bypasses safeParse.
  const QrBaseUrlSchema = z.object({
    qrBaseUrl: z.string().refine(
      (v) => {
        if (v === '') return true
        try {
          const u = new URL(v)
          return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'qrBaseUrl must be an http:// or https:// URL, or empty' }
    ),
  })

  router.get('/settings/qr-base-url', async (_req, res) => {
    try {
      const qrBaseUrl = await getQrBaseUrl()
      res.json({ data: { qrBaseUrl } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/settings/dark-mode', async (req, res) => {
    const result = z.object({ darkMode: z.boolean() }).safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'darkMode must be a boolean', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      await setDarkMode(result.data.darkMode)
      res.json({ data: { ok: true } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/settings/qr-base-url', async (req, res) => {
    const result = QrBaseUrlSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: result.error.errors[0]?.message ?? 'Invalid URL', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      await setQrBaseUrl(result.data.qrBaseUrl)
      res.json({ data: { ok: true } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/settings/show-description', async (req, res) => {
    const result = z.object({ showDescription: z.boolean() }).safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'showDescription must be a boolean', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      await setShowDescription(result.data.showDescription)
      res.json({ data: { ok: true } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.put('/settings/show-composition', async (req, res) => {
    const result = z.object({ showComposition: z.boolean() }).safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'showComposition must be a boolean', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      await setShowComposition(result.data.showComposition)
      res.json({ data: { ok: true } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  return router
}
