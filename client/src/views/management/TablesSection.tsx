// Table management — list, add, delete, rotate QR token.
// The Bar table (id='bar') is shown read-only — it is a system constant and cannot be deleted.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import QrCodeIcon from '@mui/icons-material/QrCode'
import { apiFetch } from './apiHelper.js'
import QrDialog from './QrDialog.js'
import type { QrDialogTable } from './QrDialog.js'

interface TableRow {
  id: string
  number: number
  label: string | null
  qrToken: string
}

export default function TablesSection({ token }: { token: string }) {
  const { t } = useTranslation()
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrTable, setQrTable] = useState<QrDialogTable | null>(null)
  const [qrBaseUrl, setQrBaseUrl] = useState('')

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

  useEffect(() => {
    apiFetch(token, '/api/v1/management/settings/qr-base-url')
      .then((r) => r.json())
      .then((json: { data?: { qrBaseUrl: string } }) => {
        if (json.data !== undefined) setQrBaseUrl(json.data.qrBaseUrl)
      })
      .catch(() => {})
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
        alert(json.error ?? t('management.tables.addFailed'))
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
    const msg = table.label
      ? t('management.tables.deleteConfirmLabel', { number: table.number, label: table.label })
      : t('management.tables.deleteConfirm', { number: table.number })
    if (!confirm(msg)) return
    const res = await apiFetch(token, `/api/v1/management/tables/${table.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      alert(json.error ?? t('management.tables.deleteFailed'))
      return
    }
    void load()
  }

  const rotateQr = async (table: TableRow) => {
    if (!confirm(t('management.tables.rotateConfirm', { number: table.number }))) return
    await apiFetch(token, `/api/v1/management/tables/${table.id}/rotate-qr`, { method: 'POST' })
    void load()
  }

  if (loading && tables.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('management.tables.title')}</Typography>
        <Button variant="contained" size="small" onClick={() => setAddOpen(true)} startIcon={<AddIcon />}>{t('management.tables.addTable')}</Button>
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
                  {isBar ? t('common.bar') : t('common.table', { number: table.number })}
                  {table.label ? ` — ${table.label}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  QR: {table.qrToken}
                </Typography>
              </Box>
              {isBar ? (
                <Chip label={t('management.tables.system')} size="small" variant="outlined" />
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small" onClick={() => setQrTable(table)} title={t('management.tables.viewQr')}>
                    <QrCodeIcon />
                  </IconButton>
                  <Button size="small" variant="outlined" onClick={() => void rotateQr(table)}>
                    {t('management.tables.newQrCode')}
                  </Button>
                  <IconButton size="small" color="error" onClick={() => void deleteTable(table)}>
                    <DeleteForeverIcon />
                  </IconButton>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      <QrDialog open={qrTable !== null} onClose={() => setQrTable(null)} table={qrTable} baseUrl={qrBaseUrl} />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('management.tables.addTitle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label={t('management.tables.numberLabel')} type="number" value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            autoFocus fullWidth size="small"
          />
          <TextField
            label={t('management.tables.labelField')} value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('management.tables.labelPlaceholder')} fullWidth size="small"
            onKeyDown={(e) => { if (e.key === 'Enter') void addTable() }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => void addTable()}
            disabled={saving || !newNumber || parseInt(newNumber, 10) < 1}
          >
            {t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
