"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import { decksApi, displayName, type Suggestions } from "@/lib/api"

const BRACKET_CHOICES = [1, 2, 3, 4, 5]

export default function SuggestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const deckId = Number(id)

  const [maxPrice, setMaxPrice] = useState(50)
  const [targetBracket, setTargetBracket] = useState<number | undefined>(undefined)
  const [data, setData] = useState<Suggestions | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    decksApi
      .suggestions(deckId, maxPrice, targetBracket)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [deckId, maxPrice, targetBracket])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Suggestions</h1>
          <p className="text-sm text-muted-foreground">
            Calculées sur l&apos;écart aux repères de construction, filtrées par identité de couleur,
            légalité et prix, classées par popularité EDHREC. Aucune IA.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href={`/decks/${deckId}`}>Retour au deck</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Prix max par carte (€)</span>
          <Input
            type="number"
            min={1}
            className="w-32"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Bracket visé</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={targetBracket === undefined ? "secondary" : "ghost"}
              onClick={() => setTargetBracket(undefined)}
            >
              aucun
            </Button>
            {BRACKET_CHOICES.map((bracket) => (
              <Button
                key={bracket}
                size="sm"
                variant={targetBracket === bracket ? "secondary" : "ghost"}
                onClick={() => setTargetBracket(bracket)}
              >
                {bracket}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data?.error && <p className="text-sm text-amber-600 dark:text-amber-500">{data.error}</p>}

      {data && !data.error && (
        <>
          {data.to_cut.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">À retirer ({data.to_cut.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {data.to_cut.map((cut) => (
                  <div key={cut.card.scryfall_id} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{displayName(cut.card)}</span>
                    <span className="text-muted-foreground">{cut.reason}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.to_add.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun manque détecté sous {data.max_price_eur} € : les effectifs par rôle et la manabase
              sont dans les repères.
            </p>
          ) : (
            data.to_add.map((group) => (
              <section key={group.role} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold capitalize">{group.label}</h2>
                  <Badge variant="outline">+{group.missing} conseillé(s)</Badge>
                  <span className="text-sm text-muted-foreground">{group.reason}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {group.candidates.map((candidate) => (
                    <CardTile
                      key={candidate.scryfall_id}
                      card={candidate}
                      caption={`${displayName(candidate)} — ${candidate.price_eur?.toFixed(2)} €`}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
