// Customer-facing pickup display — the big screen people watch while waiting for their order.
//
// Shows one badge per DONE part: "42 C" (coffee ready) or "42 O" (other ready).
// Parts are dismissed independently by the counter person from /counter; nothing here
// is interactive. Sorted by order number ascending so customers can scan quickly.
//
// New badges animate in (fade + scale) to draw the eye. Badges for picked-up or cancelled
// parts disappear immediately via order:updated / order:removed socket events.
//
// Joins only the display socket room. The display room receives order:updated when any part
// becomes DONE or transitions out of DONE, and order:removed when no DONE parts remain.
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import type { Order } from '@coffee/shared'
import { getSocket } from '../hooks/useSocket.js'

const fadeScaleIn = keyframes`
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1); }
`

interface DonePart {
  orderId: string
  number: number
  part: 'coffee' | 'other'
}

function extractDoneParts(order: Order): DonePart[] {
  return [
    ...(order.coffeeStatus === 'DONE' ? [{ orderId: order.id, number: order.number, part: 'coffee' as const }] : []),
    ...(order.otherStatus === 'DONE' ? [{ orderId: order.id, number: order.number, part: 'other' as const }] : []),
  ]
}

export default function PickupView() {
  const [orders, setOrders] = useState<Order[]>([])

  // Hydrate from REST on mount — covers any DONE parts that existed before the page opened.
  useEffect(() => {
    fetch('/api/v1/orders/display')
      .then((r) => r.json())
      .then((json: { data?: Order[] }) => { if (json.data) setOrders(json.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const socket = getSocket()
    socket.emit('view:join', { room: 'display' })

    const handleUpdated = (order: Order) => {
      const hasDone = order.coffeeStatus === 'DONE' || order.otherStatus === 'DONE'
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id)
        if (!hasDone) return exists ? prev.filter((o) => o.id !== order.id) : prev
        return exists ? prev.map((o) => (o.id === order.id ? order : o)) : [...prev, order]
      })
    }

    const handleRemoved = ({ orderId }: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
    }

    socket.on('order:updated', handleUpdated)
    socket.on('order:removed', handleRemoved)
    return () => {
      socket.off('order:updated', handleUpdated)
      socket.off('order:removed', handleRemoved)
    }
  }, [])

  const doneParts = orders
    .flatMap(extractDoneParts)
    .sort((a, b) => a.number - b.number)

  return (
    <Box
      sx={{
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        alignItems: doneParts.length === 0 ? 'center' : 'flex-start',
        justifyContent: doneParts.length === 0 ? 'center' : 'flex-start',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: 3,
        p: 4,
      }}
    >
      {doneParts.length === 0 ? (
        <Typography color="text.disabled" sx={{ fontSize: '1.25rem' }}>
          No orders ready yet
        </Typography>
      ) : (
        doneParts.map((badge) => (
          <Box
            key={`${badge.orderId}-${badge.part}`}
            sx={{
              border: 2,
              borderColor: 'divider',
              borderRadius: 2,
              px: 4,
              py: 3,
              minWidth: 180,
              textAlign: 'center',
              animation: `${fadeScaleIn} 0.35s ease-out`,
            }}
          >
            <Typography fontWeight="bold" sx={{ fontSize: '5rem', lineHeight: 1 }}>
              {badge.number} {badge.part === 'coffee' ? 'C' : 'O'}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  )
}
