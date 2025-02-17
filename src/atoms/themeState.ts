import { atom } from 'jotai'

export type ThemeType = "system" | "light" | "dark"

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const themeAtom = atom<ThemeType>(localStorage.getItem('theme') as ThemeType || systemTheme)

export const setThemeAtom = atom(null, (get, set, theme: ThemeType) => {
  set(themeAtom, theme)
  localStorage.setItem('theme', theme)
})