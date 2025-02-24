import { atom } from 'jotai'

export type ThemeType = "system" | "light" | "dark"

export const systemThemeAtom = atom<"light" | "dark">(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export const themeAtom = atom<ThemeType>(localStorage.getItem('theme') as ThemeType || systemThemeAtom)

export const setThemeAtom = atom(null, (get, set, theme: ThemeType) => {
  set(themeAtom, theme)
  localStorage.setItem('theme', theme)
})