import { Router } from 'express'
import prisma from '../lib/prisma.js'
import type { MenuSnapshot } from '@coffee/shared'

const router = Router()

router.get('/', async (_req, res) => {
  try {
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
    res.json({ data: snapshot })
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'DB_ERROR' })
  }
})

export default router
