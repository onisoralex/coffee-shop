import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { MenuItem } from '@coffee/shared'
import { useMenuStore } from '../../stores/menuStore.js'
import { useOrderStore } from '../../stores/orderStore.js'
import { useMenuDisplayStore } from '../../stores/menuDisplayStore.js'

// Returns the localized value for a text field on a menu item.
// EN text lives in the base field (item.description / item.composition).
// For other languages, looks up the matching translation row and falls back to the base field
// if no translation exists yet — so the menu is never empty mid-translation.
function getLocalized(item: MenuItem, lang: string, field: 'description' | 'composition'): string | null {
  if (lang === 'en') return item[field]
  const tr = item.translations.find((t) => t.language === lang)
  return tr?.[field] ?? item[field]
}

// Renders the left/top panel of the ordering view: a tab bar of categories and a grid
// of item cards. Tapping a card calls addItem, which either increments the existing
// empty-notes line for that item or creates a new line (see orderStore for the grouping rule).
export default function MenuPanel() {
  const [selectedCat, setSelectedCat] = useState(0)
  const { snapshot } = useMenuStore()
  const { cart, addItem } = useOrderStore()
  const showDescription = useMenuDisplayStore((s) => s.showDescription)
  const showComposition = useMenuDisplayStore((s) => s.showComposition)
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'

  if (!snapshot) return null

  // Sum quantities across all cart lines for each item — the same item can appear on
  // multiple lines with different notes, and the badge should reflect the total.
  const cartMap = new Map<string, number>()
  for (const line of cart) {
    cartMap.set(line.menuItem.id, (cartMap.get(line.menuItem.id) ?? 0) + line.quantity)
  }
  const category = snapshot.categories[selectedCat]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        value={selectedCat}
        onChange={(_, v: number) => setSelectedCat(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, minHeight: 64, bgcolor: 'background.paper', position: 'relative', zIndex: 1 }}
      >
        {snapshot.categories.map((cat, i) => (
          <Tab
            key={cat.id}
            label={cat.name}
            id={`cat-tab-${i}`}
            sx={{ minHeight: 80, fontSize: 'var(--fs-primary)', textTransform: 'none', fontWeight: 'bold', px: 3 }}
          />
        ))}
      </Tabs>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignContent: 'flex-start',
        }}
      >
        {category?.items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            quantity={cartMap.get(item.id) ?? 0}
            onAdd={() => addItem(item)}
            showDescription={showDescription}
            showComposition={showComposition}
            lang={lang}
          />
        ))}
        {/* Invisible spacers — same flex sizing as cards, height 0.
            Prevents last-row cards from stretching to fill remaining width. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={`spacer-${i}`} sx={{ flex: '1 1 150px', maxWidth: 220, height: 0 }} />
        ))}
      </Box>
    </Box>
  )
}

interface MenuItemCardProps {
  item: MenuItem
  quantity: number
  onAdd: () => void
  showDescription: boolean
  showComposition: boolean
  lang: string
}

// A single menu item card. The entire card surface is a tap target — no separate add button.
// quantity is the total across all cart lines for this item (may span multiple note variants).
// The blue border and ×N badge give at-a-glance feedback without cluttering the card face.
function MenuItemCard({ item, quantity, onAdd, showDescription, showComposition, lang }: MenuItemCardProps) {
  const description = getLocalized(item, lang, 'description')
  const composition = getLocalized(item, lang, 'composition')
  return (
    <Card
      variant="outlined"
      sx={{
        flex: '1 1 150px',
        maxWidth: 220,
        position: 'relative',
        ...(quantity > 0 && { borderColor: 'primary.main', borderWidth: 2 }),
      }}
    >
      {/* Full-card tap target — the whole card adds one more of this item */}
      {/* '&&' doubles CSS specificity to beat ButtonBase's built-in inline-flex/center defaults */}
      <CardActionArea onClick={onAdd} sx={{ height: '100%', '&&': { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' } }}>
        <CardContent sx={{ textAlign: 'center', width: '100%' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: 'var(--fs-primary)', lineHeight: 1.3 }}>
            {item.name}
          </Typography>
          {showDescription && description && (
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: 'var(--fs-secondary)', mt: 0.5 }}>
              {description}
            </Typography>
          )}
          {showComposition && composition && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: 'var(--fs-small)', mt: 0.5, fontStyle: 'italic', opacity: 0.8 }}
            >
              {composition}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {/* Quantity badge — shown when item is in cart, sits above the tap area */}
      {quantity > 0 && (
        <Chip
          label={`×${quantity}`}
          size="small"
          color="primary"
          sx={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none', fontSize: 'var(--fs-small)' }}
        />
      )}
    </Card>
  )
}
