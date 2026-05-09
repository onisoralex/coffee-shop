import { createServer } from 'node:http'
import { createApp, mountRoutes } from './app.js'
import { initSocket } from './socket/index.js'
import { ensureAdminPassword } from './lib/adminConfig.js'

const PORT = Number(process.env.PORT ?? 3001)

await ensureAdminPassword()

const app = createApp()
const httpServer = createServer(app)
const io = initSocket(httpServer)
await mountRoutes(app, io, httpServer)

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
