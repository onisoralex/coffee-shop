import bcrypt from 'bcryptjs'
import prisma from './prisma.js'

const SINGLETON_ID = 'singleton'

// Hashes ADMIN_PASSWORD from the environment and writes it to AdminConfig on first startup.
// If the row already exists, this is a no-op — the env var is ignored after initial seeding.
// Throws if ADMIN_PASSWORD is unset and no row exists yet.
export async function ensureAdminPassword(): Promise<void> {
  const existing = await prisma.adminConfig.findUnique({ where: { id: SINGLETON_ID } })
  if (existing) return

  const initial = process.env.ADMIN_PASSWORD
  if (!initial) throw new Error('ADMIN_PASSWORD env var is required for initial admin setup')

  const passwordHash = await bcrypt.hash(initial, 10)
  await prisma.adminConfig.create({ data: { id: SINGLETON_ID, passwordHash } })
  console.log('Admin password seeded from ADMIN_PASSWORD env var')
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const config = await prisma.adminConfig.findUnique({ where: { id: SINGLETON_ID } })
  if (!config) return false
  return bcrypt.compare(password, config.passwordHash)
}

export async function updateAdminPassword(newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.adminConfig.update({ where: { id: SINGLETON_ID }, data: { passwordHash } })
}

export async function getLanguage(): Promise<string> {
  const config = await prisma.adminConfig.findUnique({ where: { id: SINGLETON_ID } })
  return config?.language ?? 'en'
}

export async function setLanguage(language: string): Promise<void> {
  await prisma.adminConfig.update({ where: { id: SINGLETON_ID }, data: { language } })
}

export async function getQrBaseUrl(): Promise<string> {
  const config = await prisma.adminConfig.findUnique({ where: { id: SINGLETON_ID } })
  return config?.qrBaseUrl ?? ''
}

export async function setQrBaseUrl(qrBaseUrl: string): Promise<void> {
  await prisma.adminConfig.update({ where: { id: SINGLETON_ID }, data: { qrBaseUrl } })
}
