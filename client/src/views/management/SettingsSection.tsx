import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

export default function SettingsSection({ token }: { token: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < 8
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !loading

  const submit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/v1/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const json = await res.json() as { data?: { ok: boolean }; error?: string }
      if (!res.ok || !json.data) {
        setError(json.error ?? 'Failed to change password')
        return
      }
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Settings</Typography>
      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Change password</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
        <TextField
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); setError(''); setSuccess(false) }}
          autoComplete="current-password"
          fullWidth
        />
        <TextField
          label="New password"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(''); setSuccess(false) }}
          error={tooShort}
          helperText={tooShort ? 'At least 8 characters' : ''}
          autoComplete="new-password"
          fullWidth
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(''); setSuccess(false) }}
          error={mismatch}
          helperText={mismatch ? 'Passwords do not match' : ''}
          autoComplete="new-password"
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Password changed successfully</Alert>}

        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={!canSubmit}
          sx={{ alignSelf: 'flex-start' }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Change password'}
        </Button>
      </Box>
    </Box>
  )
}
