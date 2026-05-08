// Order history — filterable by date range and table.
// Defaults to today. Each row is expandable to show item detail.
import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { apiFetch } from './apiHelper.js'

interface OrderItem {
  id: string
  quantity: number
  notes: string | null
  menuItem: { id: string; name: string; type: string }
}

interface OrderRow {
  id: string
  number: number
  coffeeStatus: string | null
  otherStatus: string | null
  createdAt: string
  table: { id: string; number: number; label: string | null }
  items: OrderItem[]
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING: 'default',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  PICKED_UP: 'default',
  CANCELLED: 'error',
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function OrdersSection({ token }: { token: string }) {
  const today = todayString()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await apiFetch(token, `/api/v1/management/orders?${params}`)
      const json = await res.json() as { data?: OrderRow[] }
      if (json.data) setOrders(json.data)
    } finally {
      setLoading(false)
    }
  }, [token, from, to])

  useEffect(() => { void load() }, [load])

  const tableLabel = (order: OrderRow) => {
    const t = order.table
    if (t.id === 'bar') return 'Bar'
    return `Table ${t.number}${t.label ? ` — ${t.label}` : ''}`
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ mr: 1 }}>Orders</Typography>
        <TextField
          label="From" type="date" size="small" value={from}
          onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
        />
        <TextField
          label="To" type="date" size="small" value={to}
          onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
        />
        {loading && <CircularProgress size={20} />}
      </Box>

      {orders.length === 0 && !loading ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          No orders found for this date range.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {orders.map((order) => (
            <Box
              key={order.id}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
            >
              {/* Row — click to expand */}
              <Box
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Typography fontWeight="bold" sx={{ minWidth: 40 }}>#{order.number}</Typography>
                <Typography variant="body2" sx={{ flex: 1 }}>{tableLabel(order)}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {order.coffeeStatus && (
                    <Chip label={`☕ ${order.coffeeStatus}`} size="small" color={STATUS_COLOR[order.coffeeStatus] ?? 'default'} />
                  )}
                  {order.otherStatus && (
                    <Chip label={`🛍 ${order.otherStatus}`} size="small" color={STATUS_COLOR[order.otherStatus] ?? 'default'} />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>

              {/* Expanded detail */}
              <Collapse in={expanded === order.id}>
                <Box sx={{ px: 2, pb: 1.5, borderTop: 1, borderColor: 'divider', pt: 1 }}>
                  {order.items.map((item) => (
                    <Typography key={item.id} variant="body2" color="text.secondary">
                      {item.quantity}× {item.menuItem.name}
                      {item.notes ? ` — ${item.notes}` : ''}
                    </Typography>
                  ))}
                </Box>
              </Collapse>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
