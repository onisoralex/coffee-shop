import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { verifyAdminPassword, updateAdminPassword } from '../lib/adminConfig.js'

const router = Router()

const LoginSchema = z.object({
  password: z.string().min(1),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

router.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Invalid body', code: 'VALIDATION_ERROR' })
    return
  }
  const valid = await verifyAdminPassword(result.data.password)
  if (!valid) {
    res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' })
    return
  }
  const secret = process.env.JWT_SECRET
  if (!secret) {
    res.status(500).json({ error: 'Server misconfigured', code: 'CONFIG_ERROR' })
    return
  }
  const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '24h' })
  res.json({ data: { token } })
})

// Requires a valid JWT. Verifies the current password before accepting the new one
// so that a stolen session token alone isn't enough to change credentials.
router.put('/password', requireAuth, async (req, res) => {
  const result = ChangePasswordSchema.safeParse(req.body)
  if (!result.success) {
    const message = result.error.errors[0]?.message ?? 'Invalid body'
    res.status(400).json({ error: message, code: 'VALIDATION_ERROR' })
    return
  }
  const valid = await verifyAdminPassword(result.data.currentPassword)
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
    return
  }
  await updateAdminPassword(result.data.newPassword)
  res.json({ data: { ok: true } })
})

export default router
