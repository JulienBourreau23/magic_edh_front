"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CARD_TYPES, COLORS, roleLabel } from "@/lib/mtg-labels"
import {
  EMPTY_WISHLIST_FILTERS,
  isWishlistFiltered,
  type WishlistFilterState,
  type WishlistSort,
} from "@/lib/wishlist-filters"

const TRIS: { value: WishlistSort; label: string }[] = [
  { value: "prix-desc", label: "prix ↓" },
  { value: "prix-asc", label: "prix ↑" },
  { value: "popularite", label: "popularité" },
  { value: "quantite", label: "exemplaires demandés" },
  { value: "ajout", label: "ajout récent" },
]

/** Paliers de budget courants : décider « ce soir j'y mets 5 € » en un clic. */
const PLAFONDS = [0.5, 1, 2, 5, 20]

/**
 * De quoi décider **quoi acheter en premier**, pas de quoi chercher une carte :
 * budget, besoin et qualité. Tout est appliqué dans le navigateur, la liste
 * étant courte par nature.
 */
export function WishlistFilters({
  filters,
  onChange,
  roles,
}: {
  filters: WishlistFilterState
  onChange: (filters: WishlistFilterState) => void
  roles: string[]
}) {
  const set = (patch: Partial<WishlistFilterState>) => onChange({ ...filters, ...patch })
  const toggle = <K extends "types" | "colors">(key: K, value: string) =>
    set({
      [key]: filters[key].includes(value)
        ? filters[key].filter((item) => item !== value)
        : [...filters[key], value],
    } as Partial<WishlistFilterState>)

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Chercher une carte…"
          className="w-56"
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
        />
        {/* La note dit pour quel deck la carte est cherchée : c'est le critère
            le plus utile pour prioriser, avant même le prix. */}
        <Input
          placeholder="Pour quel deck… (cherche dans la note)"
          className="w-64"
          value={filters.reason}
          onChange={(event) => set({ reason: event.target.value })}
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Budget par carte</span>
          <div className="flex flex-wrap gap-1">
            {PLAFONDS.map((plafond) => (
              <Button
                key={plafond}
                size="sm"
                variant={filters.maxPrice === plafond ? "secondary" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => set({ maxPrice: filters.maxPrice === plafond ? null : plafond })}
              >
                ≤ {plafond} €
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Trier par</span>
          <div className="flex flex-wrap gap-1">
            {TRIS.map((tri) => (
              <Button
                key={tri.value}
                size="sm"
                variant={filters.sort === tri.value ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => set({ sort: tri.value })}
              >
                {tri.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {CARD_TYPES.map((type) => (
          <Button
            key={type.value}
            size="sm"
            variant={filters.types.includes(type.value) ? "secondary" : "ghost"}
            className="h-6 px-2 text-xs"
            onClick={() => toggle("types", type.value)}
          >
            {type.label}
          </Button>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {COLORS.map((color) => (
          <Button
            key={color.value}
            size="sm"
            variant={filters.colors.includes(color.value) ? "secondary" : "ghost"}
            className="h-6 w-7 px-0 text-xs"
            onClick={() => toggle("colors", color.value)}
            aria-label={color.label}
          >
            {color.letter}
          </Button>
        ))}
      </div>

      {roles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {roles.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={filters.role === role ? "secondary" : "ghost"}
              className="h-6 px-2 text-xs"
              onClick={() => set({ role: filters.role === role ? null : role })}
            >
              {roleLabel(role)}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant={filters.multipleOnly ? "secondary" : "ghost"}
          className="h-6 px-2 text-xs"
          onClick={() => set({ multipleOnly: !filters.multipleOnly })}
        >
          plusieurs exemplaires demandés
        </Button>
        <Button
          size="sm"
          variant={filters.ownedOnly ? "secondary" : "ghost"}
          className="h-6 px-2 text-xs"
          onClick={() => set({ ownedOnly: !filters.ownedOnly })}
        >
          déjà en collection
        </Button>
        <Button
          size="sm"
          variant={filters.gameChangersOnly ? "secondary" : "ghost"}
          className="h-6 px-2 text-xs"
          onClick={() => set({ gameChangersOnly: !filters.gameChangersOnly })}
        >
          Game Changers
        </Button>
        <Button
          size="sm"
          variant={filters.hideUnknownPrice ? "secondary" : "ghost"}
          className="h-6 px-2 text-xs"
          onClick={() => set({ hideUnknownPrice: !filters.hideUnknownPrice })}
        >
          masquer les prix inconnus
        </Button>
        {isWishlistFiltered(filters) && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-6 px-2 text-xs"
            onClick={() => onChange({ ...EMPTY_WISHLIST_FILTERS, sort: filters.sort })}
          >
            tout afficher
          </Button>
        )}
      </div>
    </div>
  )
}

/** Ce que coûte la sélection affichée, à côté du total de la liste entière. */
export function WishlistSummary({
  shown,
  total,
  filtered,
}: {
  shown: { distinct: number; copies: number; total: number; unknownPrice: number }
  total: number
  filtered: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="secondary">
        {shown.distinct} carte(s) · {shown.copies} exemplaire(s)
      </Badge>
      <Badge variant="outline">{shown.total.toFixed(2)} € affichés</Badge>
      {filtered && (
        <span className="text-xs text-muted-foreground">
          sur {total.toFixed(2)} € pour la liste entière
        </span>
      )}
      {shown.unknownPrice > 0 && (
        <span className="text-xs text-amber-600 dark:text-amber-500">
          {shown.unknownPrice} au prix inconnu, hors total
        </span>
      )}
    </div>
  )
}
