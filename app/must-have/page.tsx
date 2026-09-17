"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  displayName,
  mustHaveApi,
  type DeckFormat,
  type MustHave,
  type MustHaveGroup,
} from "@/lib/api"

export default function MustHavePage() {
  const [format, setFormat] = useState<DeckFormat>("commander")
  const [maxPrice, setMaxPrice] = useState(50)
  const [data, setData] = useState<MustHave | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mustHaveApi
      .list(format, maxPrice)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [format, maxPrice])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartes à avoir</h1>
        <p className="text-sm text-muted-foreground">
          Les cartes les plus jouées de chaque type, classées par popularité EDHREC. Ce n&apos;est
          pas un palmarès mais une <strong>liste d&apos;achats de long terme</strong> : ce que tu
          possèdes déjà reste affiché quel qu&apos;en soit le prix, et le reste n&apos;apparaît que
          sous ton plafond. La liste se met à jour toute seule au rythme mensuel de la
          synchronisation Scryfall.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Format</span>
          {(["commander", "duel"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={format === value ? "default" : "outline"}
              onClick={() => setFormat(value)}
            >
              {value === "commander" ? "Commander" : "Duel Commander"}
            </Button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Prix max par carte achetée (€)
          </span>
          <Input
            type="number"
            min={1}
            className="w-28"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {format === "duel" && (
        <p className="text-sm text-muted-foreground">
          La banlist du Duel Commander est plus restrictive : Sol Ring et Ancient Tomb en sortent,
          et des cartes moins jouées prennent leur place.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.groups.map((group) => (
        <TypeTable key={group.key} group={group} maxPrice={data.max_price_eur} />
      ))}
    </div>
  )
}

function TypeTable({ group, maxPrice }: { group: MustHaveGroup; maxPrice: number }) {
  if (group.cards.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {group.label}{" "}
          <span className="font-normal text-muted-foreground">
            — {group.owned_count} en collection, {group.to_buy_count} à acheter
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-12 py-1.5 font-medium">Rang</th>
              <th className="py-1.5 font-medium">Carte</th>
              <th className="w-28 py-1.5 font-medium">Coût</th>
              <th className="w-32 py-1.5 text-right font-medium">Prix</th>
            </tr>
          </thead>
          <tbody>
            {group.cards.map((card) => (
              <tr
                key={card.oracle_id}
                className={`border-b last:border-0 ${card.owned > 0 ? "text-muted-foreground" : ""}`}
              >
                <td className="py-1.5 tabular-nums">{card.edhrec_rank}</td>
                <td className="py-1.5">
                  <span className={card.owned > 0 ? "" : "font-medium text-foreground"}>
                    {displayName(card)}
                  </span>
                </td>
                <td className="py-1.5 font-mono text-xs">{card.mana_cost}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {card.owned > 0 ? (
                    <Badge variant="secondary">
                      en collection{card.owned > 1 ? ` ×${card.owned}` : ""}
                    </Badge>
                  ) : (
                    `${Number(card.price_eur).toFixed(2)} €`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {group.over_budget > 0 && (
          <p className="text-xs text-muted-foreground">
            {group.over_budget} carte(s) parmi les {group.top} plus jouées de ce type dépassent{" "}
            {maxPrice} € et ne sont pas listées — la liste est volontairement filtrée, elle ne
            prétend pas être un classement complet.
          </p>
        )}
        {group.cards.length < group.top && (
          <p className="text-xs text-muted-foreground">
            Ce type compte moins de {group.top} cartes classées : la liste est complète.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
