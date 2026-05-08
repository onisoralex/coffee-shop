import express from 'express'
import type { Express } from 'express'
import type { Server as HttpServer } from 'node:http'
import path from 'node:path'
import type { Server as IoServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@coffee/shared'
import authRouter from './api/auth.js'
import menuRouter from './api/menu.js'
import tablesRouter from './api/tables.js'
import { createOrdersRouter } from './api/orders.js'
import { createManagementRouter } from './api/management.js'

// Sets up Express with JSON middleware only.
// Routes are mounted separately in mountRoutes() so that the HTTP server and Socket.io
// can be created first — the orders router needs a live io reference.
export function createApp(): Express {
  const app = express()
  app.use(express.json())
  return app
}

// Mounts all API routes and the frontend (Vite dev middleware or express.static in prod).
// Must be called after initSocket() returns io, and before httpServer.listen().
// API routes are registered before Vite so /api/v1/* is handled by Express first.
//
// httpServer is passed so Vite can attach its HMR WebSocket to the same port (3001) rather
// than spinning up a separate server on 24678. Without this, HMR fails in Docker because
// only port 3001 is exposed to the host.
export async function mountRoutes(
  app: Express,
  io: IoServer<ClientToServerEvents, ServerToClientEvents>,
  httpServer: HttpServer
): Promise<void> {
  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/menu', menuRouter)
  app.use('/api/v1/orders', createOrdersRouter(io))
  app.use('/api/v1/tables', tablesRouter)
  app.use('/api/v1/management', createManagementRouter(io))

  const clientRoot = path.resolve(import.meta.dirname, '../../client')

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(clientRoot, 'dist')
    app.use(express.static(distPath))
    app.get('/*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  } else {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      root: clientRoot,
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }
}
