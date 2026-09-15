"use client"

import { ThemeProvider as NextThemeProvider } from "next-themes"

/** `attribute="class"` parce que globals.css déclare `dark` comme variante de classe. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  )
}
