// Manages all state for the ordering flow: building a cart and submitting it.
// tableId always has a value — it defaults to BAR_TABLE_ID on mount and staff can change it.
// QR mode overrides tableId via setTableId() after resolving the token.
import { create } from 'zustand'
import type { MenuItem } from '@coffee/shared'
import { BAR_TABLE_ID } from '@coffee/shared'

// crypto.randomUUID() requires a secure context (HTTPS or localhost).
// On plain HTTP over a local network IP the API is absent, so we fall back to
// a Math.random()-based v4 UUID. lineId is client-only and never stored in the DB,
// so cryptographic quality is not needed here.
function newLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// Each cart entry is a separate line, not just a quantity on a menu item.
// This is intentional: the same item can appear multiple times with different notes
// (e.g. two flat whites — one cold milk, one oat milk). lineId is a client-only UUID
// used as the stable React key and store operation target. It is never sent to the server.
export interface CartLine {
  lineId: string
  menuItem: MenuItem
  quantity: number
  notes: string
}

interface OrderState {
  cart: CartLine[]
  tableId: string
  // Stored as a string because it comes from a text input. Empty string = let server assign
  // from the daily counter. '1'–'999' = staff override (used when switching paper blocks
  // mid-shift — overriding also resets the counter so auto-increment resumes from there).
  orderNumber: string
  submitting: boolean
  submitError: string | null

  addItem: (item: MenuItem) => void
  removeItem: (lineId: string) => void
  setQuantity: (lineId: string, qty: number) => void
  setItemNotes: (lineId: string, notes: string) => void
  setTableId: (id: string) => void
  setOrderNumber: (n: string) => void
  submit: () => Promise<void>
  resetCart: () => void
}

export const useOrderStore = create<OrderState>((set, get) => ({
  cart: [],
  tableId: BAR_TABLE_ID,
  orderNumber: '',
  submitting: false,
  submitError: null,

  addItem: (item) =>
    set((state) => {
      // Find the accumulator line — the one line for this item with no notes.
      // Lines with notes are locked: a menu card press never modifies them.
      // Only one empty-notes line can exist per item at a time.
      const accLine = state.cart.find((l) => l.menuItem.id === item.id && l.notes === '')
      if (accLine) {
        return {
          cart: state.cart.map((l) =>
            l.lineId === accLine.lineId ? { ...l, quantity: l.quantity + 1 } : l
          ),
        }
      }
      return {
        cart: [
          ...state.cart,
          { lineId: newLineId(), menuItem: item, quantity: 1, notes: '' },
        ],
      }
    }),

  removeItem: (lineId) =>
    set((state) => ({ cart: state.cart.filter((l) => l.lineId !== lineId) })),

  setQuantity: (lineId, qty) => {
    if (qty <= 0) { get().removeItem(lineId); return }
    set((state) => ({
      cart: state.cart.map((l) => l.lineId === lineId ? { ...l, quantity: qty } : l),
    }))
  },

  setItemNotes: (lineId, notes) =>
    set((state) => ({
      cart: state.cart.map((l) => l.lineId === lineId ? { ...l, notes } : l),
    })),

  setTableId: (id) => set({ tableId: id }),
  setOrderNumber: (n) => set({ orderNumber: n }),

  // Sends the cart to POST /api/v1/orders. On success, clears the cart so staff can
  // immediately start the next order. The number field is omitted when empty so the
  // server falls back to its daily counter.
  submit: async () => {
    const { cart, tableId, orderNumber } = get()
    set({ submitting: true, submitError: null })

    const trimmed = orderNumber.trim()
    const parsedNumber = trimmed !== '' ? parseInt(trimmed, 10) : undefined

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          ...(parsedNumber !== undefined ? { number: parsedNumber } : {}),
          items: cart.map((l) => ({
            menuItemId: l.menuItem.id,
            quantity: l.quantity,
            ...(l.notes ? { notes: l.notes } : {}),
          })),
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to place order')
      set({ submitting: false })
      get().resetCart()
    } catch (err) {
      set({ submitting: false, submitError: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  // Intentionally does not reset orderNumber — CartPanel re-fetches the next number from
  // the API immediately after submit. Clearing here would cause a blank field flash
  // before the fetch resolves.
  resetCart: () => set({
    cart: [],
    submitting: false,
    submitError: null,
  }),
}))
