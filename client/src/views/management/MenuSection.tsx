// Menu management — categories and items.
//
// Displays all categories as an accordion. Each category shows all its items (including
// unavailable ones). The availability toggle is a single-tap action; all other mutations
// go through add/edit dialogs. Deletions require confirmation.
//
// After any mutation the section re-fetches from the server. The server also broadcasts
// menu:updated to all management room subscribers, but the local re-fetch is the source
// of truth for this view — it avoids depending on the socket state being set up.
import { useCallback, useEffect, useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { apiFetch } from './apiHelper.js'

interface Category {
  id: string
  name: string
  sortOrder: number
  items: Item[]
}

interface Item {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  available: boolean
  sortOrder: number
  type: 'COFFEE' | 'OTHER'
  ee: number
  me: number
  categoryId: string
}

const EMPTY_ITEM: Omit<Item, 'id' | 'categoryId'> = {
  name: '', description: '', imageUrl: '', available: true,
  sortOrder: 0, type: 'COFFEE', ee: 0, me: 0,
}

export default function MenuSection({ token }: { token: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // ── Category dialog ──
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null })
  const [catName, setCatName] = useState('')
  const [catSort, setCatSort] = useState('0')

  // ── Item dialog ──
  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: Item | null; categoryId: string }>({
    open: false, editing: null, categoryId: '',
  })
  const [itemForm, setItemForm] = useState<typeof EMPTY_ITEM & { categoryId: string }>({ ...EMPTY_ITEM, categoryId: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(token, '/api/v1/management/categories')
      const json = await res.json() as { data?: Category[] }
      if (json.data) setCategories(json.data)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  // ── Category actions ──

  const openAddCategory = () => {
    setCatName('')
    setCatSort(String(categories.length))
    setCatDialog({ open: true, editing: null })
  }

  const openEditCategory = (cat: Category) => {
    setCatName(cat.name)
    setCatSort(String(cat.sortOrder))
    setCatDialog({ open: true, editing: cat })
  }

  const saveCategory = async () => {
    const body = { name: catName.trim(), sortOrder: parseInt(catSort, 10) || 0 }
    if (!body.name) return
    if (catDialog.editing) {
      await apiFetch(token, `/api/v1/management/categories/${catDialog.editing.id}`, {
        method: 'PUT', body: JSON.stringify(body),
      })
    } else {
      await apiFetch(token, '/api/v1/management/categories', {
        method: 'POST', body: JSON.stringify(body),
      })
    }
    setCatDialog({ open: false, editing: null })
    void load()
  }

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? This is permanent.`)) return
    const res = await apiFetch(token, `/api/v1/management/categories/${cat.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      alert(json.error ?? 'Delete failed')
      return
    }
    void load()
  }

  // ── Item actions ──

  const openAddItem = (categoryId: string) => {
    setItemForm({ ...EMPTY_ITEM, categoryId, sortOrder: categories.find(c => c.id === categoryId)?.items.length ?? 0 })
    setItemDialog({ open: true, editing: null, categoryId })
  }

  const openEditItem = (item: Item) => {
    setItemForm({ ...item })
    setItemDialog({ open: true, editing: item, categoryId: item.categoryId })
  }

  const saveItem = async () => {
    if (!itemForm.name.trim()) return
    const body = {
      ...itemForm,
      name: itemForm.name.trim(),
      description: itemForm.description || null,
      imageUrl: itemForm.imageUrl || null,
    }
    if (itemDialog.editing) {
      await apiFetch(token, `/api/v1/management/items/${itemDialog.editing.id}`, {
        method: 'PUT', body: JSON.stringify(body),
      })
    } else {
      await apiFetch(token, '/api/v1/management/items', {
        method: 'POST', body: JSON.stringify(body),
      })
    }
    setItemDialog({ open: false, editing: null, categoryId: '' })
    void load()
  }

  const toggleAvailability = async (item: Item) => {
    await apiFetch(token, `/api/v1/management/items/${item.id}/availability`, {
      method: 'PATCH', body: JSON.stringify({ available: !item.available }),
    })
    void load()
  }

  const deleteItem = async (item: Item) => {
    if (!confirm(`Delete "${item.name}"? This is permanent.`)) return
    await apiFetch(token, `/api/v1/management/items/${item.id}`, { method: 'DELETE' })
    void load()
  }

  if (loading && categories.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Menu</Typography>
        <Button variant="contained" size="small" onClick={openAddCategory}>+ Category</Button>
      </Box>

      {categories.map((cat) => (
        <Accordion key={cat.id} disableGutters>
          <AccordionSummary>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Typography fontWeight="bold">{cat.name}</Typography>
              <Typography variant="caption" color="text.secondary">({cat.items.length} items)</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mr: 1 }} onClick={(e) => e.stopPropagation()}>
              <Button size="small" onClick={() => openEditCategory(cat)}>Edit</Button>
              <Button size="small" color="error" onClick={() => void deleteCategory(cat)}>Delete</Button>
            </Box>
          </AccordionSummary>

          <AccordionDetails sx={{ p: 0 }}>
            {cat.items.map((item, i) => (
              <Box key={item.id}>
                {i > 0 && <Divider />}
                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 1 }}>
                  <Switch
                    size="small"
                    checked={item.available}
                    onChange={() => void toggleAvailability(item)}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ opacity: item.available ? 1 : 0.5 }}>
                      {item.name}
                    </Typography>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                    )}
                  </Box>
                  <Chip
                    label={item.type === 'COFFEE' ? 'Coffee' : 'Other'}
                    size="small"
                    color={item.type === 'COFFEE' ? 'warning' : 'default'}
                    variant="outlined"
                  />
                  <IconButton size="small" onClick={() => openEditItem(item)}>✏️</IconButton>
                  <IconButton size="small" onClick={() => void deleteItem(item)}>🗑</IconButton>
                </Box>
              </Box>
            ))}
            <Box sx={{ p: 1.5 }}>
              <Button size="small" onClick={() => openAddItem(cat.id)}>+ Item</Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {categories.length === 0 && !loading && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          No categories yet — add one to get started.
        </Typography>
      )}

      {/* Category dialog */}
      <Dialog open={catDialog.open} onClose={() => setCatDialog({ open: false, editing: null })} fullWidth maxWidth="xs">
        <DialogTitle>{catDialog.editing ? 'Edit category' : 'Add category'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Name" value={catName} onChange={(e) => setCatName(e.target.value)}
            autoFocus fullWidth size="small"
            onKeyDown={(e) => { if (e.key === 'Enter') void saveCategory() }}
          />
          <TextField
            label="Sort order" type="number" value={catSort}
            onChange={(e) => setCatSort(e.target.value)} size="small" sx={{ width: 120 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog({ open: false, editing: null })}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveCategory()} disabled={!catName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemDialog.open} onClose={() => setItemDialog({ open: false, editing: null, categoryId: '' })} fullWidth maxWidth="sm">
        <DialogTitle>{itemDialog.editing ? 'Edit item' : 'Add item'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name" value={itemForm.name} onChange={(e) => setItemForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" autoFocus />
          <TextField label="Description" value={itemForm.description ?? ''} onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))} fullWidth size="small" multiline rows={2} />
          <TextField label="Image URL" value={itemForm.imageUrl ?? ''} onChange={(e) => setItemForm(f => ({ ...f, imageUrl: e.target.value }))} fullWidth size="small" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select value={itemForm.type} label="Type" onChange={(e) => setItemForm(f => ({ ...f, type: e.target.value as 'COFFEE' | 'OTHER' }))}>
                <MenuItem value="COFFEE">Coffee</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Category</InputLabel>
              <Select value={itemForm.categoryId} label="Category" onChange={(e) => setItemForm(f => ({ ...f, categoryId: e.target.value }))}>
                {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Sort order" type="number" value={itemForm.sortOrder} onChange={(e) => setItemForm(f => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} size="small" sx={{ width: 100 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Espresso portions (ee)" type="number" value={itemForm.ee} onChange={(e) => setItemForm(f => ({ ...f, ee: parseFloat(e.target.value) || 0 }))} size="small" sx={{ flex: 1 }} />
            <TextField label="Milk ml (me)" type="number" value={itemForm.me} onChange={(e) => setItemForm(f => ({ ...f, me: parseFloat(e.target.value) || 0 }))} size="small" sx={{ flex: 1 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog({ open: false, editing: null, categoryId: '' })}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveItem()} disabled={!itemForm.name.trim() || !itemForm.categoryId}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
