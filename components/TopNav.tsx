"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ThemeToggle"
import { clearToken } from "@/lib/auth"

type Entree = { href: string; label: string; hint: string }
type Groupe = { label: string; items: Entree[] }

/**
 * Les pages rangées par **question posée**, et non par ordre d'apparition.
 *
 * Dix-sept liens alignés à plat tenaient sur trois rangées où rien ne se
 * distinguait : « Terrains budget » voisinait « Qui gagne » sans qu'on sache
 * lequel parlait de la collection et lequel d'un deck. Le regroupement suit la
 * seule frontière qui compte ici — ce que je possède, ce que je joue, ce que je
 * pourrais monter, ce que ça vaut, et ce que le format impose.
 *
 * Chaque entrée porte une phrase courte : la moitié de ces pages ont un nom qui
 * ne dit pas ce qu'elles font, et l'infobulle d'un lien ne se lit jamais.
 */
const GROUPES: Groupe[] = [
  {
    label: "Collection",
    items: [
      { href: "/", label: "Vue d'ensemble", hint: "ce que je couvre de ce qui se joue" },
      { href: "/collection", label: "Ma collection", hint: "ce que je possède, par carte" },
      { href: "/wishlist", label: "Liste de recherche", hint: "ce que j'envisage d'acheter" },
      { href: "/must-have", label: "Cartes à avoir", hint: "les plus jouées, sous plafond de prix" },
      { href: "/terrains-budget", label: "Terrains budget", hint: "compléter sa manabase par cycles" },
    ],
  },
  {
    label: "Decks",
    items: [
      { href: "/decks", label: "Mes decks", hint: "les listes enregistrées" },
      { href: "/decks/import", label: "Importer une decklist", hint: "coller un deck, en français ou non" },
      { href: "/build", label: "Construire à la main", hint: "l'atelier, carte par carte" },
      { href: "/archives", label: "Archives", hint: "les decks rangés" },
    ],
  },
  {
    label: "Que monter",
    items: [
      { href: "/deck-ideas", label: "Quel deck monter", hint: "les commandants les mieux couverts" },
      { href: "/deck-plans", label: "Monter 4 decks", hint: "un groupe équilibré, achats minimisés" },
      { href: "/competitive", label: "Deck compétitif", hint: "le plus proche des decks réels d'un archétype" },
    ],
  },
  {
    label: "Mesurer",
    items: [
      { href: "/balance", label: "Équilibrer", hint: "rapprocher les brackets d'un groupe" },
      { href: "/matchup", label: "Comparer", hint: "deux decks, axe par axe" },
      { href: "/performance", label: "Qui gagne", hint: "victoires simulées par commandant" },
    ],
  },
  {
    label: "Le format",
    items: [
      { href: "/archetypes", label: "Archétypes", hint: "ce que le format joue, et ce que ça coûte" },
      { href: "/regles", label: "Règles", hint: "banlists, brackets, Game Changers" },
    ],
  },
]

/**
 * Le lien courant est **le plus long qui corresponde**, pas le premier trouvé :
 * `/decks/import` commence par `/decks`, et l'un des deux doit gagner. Sans ce
 * choix, importer une decklist surlignerait « Mes decks ».
 */
function entreeCourante(pathname: string | null): string | null {
  if (!pathname) return null
  const candidats = GROUPES.flatMap((groupe) => groupe.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
  return candidats.sort((a, b) => b.length - a.length)[0] ?? null
}

export function TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const courant = entreeCourante(pathname)

  // Sur l'écran de connexion, la navigation n'aurait aucune cible utilisable.
  const onLoginPage = pathname?.startsWith("/login")

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/" className="mr-2 font-semibold">
          Magic EDH
        </Link>

        {!onLoginPage && (
          <nav className="flex flex-wrap items-center gap-1">
            {GROUPES.map((groupe) => {
              const actif = groupe.items.some((item) => item.href === courant)
              return (
                <DropdownMenu key={groupe.label}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        actif ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }
                    >
                      {groupe.label}
                      <ChevronDownIcon className="ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    {groupe.items.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          aria-current={item.href === courant ? "page" : undefined}
                          className="flex-col items-start gap-0"
                        >
                          <span
                            className={
                              item.href === courant ? "font-semibold text-primary" : ""
                            }
                          >
                            {item.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.hint}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
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
