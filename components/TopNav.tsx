"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { clearToken } from "@/lib/auth"

const LINKS = [
  { href: "/", label: "Vue d'ensemble" },
  { href: "/decks", label: "Mes decks" },
  { href: "/decks/import", label: "Importer une decklist" },
  { href: "/collection", label: "Ma collection" },
  { href: "/deck-ideas", label: "Quel deck monter" },
  { href: "/deck-plans", label: "Monter 4 decks" },
  { href: "/competitive", label: "Deck compétitif" },
  { href: "/wishlist", label: "Liste de recherche" },
  { href: "/must-have", label: "Cartes à avoir" },
  { href: "/balance", label: "Équilibrer" },
  { href: "/matchup", label: "Comparer" },
]

export function TopNav() {
  const router = useRouter()
  const pathname = usePathname()

  // Sur l'écran de connexion, la navigation n'aurait aucune cible utilisable.
  const onLoginPage = pathname?.startsWith("/login")

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-semibold">
          Magic EDH
        </Link>

        {!onLoginPage && (
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {!onLoginPage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearToken()
                router.push("/login")
              }}
            >
              Déconnexion
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
