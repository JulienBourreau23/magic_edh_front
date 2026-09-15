"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cardsApi, displayName, type Card } from "@/lib/api"

/** Recherche de carte avec anti-rebond, utilisée pour ajouter ou corriger une carte. */
export function CardSearch({
  placeholder = "Chercher une carte...",
  onSelect,
}: {
  placeholder?: string
  onSelect: (card: Card) => void | Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)

  // La liste affichée est dérivée de la requête courante : inutile de vider
  // l'état à chaque frappe, il suffit de ne pas montrer un résultat périmé.
  const tooShort = query.trim().length < 2
  const visibleResults = tooShort ? [] : results

  useEffect(() => {
    if (tooShort) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await cardsApi.search(query.trim()))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, tooShort])

  return (
    <div className="flex flex-col gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {loading && <p className="text-xs text-muted-foreground">Recherche...</p>}
      {visibleResults.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-1">
          {visibleResults.map((card) => (
            <li key={card.scryfall_id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between gap-2 px-2 py-1 text-left"
                onClick={async () => {
                  await onSelect(card)
                  setQuery("")
                  setResults([])
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{displayName(card)}</span>
                  {displayName(card) !== card.name && (
                    <span className="truncate text-xs text-muted-foreground">{card.name}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {card.type_line?.split("—")[0]?.trim()}
                  {card.price_eur != null ? ` · ${card.price_eur.toFixed(2)} €` : ""}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
