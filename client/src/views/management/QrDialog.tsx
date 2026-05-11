// QR code viewer and style editor for a single table.
// Renders client-side via qr-code-styling (DOM Canvas API), so server-side PNG generation
// is not needed — the download() method on the instance handles export directly.
import { useEffect, useRef, useState } from 'react'
import QRCodeStyling from 'qr-code-styling'
import type { DotType, CornerSquareType, CornerDotType } from 'qr-code-styling'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

export interface QrDialogTable {
  id: string
  number: number
  label: string | null
  qrToken: string
}

interface Props {
  open: boolean
  onClose: () => void
  table: QrDialogTable | null
  baseUrl: string
}

type ColorMode = 'solid' | 'linear' | 'radial'

const DOT_SHAPES: { value: DotType; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'dots', label: 'Dots' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
]

const CORNER_SQUARE_SHAPES: { value: CornerSquareType; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'extra-rounded', label: 'Rounded' },
  { value: 'dot', label: 'Dot' },
]

const CORNER_DOT_SHAPES: { value: CornerDotType; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Dot' },
]

const QR_SIZE = 280

export default function QrDialog({ open, onClose, table, baseUrl }: Props) {
  const { t } = useTranslation()

  // Callback ref instead of useRef — MUI Dialog renders via a Portal, so the
  // container div is not in the DOM at the moment the open-triggered effect fires.
  // Using useState means the effect re-runs the instant the div actually mounts.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  const [dotShape, setDotShape] = useState<DotType>('dots')
  const [colorMode, setColorMode] = useState<ColorMode>('solid')
  const [color1, setColor1] = useState('#000000')
  const [color2, setColor2] = useState('#3b82f6')
  const [angle, setAngle] = useState(0)
  const [cornerSquare, setCornerSquare] = useState<CornerSquareType>('square')
  const [cornerDot, setCornerDot] = useState<CornerDotType>('square')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(0.25)

  const origin = baseUrl.trim() || window.location.origin
  const url = table ? `${origin}/order?table=${table.qrToken}` : ''

  useEffect(() => {
    if (!open || !container || !url) return

    const dotsOptions =
      colorMode === 'solid'
        ? { type: dotShape, color: color1 }
        : {
            type: dotShape,
            gradient: {
              type: colorMode as 'linear' | 'radial',
              // rotation only applies to linear; radial ignores it
              rotation: colorMode === 'linear' ? (angle * Math.PI) / 180 : 0,
              colorStops: [
                { offset: 0, color: color1 },
                { offset: 1, color: color2 },
              ],
            },
          }

    const options = {
      width: QR_SIZE,
      height: QR_SIZE,
      data: url,
      // Bump error correction to Q when a logo is present — the logo occludes
      // the center and Q (25% recovery) keeps the code scannable.
      qrOptions: { errorCorrectionLevel: (logoDataUrl ? 'Q' : 'M') as 'Q' | 'M' },
      dotsOptions,
      cornersSquareOptions: { type: cornerSquare },
      cornersDotOptions: { type: cornerDot },
      backgroundOptions: { color: bgColor },
      ...(logoDataUrl
        ? { image: logoDataUrl, imageOptions: { margin: 4, imageSize: logoSize } }
        : {}),
    }

    container.innerHTML = ''
    const qr = new QRCodeStyling(options)
    qr.append(container)
    qrRef.current = qr
  }, [open, container, url, dotShape, colorMode, color1, color2, angle, cornerSquare, cornerDot, bgColor, logoDataUrl, logoSize])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDownload = () => {
    if (!qrRef.current || !table) return
    const name = table.label ? `table-${table.number}-${table.label}` : `table-${table.number}`
    void qrRef.current.download({ name, extension: 'png' })
  }

  const tableName = table
    ? table.label
      ? t('common.tableWithLabel', { number: table.number, label: table.label })
      : t('common.table', { number: table.number })
    : ''

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('management.tables.qrDialog.title')} — {tableName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

          {/* Live preview */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box ref={setContainer} />
          </Box>

          <Divider />

          {/* Dot shape */}
          <FormControl size="small" fullWidth>
            <InputLabel>{t('management.tables.qrDialog.dotShape')}</InputLabel>
            <Select
              value={dotShape}
              label={t('management.tables.qrDialog.dotShape')}
              onChange={(e) => setDotShape(e.target.value as DotType)}
            >
              {DOT_SHAPES.map((s) => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Color mode */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {t('management.tables.qrDialog.colorMode')}
            </Typography>
            <ToggleButtonGroup
              value={colorMode}
              exclusive
              onChange={(_, v: ColorMode | null) => { if (v) setColorMode(v) }}
              size="small"
              fullWidth
            >
              <ToggleButton value="solid">{t('management.tables.qrDialog.solid')}</ToggleButton>
              <ToggleButton value="linear">{t('management.tables.qrDialog.linear')}</ToggleButton>
              <ToggleButton value="radial">{t('management.tables.qrDialog.radial')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Color pickers */}
          <Stack direction="row" spacing={3} alignItems="flex-end">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {colorMode === 'radial'
                  ? t('management.tables.qrDialog.colorCenter')
                  : colorMode === 'linear'
                  ? t('management.tables.qrDialog.colorA')
                  : t('management.tables.qrDialog.color')}
              </Typography>
              <input
                type="color"
                value={color1}
                onChange={(e) => setColor1(e.target.value)}
                style={{ width: 52, height: 36, cursor: 'pointer', border: 'none', padding: 0, background: 'none' }}
              />
            </Box>
            {colorMode !== 'solid' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {colorMode === 'radial'
                    ? t('management.tables.qrDialog.colorOuter')
                    : t('management.tables.qrDialog.colorB')}
                </Typography>
                <input
                  type="color"
                  value={color2}
                  onChange={(e) => setColor2(e.target.value)}
                  style={{ width: 52, height: 36, cursor: 'pointer', border: 'none', padding: 0, background: 'none' }}
                />
              </Box>
            )}
          </Stack>

          {/* Angle slider — linear only */}
          {colorMode === 'linear' && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('management.tables.qrDialog.angle')}: {angle}°
              </Typography>
              <Slider
                value={angle}
                onChange={(_, v) => setAngle(v as number)}
                min={0}
                max={360}
                step={1}
                size="small"
              />
            </Box>
          )}

          <Divider />

          {/* Corner shapes */}
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('management.tables.qrDialog.cornerSquare')}</InputLabel>
              <Select
                value={cornerSquare}
                label={t('management.tables.qrDialog.cornerSquare')}
                onChange={(e) => setCornerSquare(e.target.value as CornerSquareType)}
              >
                {CORNER_SQUARE_SHAPES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('management.tables.qrDialog.cornerDot')}</InputLabel>
              <Select
                value={cornerDot}
                label={t('management.tables.qrDialog.cornerDot')}
                onChange={(e) => setCornerDot(e.target.value as CornerDotType)}
              >
                {CORNER_DOT_SHAPES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Background color */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {t('management.tables.qrDialog.background')}
            </Typography>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              style={{ width: 52, height: 36, cursor: 'pointer', border: 'none', padding: 0, background: 'none' }}
            />
          </Stack>

          <Divider />

          {/* Logo */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {t('management.tables.qrDialog.logo')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('management.tables.qrDialog.uploadLogo')}
              </Button>
              {logoDataUrl && (
                <Button size="small" color="error" onClick={() => setLogoDataUrl(null)}>
                  {t('management.tables.qrDialog.removeLogo')}
                </Button>
              )}
            </Stack>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleLogoUpload}
            />
            {logoDataUrl && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('management.tables.qrDialog.logoSize')}: {Math.round(logoSize * 100)}%
                </Typography>
                <Slider
                  value={logoSize}
                  onChange={(_, v) => setLogoSize(v as number)}
                  min={0.1}
                  max={0.5}
                  step={0.01}
                  size="small"
                />
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleDownload}>
          {t('management.tables.qrDialog.download')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
