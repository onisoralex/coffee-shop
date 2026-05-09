// Order history — filterable by date range and table.
// Defaults to today. Each row is expandable to show item detail.
// Summary cards above the list show totals for non-cancelled orders only.
import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CoffeeIcon from '@mui/icons-material/Coffee'
import FastfoodIcon from '@mui/icons-material/Fastfood'
import RefreshIcon from '@mui/icons-material/Refresh'
import { apiFetch } from './apiHelper.js'

interface OrderItem {
  id: string
  quantity: number
  notes: string | null
  menuItem: { id: string; name: string; type: string; ee: number; me: number }
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

interface ItemSummary {
  id: string
  name: string
  quantity: number
  totalEe: number
  totalMe: number
}

interface Summary {
  orderCount: number
  totalEe: number
  totalMeL: number
  items: ItemSummary[]
}

// Excluded from all totals: orders where every present part is CANCELLED.
function isCancelled(order: OrderRow): boolean {
  return (
    (order.coffeeStatus === null || order.coffeeStatus === 'CANCELLED') &&
    (order.otherStatus === null || order.otherStatus === 'CANCELLED')
  )
}

function computeSummary(orders: OrderRow[]): Summary {
  const active = orders.filter((o) => !isCancelled(o))
  const itemMap = new Map<string, ItemSummary>()
  let totalEe = 0
  let totalMe = 0

  for (const order of active) {
    for (const item of order.items) {
      const qty = item.quantity
      const ee = item.menuItem.ee * qty
      const me = item.menuItem.me * qty
      const existing = itemMap.get(item.menuItem.id)
      if (existing) {
        existing.quantity += qty
        existing.totalEe += ee
        existing.totalMe += me
      } else {
        itemMap.set(item.menuItem.id, {
          id: item.menuItem.id,
          name: item.menuItem.name,
          quantity: qty,
          totalEe: ee,
          totalMe: me,
        })
      }
      totalEe += ee
      totalMe += me
    }
  }

  return {
    orderCount: active.length,
    totalEe,
    totalMeL: totalMe / 1000,
    items: [...itemMap.values()].sort((a, b) => b.quantity - a.quantity),
  }
}

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  PENDING: 'primary',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  PICKED_UP: 'default',
  CANCELLED: 'error',
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Paper variant="outlined" sx={{ px: 2.5, py: 2, minWidth: 140, flex: '1 1 140px' }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="h5" fontWeight="bold" component="span">{value}</Typography>
      {unit && (
        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 0.5 }}>{unit}</Typography>
      )}
    </Paper>
  )
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <StatCard label="Orders" value={String(summary.orderCount)} unit="" />
        <StatCard label="Coffee equivalent" value={summary.totalEe.toFixed(1)} unit="portions" />
        <StatCard label="Milk" value={summary.totalMeL.toFixed(2)} unit="L" />
      </Box>

      <Paper variant="outlined" sx={{ px: 2.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          Per item
        </Typography>
        {summary.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No items</Typography>
        ) : (
          <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', gap: 2, pb: 0.5, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Item</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 48, textAlign: 'right' }}>Qty</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>Coffee eq.</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 64, textAlign: 'right' }}>Milk</Typography>
            </Box>
            <Divider sx={{ mb: 0.5 }} />
            {summary.items.map((item) => (
              <Box key={item.id} sx={{ display: 'flex', gap: 2, py: 0.25 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{item.name}</Typography>
                <Typography variant="body2" sx={{ width: 48, textAlign: 'right' }}>×{item.quantity}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>
                  {item.totalEe > 0 ? `${item.totalEe.toFixed(1)} por` : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 64, textAlign: 'right' }}>
                  {item.totalMe > 0 ? `${(item.totalMe / 1000).toFixed(2)} L` : '—'}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

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

  const summary = computeSummary(orders)

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
        <Tooltip title="Refresh">
          <span>
            <IconButton size="small" onClick={() => void load()} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
        {loading && <CircularProgress size={20} />}
      </Box>

      {orders.length === 0 && !loading ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          No orders found for this date range.
        </Typography>
      ) : (
        <>
          {!loading && <SummaryCards summary={summary} />}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {orders.map((order) => (
              <Box
                key={order.id}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
              >
                <Box
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Typography fontWeight="bold" sx={{ minWidth: 40 }}>#{order.number}</Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>{tableLabel(order)}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {order.coffeeStatus && (
                      <Chip icon={<CoffeeIcon />} label={order.coffeeStatus} size="small" color={STATUS_COLOR[order.coffeeStatus] ?? 'default'} />
                    )}
                    {order.otherStatus && (
                      <Chip icon={<FastfoodIcon />} label={order.otherStatus} size="small" color={STATUS_COLOR[order.otherStatus] ?? 'default'} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>

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
        </>
      )}
    </Box>
  )
}
