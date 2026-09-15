"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

/**
 * Le libellé est choisi par CSS via la variante `dark:`, pas par un état React :
 * le thème résolu n'est pas connu au rendu serveur, et passer par un état
 * « monté » ferait un setState synchrone dans un effet pour rien.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Changer de thème"
    >
      <span className="dark:hidden">Sombre</span>
      <span className="hidden dark:inline">Clair</span>
    </Button>
  )
}
