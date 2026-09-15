"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import { deckIdeasApi, displayName, type DeckIdea, type DeckIdeas } from "@/lib/api"

export default function DeckIdeasPage() {
  const [maxPrice, setMaxPrice] = useState(50)
  const [data, setData] = useState<DeckIdeas | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    deckIdeasApi
      .list(maxPrice)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [maxPrice])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Quel deck monter</h1>
        <p className="text-sm text-muted-foreground">
          Pour chaque commandant de ta collection, les cartes qu&apos;EDHREC voit réellement jouées
          avec lui, croisées avec ce que tu possèdes déjà. Classement par couverture : le premier
          est le moins cher à monter.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Prix max par carte achetée (€)</span>
        <Input
          type="number"
          min={1}
          className="w-28"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data?.error && <p className="text-sm text-amber-600 dark:text-amber-500">{data.error}</p>}
      {data && !data.error && data.ideas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun commandant dans ta collection — ajoute une créature légendaire pour voir des idées.
        </p>
      )}

      {data?.ideas.map((idea) => (
        <IdeaCard key={idea.commander.oracle_id} idea={idea} coreSize={data.nonland_core} />
      ))}
    </div>
  )
}

function IdeaCard({ idea, coreSize }: { idea: DeckIdea; coreSize: number }) {
  const percent = Math.round(idea.coverage * 100)
  const topBracket = idea.bracket_counts
    ? Object.entries(idea.bracket_counts).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {displayName(idea.commander)}
          <Badge variant={percent >= 70 ? "secondary" : "outline"}>{percent} % du noyau</Badge>
          <Badge variant="outline">
            {idea.to_buy_count} carte(s) à acheter · {idea.to_buy_cost_eur.toFixed(2)} €
          </Badge>
          {topBracket && (
            <Badge variant="outline">Surtout monté en bracket {topBracket[0]}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--grid-line)" }}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {idea.owned_count}/{coreSize} possédées
          </span>
        </div>

        {idea.over_budget_count > 0 && (
          <p className="text-xs text-muted-foreground">
            {idea.over_budget_count} carte(s) recommandée(s) dépassent le plafond de prix et ne sont
            pas comptées ci-dessus.
          </p>
        )}

        {idea.to_buy.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Les plus jouées qui te manquent
            </span>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {idea.to_buy.slice(0, 6).map((card) => (
                <CardTile
                  key={card.scryfall_id}
                  card={card}
                  caption={`${displayName(card)} — ${card.price_eur?.toFixed(2)} €`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
