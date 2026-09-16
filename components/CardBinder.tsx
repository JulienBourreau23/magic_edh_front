"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CardTile } from "@/components/CardTile"
import { displayName, type CollectionEntry } from "@/lib/api"

/**
 * Neuf cartes par page : c'est ce que montre une pochette de classeur, et
 * c'est aussi ce qui tient sur un écran sans faire défiler. La pagination
 * limite au passage le nombre d'images chargées d'un coup — le back ne les
 * rapatrie pas pour la collection, elles viennent donc de Scryfall.
 */
const PER_PAGE = 9

export function CardBinder({
  entries,
  onQuantityChange,
}: {
  entries: CollectionEntry[]
  onQuantityChange: (entry: CollectionEntry, delta: number) => void
}) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(entries.length / PER_PAGE))
  // La page courante peut sortir des limites quand un filtre réduit la liste :
  // on la borne à l'affichage plutôt que de la corriger dans un effet, que la
  // règle `react-hooks/set-state-in-effect` interdit.
  const current = Math.min(page, pageCount - 1)
  const shown = entries.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((entry) => (
          <div key={entry.oracle_id} className="flex flex-col gap-1">
            <CardTile card={entry} caption={displayName(entry)} />
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                {entry.price_eur != null ? `${entry.price_eur.toFixed(2)} €` : "prix inconnu"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => onQuantityChange(entry, -1)}
                  aria-label={`Retirer un exemplaire de ${displayName(entry)}`}
                >
                  −
                </Button>
                <span className="w-5 text-center text-sm tabular-nums">{entry.quantity}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => onQuantityChange(entry, 1)}
                  aria-label={`Ajouter un exemplaire de ${displayName(entry)}`}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
          >
            ← Page précédente
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {current + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
            disabled={current === pageCount - 1}
          >
            Page suivante →
          </Button>
        </div>
      )}
    </div>
  )
}
