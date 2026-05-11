// Shop-wide menu display flags — two-tier pattern matching themeStore/language:
// localStorage is read at module load (fast, no flash), DB is authoritative and
// overrides via MenuDisplaySync in App.tsx on first render.
import { create } from 'zustand'

interface MenuDisplayState {
  showDescription: boolean
  showComposition: boolean
  setShowDescription: (v: boolean) => void
  setShowComposition: (v: boolean) => void
}

const storedDesc = localStorage.getItem('coffee-show-description')
const storedComp = localStorage.getItem('coffee-show-composition')

export const useMenuDisplayStore = create<MenuDisplayState>((set) => ({
  showDescription: storedDesc !== null ? storedDesc === 'true' : true,
  showComposition: storedComp !== null ? storedComp === 'true' : true,
  setShowDescription: (v) => {
    localStorage.setItem('coffee-show-description', String(v))
    set({ showDescription: v })
  },
  setShowComposition: (v) => {
    localStorage.setItem('coffee-show-composition', String(v))
    set({ showComposition: v })
  },
}))
