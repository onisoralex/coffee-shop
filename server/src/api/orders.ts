// Orders REST API — POST /api/v1/orders (place order), GET /api/v1/orders/open (open orders
// for a table), GET /api/v1/orders/next-number, and GET /api/v1/orders/:id (poll status).
//
// After a successful POST, order:placed is emitted to three rooms:
//   kitchen          — barista screens receive the order immediately.
//   table:{tableId}  — the Open tab on the ordering view updates without polling.
//   order:{id}       — kept for any per-order subscribers (e.g. future customer-facing view).
//
// The router is created via a factory so it can hold a reference to the io instance
// without making io a module-level singleton (which would complicate testing later).
import { Router } from 'express'
import { z } from 'zod'
import type { Server as IoServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@coffee/shared'
import prisma from '../lib/prisma.js'
import * as orderService from '../services/order.service.js'

const PlaceOrderSchema = z.object({
  tableId: z.string().min(1),
  // number overrides the daily counter — used when switching paper blocks mid-shift.
  number: z.number().int().min(1).max(999).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().cuid(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1),
})

export function createOrdersRouter(io: IoServer<ClientToServerEvents, ServerToClientEvents>) {
  const router = Router()

  router.post('/', async (req, res) => {
    const result = PlaceOrderSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const order = await orderService.placeOrder(result.data)
      io.to('kitchen').emit('order:placed', order)
      io.to(`table:${order.tableId}`).emit('order:placed', order)
      io.to(`order:${order.id}`).emit('order:placed', order)
      res.status(201).json({ data: order })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const isInputError = message.includes('unavailable') || message.includes('Table not found')
      res
        .status(isInputError ? 422 : 500)
        .json({ error: message, code: isInputError ? 'INVALID_INPUT' : 'DB_ERROR' })
    }
  })

  // Returns all orders for a table where at least one part is still active
  // (PENDING, IN_PROGRESS, or DONE). Used by the Open tab on the ordering view.
  // tableId is required — there is no valid "no table" state.
  router.get('/open', async (req, res) => {
    const tableId = req.query['tableId']
    if (typeof tableId !== 'string' || tableId.trim() === '') {
      res.status(400).json({ error: 'tableId query param required', code: 'VALIDATION_ERROR' })
      return
    }
    try {
      const active: ('PENDING' | 'IN_PROGRESS' | 'DONE')[] = ['PENDING', 'IN_PROGRESS', 'DONE']
      const orders = await prisma.order.findMany({
        where: {
          tableId,
          OR: [
            { coffeeStatus: { in: active } },
            { otherStatus: { in: active } },
          ],
        },
        include: {
          items: {
            include: { menuItem: { select: { id: true, name: true, type: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      res.json({ data: orders })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  // Must be before /:id so Express doesn't swallow "next-number" as an order ID.
  router.get('/next-number', async (_req, res) => {
    try {
      const number = await orderService.peekNextNumber()
      res.json({ data: { number } })
    } catch {
      res.status(500).json({ error: 'Internal error', code: 'DB_ERROR' })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id)
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
