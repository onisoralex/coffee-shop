import { useState } from 'react'
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

// Renders the left/top panel of the ordering view: a tab bar of categories and a grid
// of item cards. Tapping a card calls addItem, which either increments the existing
// empty-notes line for that item or creates a new line (see orderStore for the grouping rule).
export default function MenuPanel() {
  const [selectedCat, setSelectedCat] = useState(0)
  const { snapshot } = useMenuStore()
  const { cart, addItem } = useOrderStore()

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
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, minHeight: 64 }}
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
}

// A single menu item card. The entire card surface is a tap target — no separate add button.
// quantity is the total across all cart lines for this item (may span multiple note variants).
// The blue border and ×N badge give at-a-glance feedback without cluttering the card face.
function MenuItemCard({ item, quantity, onAdd }: MenuItemCardProps) {
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
          {item.description && (
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: 'var(--fs-secondary)', mt: 0.5 }}>
              {item.description}
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
