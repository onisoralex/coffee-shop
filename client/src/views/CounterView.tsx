// Counter view — two-panel screen for the counter person.
//
// Left/top panel — other items to prepare (teas, cold drinks, food):
//   Shows all orders where otherStatus is PENDING or IN_PROGRESS. Tapping a PENDING
//   card emits order:part:start; tapping an IN_PROGRESS card emits order:part:done.
//   A status chip on each card shows the current state so the action is always clear.
//   Visual urgency: amber border >5 min, red >10 min (same thresholds as Barista view).
//
// Right/bottom panel — pickup display:
//   Large tappable badges for every DONE part: "42 C" (coffee) or "42 O" (other).
//   Parts are dismissed independently — tapping emits order:part:picked_up for that part.
//   Mirrors what customers see on /pickup. Counter person and customer see the same state.
//
// Joins both kitchen (prep and done events) and display (picked_up / removed events) rooms.
// Having both rooms means: order:part:done reaches the counter via kitchen, order:removed via
// display. Some order:updated events arrive twice (once per room) — the handler is idempotent.
import { type ReactNode, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
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

// An order belongs in counter state as long as it has prep work pending/in-progress
// OR has at least one DONE part waiting on the pickup display.
function isRelevant(order: Order): boolean {
  return (
    order.otherStatus === 'PENDING' ||
    order.otherStatus === 'IN_PROGRESS' ||
    order.coffeeStatus === 'DONE' ||
    order.otherStatus === 'DONE'
  )
}

interface DonePart {
  orderId: string
  number: number
  part: 'coffee' | 'other'
  items: Array<{ id: string; quantity: number; notes: string | null; menuItem: { name: string } }>
}

export default function CounterView() {
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const [orders, setOrders] = useState<Order[]>([])
  const [, setTick] = useState(0)

  // Hydrate from REST on mount — socket handles all subsequent changes.
  useEffect(() => {
    fetch('/api/v1/orders/counter')
      .then((r) => r.json())
      .then((json: { data?: Order[] }) => { if (json.data) setOrders(json.data) })
      .catch(() => {})
  }, [])

  // Join both rooms and subscribe. order:updated is idempotent so duplicate deliveries
  // (e.g. order:part:done arrives on both kitchen and display) are safe.
  useEffect(() => {
    const socket = getSocket()
    socket.emit('view:join', { room: 'kitchen' })
    socket.emit('view:join', { room: 'display' })

    const handlePlaced = (order: Order) => {
      if (isRelevant(order)) setOrders((prev) => [...prev, order])
    }

    const handleUpdated = (order: Order) => {
      const relevant = isRelevant(order)
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id)
        if (!relevant) return exists ? prev.filter((o) => o.id !== order.id) : prev
        return exists ? prev.map((o) => (o.id === order.id ? order : o)) : [...prev, order]
      })
    }

    const handleRemoved = ({ orderId }: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
    }

    socket.on('order:placed', handlePlaced)
    socket.on('order:updated', handleUpdated)
    socket.on('order:removed', handleRemoved)
    return () => {
      socket.off('order:placed', handlePlaced)
      socket.off('order:updated', handleUpdated)
      socket.off('order:removed', handleRemoved)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const prepOrders = orders.filter(
    (o) => o.otherStatus === 'PENDING' || o.otherStatus === 'IN_PROGRESS'
  )

  const doneParts: DonePart[] = orders
    .flatMap((o) => [
      ...(o.coffeeStatus === 'DONE' ? [{
        orderId: o.id, number: o.number, part: 'coffee' as const,
        items: o.items.filter((i) => i.menuItem.type === 'COFFEE'),
      }] : []),
      ...(o.otherStatus === 'DONE' ? [{
        orderId: o.id, number: o.number, part: 'other' as const,
        items: o.items.filter((i) => i.menuItem.type === 'OTHER'),
      }] : []),
    ])
    .sort((a, b) => a.number - b.number)

  const handlePrepTap = (order: Order) => {
    const socket = getSocket()
    if (order.otherStatus === 'PENDING') {
      socket.emit('order:part:start', { orderId: order.id, part: 'other' })
    } else if (order.otherStatus === 'IN_PROGRESS') {
      socket.emit('order:part:done', { orderId: order.id, part: 'other' })
    }
  }

  const handlePickup = (orderId: string, part: 'coffee' | 'other') => {
    getSocket().emit('order:part:picked_up', { orderId, part })
  }

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
        <PanelHeader title="Prepare" count={prepOrders.length} />
        <PrepList orders={prepOrders} onTap={handlePrepTap} />
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
        <PanelHeader title="Ready for pickup" count={doneParts.length} />
        <PickupDisplay parts={doneParts} onPickup={handlePickup} />
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
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          flexShrink: 0,
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

// ─── Prep list ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting',
  IN_PROGRESS: 'Preparing…',
}

const STATUS_COLOR: Record<string, 'default' | 'warning'> = {
  PENDING: 'default',
  IN_PROGRESS: 'warning',
}

function PrepList({ orders, onTap }: { orders: Order[]; onTap: (order: Order) => void }) {
  if (orders.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.disabled" sx={{ fontSize: 'var(--fs-secondary)' }}>
          Nothing to prepare
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {orders.map((order) => (
          <PrepCard key={order.id} order={order} onTap={onTap} />
        ))}
      </Box>
    </Box>
  )
}

function PrepCard({ order, onTap }: { order: Order; onTap: (order: Order) => void }) {
  const otherItems = order.items.filter((item) => item.menuItem.type === 'OTHER')
  const borderColor = urgencyBorderColor(order.createdAt)
  const isUrgent = borderColor !== 'divider'
  const status = order.otherStatus ?? 'PENDING'

  return (
    <Card variant="outlined" sx={{ borderColor, borderWidth: isUrgent ? 2 : 1 }}>
      <CardActionArea onClick={() => onTap(order)}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontWeight="bold" sx={{ fontSize: 'var(--fs-primary)' }}>
                #{order.number}
              </Typography>
              <Chip
                label={STATUS_LABEL[status] ?? status}
                color={STATUS_COLOR[status] ?? 'default'}
                size="small"
                sx={{ fontSize: 'var(--fs-small)' }}
              />
            </Box>
            <Typography color="text.secondary" sx={{ fontSize: 'var(--fs-secondary)' }}>
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          {otherItems.map((item) => (
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

// ─── Pickup display ───────────────────────────────────────────────────────────

function PickupDisplay({ parts, onPickup }: {
  parts: DonePart[]
  onPickup: (orderId: string, part: 'coffee' | 'other') => void
}) {
  if (parts.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.disabled" sx={{ fontSize: 'var(--fs-secondary)' }}>
          No orders ready
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {parts.map((badge) => (
          <PickupBadge
            key={`${badge.orderId}-${badge.part}`}
            badge={badge}
            onPickup={onPickup}
          />
        ))}
      </Box>
    </Box>
  )
}

function PickupBadge({ badge, onPickup }: {
  badge: DonePart
  onPickup: (orderId: string, part: 'coffee' | 'other') => void
}) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140 }}>
      <CardActionArea onClick={() => onPickup(badge.orderId, badge.part)} sx={{ p: 2 }}>
        <Typography fontWeight="bold" sx={{ fontSize: '2rem', lineHeight: 1.2 }}>
          {badge.number} {badge.part === 'coffee' ? 'C' : 'O'}
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {badge.items.map((item) => (
            <Typography key={item.id} color="text.secondary" sx={{ fontSize: 'var(--fs-small)' }}>
              {item.quantity}× {item.menuItem.name}
              {item.notes ? ` — ${item.notes}` : ''}
            </Typography>
          ))}
        </Box>
      </CardActionArea>
    </Card>
  )
}
