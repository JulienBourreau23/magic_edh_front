"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { WishlistButton } from "@/components/WishlistButton"
import { displayName, upcomingApi, type Upcoming, type UpcomingCard } from "@/lib/api"

type Filter = "toutes" | "possedees" | "manquantes"

const FILTER_LABELS: Record<Filter, string> = {
  toutes: "Toutes",
  possedees: "Possédées",
  manquantes: "Manquantes",
}

function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000)
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function summarize(cards: UpcomingCard[]) {
  const missing = cards.filter((c) => c.owned_quantity === 0)
  const priced = missing.filter((c) => c.price_eur != null)
  return {
    owned: cards.length - missing.length,
    total: cards.length,
    missingCost: priced.reduce((sum, c) => sum + (c.price_eur ?? 0), 0),
    unknownPrice: missing.length - priced.length,
  }
}

export default function UpcomingPage() {
  const [data, setData] = useState<Upcoming | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("toutes")

  useEffect(() => {
    upcomingApi
      .get()
      .then((response) => {
        setData(response)
        setDays(response.release ? daysUntil(response.release.released_at) : null)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [])

  const bySet = useMemo(() => {
    const groups = new Map<string, UpcomingCard[]>()
    for (const card of data?.cards ?? []) {
      groups.set(card.set_code, [...(groups.get(card.set_code) ?? []), card])
    }
    return groups
  }, [data])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>

  const release = data.release
  if (!release) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Prochaine extension</h1>
        <p className="text-sm text-muted-foreground">
          Scryfall n&apos;annonce aucune extension à venir pour l&apos;instant.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {release.sets.map((s) => s.name).join(" · ")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sortie officielle le <strong>{formatDate(release.released_at)}</strong>
          {days != null && days > 0 && (
            <> — dans {days} jour{days > 1 ? "s" : ""}</>
          )}
          . Le jour de la sortie, la page passe d&apos;elle-même à l&apos;extension suivante. Avant
          la sortie, beaucoup de cartes n&apos;ont encore ni prix ni nom français.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {FILTER_LABELS[value]}
          </Button>
        ))}
      </div>

      {release.sets.map((set) => {
        const cards = bySet.get(set.code) ?? []
        const stats = summarize(cards)
        const visible = cards.filter((c) =>
          filter === "possedees"
            ? c.owned_quantity > 0
            : filter === "manquantes"
              ? c.owned_quantity === 0
              : true
        )
        return (
          <Card key={set.code}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {set.icon_svg_uri && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={set.icon_svg_uri} alt="" className="h-5 w-5 dark:invert" />
                )}
                {set.name}
                <Badge variant="secondary">
                  {stats.owned}/{stats.total} possédées
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manquantes : {stats.missingCost.toFixed(2)} €
                {stats.unknownPrice > 0 && <> + {stats.unknownPrice} sans prix connu</>}
              </p>
              {set.prints_in_base < set.card_count && (
                <p className="text-sm text-destructive">
                  {set.prints_in_base} impressions en base sur {set.card_count} annoncées : les
                  spoilers les plus récents arriveront au prochain sync Scryfall.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune carte ne passe ce filtre.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {visible.map((card) => (
                    <div
                      key={card.oracle_id}
                      className={
                        card.owned_quantity > 0
                          ? "flex flex-col gap-1 rounded-lg p-1 ring-2 ring-primary"
                          : "flex flex-col gap-1 p-1"
                      }
                    >
                      <CardTile card={card} caption={displayName(card)} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {card.price_eur != null ? `${card.price_eur.toFixed(2)} €` : "prix inconnu"}
                      </span>
                      {card.owned_quantity > 0 ? (
                        <Badge variant="default" className="w-full">
                          possédée ×{card.owned_quantity}
                        </Badge>
                      ) : (
                        <WishlistButton
                          card={card}
                          wanted={card.wanted_quantity}
                          note={`Nouveauté ${set.name}`}
                          className="h-6 w-full px-2 text-xs"
                          onError={setError}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
