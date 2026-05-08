// Table management — list, add, delete, rotate QR token.
// The Bar table (id='bar') is shown read-only — it is a system constant and cannot be deleted.
import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { apiFetch } from './apiHelper.js'

interface TableRow {
  id: string
  number: number
  label: string | null
  qrToken: string
}

export default function TablesSection({ token }: { token: string }) {
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(token, '/api/v1/management/tables')
      const json = await res.json() as { data?: TableRow[] }
      if (json.data) setTables(json.data)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const addTable = async () => {
    const num = parseInt(newNumber, 10)
    if (!num || num < 1) return
    setSaving(true)
    try {
      const res = await apiFetch(token, '/api/v1/management/tables', {
        method: 'POST',
        body: JSON.stringify({ number: num, label: newLabel.trim() || null }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        alert(json.error ?? 'Failed to add table')
        return
      }
      setAddOpen(false)
      setNewNumber('')
      setNewLabel('')
      void load()
    } finally {
      setSaving(false)
    }
  }

  const deleteTable = async (table: TableRow) => {
    if (!confirm(`Delete Table ${table.number}${table.label ? ` — ${table.label}` : ''}?`)) return
    const res = await apiFetch(token, `/api/v1/management/tables/${table.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      alert(json.error ?? 'Delete failed')
      return
    }
    void load()
  }

  const rotateQr = async (table: TableRow) => {
    if (!confirm(`Rotate QR token for Table ${table.number}? The old QR code will stop working.`)) return
    await apiFetch(token, `/api/v1/management/tables/${table.id}/rotate-qr`, { method: 'POST' })
    void load()
  }

  if (loading && tables.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tables</Typography>
        <Button variant="contained" size="small" onClick={() => setAddOpen(true)}>+ Table</Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tables.map((table) => {
          const isBar = table.id === 'bar'
          return (
            <Box
              key={table.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="bold">
                  {isBar ? 'Bar' : `Table ${table.number}`}
                  {table.label ? ` — ${table.label}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  QR: {table.qrToken}
                </Typography>
              </Box>
              {isBar ? (
                <Chip label="System" size="small" variant="outlined" />
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => void rotateQr(table)}>
                    Rotate QR
                  </Button>
                  <Button size="small" color="error" onClick={() => void deleteTable(table)}>
                    Delete
                  </Button>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add table</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Table number" type="number" value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            autoFocus fullWidth size="small"
          />
          <TextField
            label="Label (optional)" value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Window 3" fullWidth size="small"
            onKeyDown={(e) => { if (e.key === 'Enter') void addTable() }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void addTable()}
            disabled={saving || !newNumber || parseInt(newNumber, 10) < 1}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
