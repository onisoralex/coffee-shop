import { create } from 'zustand'
import type { MenuSnapshot } from '@coffee/shared'

interface MenuState {
  snapshot: MenuSnapshot | null
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  setSnapshot: (snapshot: MenuSnapshot) => void
}

export const useMenuStore = create<MenuState>((set, get) => ({
  snapshot: null,
  loading: false,
  error: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  fetch: async () => {
    if (get().snapshot) return  // already loaded; callers can still force a reload by clearing snapshot first
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/v1/menu')
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { data: MenuSnapshot }
      set({ snapshot: json.data, loading: false })
    } catch {
      set({ error: 'Could not load menu', loading: false })
    }
  },
  // Exposed so the retry button can force a re-fetch after an error
  // by clearing the error+snapshot first, then calling fetch again.
}))

export function retryMenu() {
  useMenuStore.setState({ snapshot: null, error: null })
  return useMenuStore.getState().fetch()
}
