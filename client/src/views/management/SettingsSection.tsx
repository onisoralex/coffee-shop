import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ro', label: 'Română' },
]

export default function SettingsSection({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [language, setLanguage] = useState(i18n.language.slice(0, 2))
  const [langSaving, setLangSaving] = useState(false)
  const [langError, setLangError] = useState('')
  const [qrBaseUrl, setQrBaseUrl] = useState('')
  const [qrUrlSaving, setQrUrlSaving] = useState(false)
  const [qrUrlError, setQrUrlError] = useState('')
  const [qrUrlSuccess, setQrUrlSuccess] = useState(false)

  // Fetch the current DB language on mount so the picker reflects the stored value,
  // not just the browser's cached preference.
  useEffect(() => {
    fetch('/api/v1/auth/language')
      .then((r) => r.json())
      .then((json: { data?: { language: string } }) => {
        if (json.data?.language) setLanguage(json.data.language)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/v1/management/settings/qr-base-url', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json: { data?: { qrBaseUrl: string } }) => {
        if (json.data !== undefined) setQrBaseUrl(json.data.qrBaseUrl)
      })
      .catch(() => {})
  }, [token])

  const saveQrBaseUrl = async () => {
    const trimmed = qrBaseUrl.trim()
    if (trimmed !== '' && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setQrUrlError(t('management.settings.qrBaseUrlInvalid'))
      return
    }
    setQrUrlSaving(true)
    setQrUrlError('')
    setQrUrlSuccess(false)
    try {
      const res = await fetch('/api/v1/management/settings/qr-base-url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrBaseUrl: qrBaseUrl.trim() }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setQrUrlError(json.error ?? t('common.serverError'))
        return
      }
      setQrUrlSuccess(true)
    } catch {
      setQrUrlError(t('common.serverError'))
    } finally {
      setQrUrlSaving(false)
    }
  }

  const saveLanguage = async (lang: string) => {
    setLangSaving(true)
    setLangError('')
    try {
      const res = await fetch('/api/v1/management/settings/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: lang }),
      })
      if (!res.ok) {
        setLangError(t('common.serverError'))
        return
      }
      setLanguage(lang)
      void i18n.changeLanguage(lang)
    } catch {
      setLangError(t('common.serverError'))
    } finally {
      setLangSaving(false)
    }
  }

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
        setError(json.error ?? t('management.settings.failedMessage'))
        return
      }
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch {
      setError(t('common.serverError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>{t('management.settings.title')}</Typography>
      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{t('management.settings.changePassword')}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
        <TextField
          label={t('management.settings.currentPassword')}
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); setError(''); setSuccess(false) }}
          autoComplete="current-password"
          fullWidth
        />
        <TextField
          label={t('management.settings.newPassword')}
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(''); setSuccess(false) }}
          error={tooShort}
          helperText={tooShort ? t('management.settings.minLength') : ''}
          autoComplete="new-password"
          fullWidth
        />
        <TextField
          label={t('management.settings.confirmPassword')}
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(''); setSuccess(false) }}
          error={mismatch}
          helperText={mismatch ? t('management.settings.passwordMismatch') : ''}
          autoComplete="new-password"
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{t('management.settings.successMessage')}</Alert>}

        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={!canSubmit}
          sx={{ alignSelf: 'flex-start' }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : t('management.settings.submitButton')}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t('management.settings.language')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, maxWidth: 400 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('management.settings.language')}</InputLabel>
          <Select
            value={language}
            label={t('management.settings.language')}
            onChange={(e) => void saveLanguage(e.target.value)}
            disabled={langSaving}
          >
            {LANGUAGES.map((l) => (
              <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {langSaving && <CircularProgress size={20} />}
        {langError && <Alert severity="error" sx={{ py: 0 }}>{langError}</Alert>}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t('management.settings.qrBaseUrl')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('management.settings.qrBaseUrlHint')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, maxWidth: 400 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="http://192.168.1.100:3001"
          value={qrBaseUrl}
          onChange={(e) => { setQrBaseUrl(e.target.value); setQrUrlSuccess(false); setQrUrlError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') void saveQrBaseUrl() }}
          error={!!qrUrlError}
          helperText={qrUrlError || ''}
        />
        <Button
          variant="contained"
          size="small"
          onClick={() => void saveQrBaseUrl()}
          disabled={qrUrlSaving}
          sx={{ whiteSpace: 'nowrap', mt: 0.125 }}
        >
          {qrUrlSaving ? <CircularProgress size={18} color="inherit" /> : t('common.save')}
        </Button>
      </Box>
      {qrUrlSuccess && <Alert severity="success" sx={{ mt: 1.5, maxWidth: 400 }}>{t('management.settings.qrBaseUrlSaved')}</Alert>}
    </Box>
  )
}
