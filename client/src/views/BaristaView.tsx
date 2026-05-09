// Barista view — two-panel real-time kitchen screen shared by the prep person (left/top)
// and the finishing barista (right/bottom).
//
// Left/top panel — PENDING coffee orders: the prep person taps a card to claim it and start
//   preparing. Tapping emits order:part:start; the server responds with order:updated which
//   moves the card to the right panel.
//
// Right/bottom panel — IN_PROGRESS coffee orders: the barista taps when drinks are ready.
//   Tapping emits order:part:done; the card disappears from this view (counter handles pickup).
//
// Both panels share a single real-time subscription on the kitchen socket room. Initial state
// is fetched from GET /api/v1/orders/kitchen (all coffee orders that are PENDING or IN_PROGRESS).
//
// Visual urgency: cards get an amber border after 5 minutes and a red border after 10 minutes.
// A 60-second interval keeps the borders live without per-card timers.
// Sound notification (Web Audio API beep) is implemented but the toggle button is currently
// hidden — the state and playBeep logic remain so the feature can be re-exposed without rework.
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Order } from '@coffee/shared'
import { getSocket } from '../hooks/useSocket.js'

const AMBER_MS = 5 * 60 * 1_000
const RED_MS = 10 * 60 * 1_000

function urgencyBorderColor(createdAt: string): string {
  const age = Date.now() - new Date(createdAt).getTime()
  if (age >= RED_MS) return 'error.main'
  if (age >= AMBER_MS) return 'warning.main'
  return 'divider'
}

// Generates a short 880 Hz beep via Web Audio API — no asset needed.
function playBeep(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch { /* AudioContext unavailable in some environments */ }
}

export default function BaristaView() {
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const [orders, setOrders] = useState<Order[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  // Incrementing this forces a re-render so urgency borders stay current without per-card timers.
  const [, setTick] = useState(0)
  // Ref so the order:placed handler always reads the current sound preference without needing
  // to be re-registered every time soundEnabled changes.
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  // Hydrate both panels from REST on mount — socket handles all subsequent changes.
  useEffect(() => {
    fetch('/api/v1/orders/kitchen')
      .then((r) => r.json())
      .then((json: { data?: Order[] }) => { if (json.data) setOrders(json.data) })
      .catch(() => {})
  }, [])

  // Join the kitchen room and subscribe to real-time order events.
  useEffect(() => {
    const socket = getSocket()
    socket.emit('view:join', { room: 'kitchen' })

    const handlePlaced = (order: Order) => {
      if (order.coffeeStatus !== 'PENDING') return
      setOrders((prev) => [...prev, order])
      if (soundEnabledRef.current) playBeep()
    }

    const handleUpdated = (order: Order) => {
      const active = order.coffeeStatus === 'PENDING' || order.coffeeStatus === 'IN_PROGRESS'
      setOrders((prev) => {
        if (!active) return prev.filter((o) => o.id !== order.id)
        const exists = prev.some((o) => o.id === order.id)
        return exists ? prev.map((o) => (o.id === order.id ? order : o)) : prev
      })
    }

    socket.on('order:placed', handlePlaced)
    socket.on('order:updated', handleUpdated)
    return () => {
      socket.off('order:placed', handlePlaced)
      socket.off('order:updated', handleUpdated)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const startOrder = useCallback((orderId: string) => {
    getSocket().emit('order:part:start', { orderId, part: 'coffee' })
  }, [])

  const doneOrder = useCallback((orderId: string) => {
    getSocket().emit('order:part:done', { orderId, part: 'coffee' })
  }, [])

  const pending = orders.filter((o) => o.coffeeStatus === 'PENDING')
  const inProgress = orders.filter((o) => o.coffeeStatus === 'IN_PROGRESS')

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRight: isLandscape ? 1 : 0,
          borderBottom: isLandscape ? 0 : 1,
          borderColor: 'divider',
        }}
      >
        <PanelHeader
          title="Pending"
          count={pending.length}
        />
        <OrderList orders={pending} emptyLabel="No pending orders" onTap={startOrder} />
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PanelHeader title="In Progress" count={inProgress.length} />
        <OrderList orders={inProgress} emptyLabel="Nothing in progress" onTap={doneOrder} />
      </Box>
    </Box>
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({ title, count, right }: {
  title: string
  count: number
  right?: ReactNode
}) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 1.5,
          flexShrink: 0,
          bgcolor: 'background.paper',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography fontWeight="bold" sx={{ fontSize: 'var(--fs-primary)' }}>
            {title}
          </Typography>
          {count > 0 && (
            <Typography color="text.secondary" sx={{ fontSize: 'var(--fs-secondary)' }}>
              {count}
            </Typography>
          )}
        </Box>
        {right}
      </Box>
      <Divider sx={{ flexShrink: 0 }} />
    </>
  )
}

// ─── Order list ───────────────────────────────────────────────────────────────

function OrderList({ orders, emptyLabel, onTap }: {
  orders: Order[]
  emptyLabel: string
  onTap: (orderId: string) => void
}) {
  if (orders.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.disabled" sx={{ fontSize: 'var(--fs-secondary)' }}>
          {emptyLabel}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onTap={onTap} />
        ))}
      </Box>
    </Box>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onTap }: { order: Order; onTap: (orderId: string) => void }) {
  const coffeeItems = order.items.filter((item) => item.menuItem.type === 'COFFEE')
  const borderColor = urgencyBorderColor(order.createdAt)
  const isUrgent = borderColor !== 'divider'

  return (
    <Card
      variant="outlined"
      sx={{ borderColor, borderWidth: isUrgent ? 2 : 1 }}
    >
      <CardActionArea onClick={() => onTap(order.id)}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography fontWeight="bold" sx={{ fontSize: 'var(--fs-primary)' }}>
              #{order.number}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 'var(--fs-secondary)' }}>
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          {coffeeItems.map((item) => (
            <Typography key={item.id} sx={{ fontSize: 'var(--fs-secondary)' }}>
              {item.quantity}× {item.menuItem.name}
              {item.notes ? ` — ${item.notes}` : ''}
            </Typography>
          ))}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
