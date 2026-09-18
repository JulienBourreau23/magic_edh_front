"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ManabaseAdvice } from "@/components/ManabaseAdvice"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import { decksApi, displayName, type Suggestions } from "@/lib/api"
import { WishlistButton } from "@/components/WishlistButton"

const BRACKET_CHOICES = [1, 2, 3, 4, 5]

export default function SuggestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const deckId = Number(id)

  const [maxPrice, setMaxPrice] = useState(50)
  const [targetBracket, setTargetBracket] = useState<number | undefined>(undefined)
  const [data, setData] = useState<Suggestions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Incrémenté après chaque refus : ici le rechargement n'est pas un luxe,
  // c'est le but. Écarter une carte doit laisser une autre prendre sa place,
  // et seule une nouvelle passe du moteur peut la désigner.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    decksApi
      .suggestions(deckId, maxPrice, targetBracket)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [deckId, maxPrice, targetBracket, reload])

  async function run(key: string, action: () => Promise<unknown>, refresh = true) {
    setBusy(key)
    try {
      await action()
      setError(null)
      if (refresh) setReload((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setBusy(null)
    }
  }

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
          {/* La manabase d'abord : elle se corrige sans rien acheter, alors que
              tout ce qui suit coûte de l'argent ou un emplacement. */}
          {(data.manabase.basic_lands || data.manabase.strained_total > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manabase</CardTitle>
              </CardHeader>
              <CardContent>
                <ManabaseAdvice
                  stuckCards={data.manabase.stuck_cards}
                  measuredStuckRate={data.manabase.measured_stuck_rate}
                  strained={data.manabase.strained_cards}
                  strainedTotal={data.manabase.strained_total}
                  basicLands={data.manabase.basic_lands}
                />
              </CardContent>
            </Card>
          )}

          {data.to_cut.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">À retirer ({data.to_cut.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {data.to_cut.map((cut, index) => (
                  <div key={cut.card?.scryfall_id ?? `sans-carte-${index}`}
                       className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {cut.card ? displayName(cut.card) : "Aucune carte à retirer"}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{cut.reason}</span>
                      {cut.card && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          disabled={busy === `i:${cut.card.oracle_id}`}
                          onClick={() =>
                            run(`i:${cut.card!.oracle_id}`, () =>
                              decksApi.ignore(deckId, cut.card!.oracle_id, "je la garde")
                            )
                          }
                          aria-label={`Garder ${displayName(cut.card)} malgré le conseil`}
                        >
                          je la garde
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.ignored.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ignorées pour ce deck ({data.ignored.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  Ces cartes ne sont plus proposées, ni à l&apos;ajout ni au retrait, pour ce deck
                  seulement. Le refus n&apos;a rien retiré du deck : il ne parle que du conseil.
                </p>
                {data.ignored.map((card) => (
                  <div key={card.oracle_id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{displayName(card)}</span>
                    <span className="flex items-center gap-2">
                      {card.reason && (
                        <span className="text-xs text-muted-foreground">{card.reason}</span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        disabled={busy === `u:${card.oracle_id}`}
                        onClick={() =>
                          run(`u:${card.oracle_id}`, () =>
                            decksApi.unignore(deckId, card.oracle_id)
                          )
                        }
                        aria-label={`Reproposer ${displayName(card)} pour ce deck`}
                      >
                        reproposer
                      </Button>
                    </span>
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
                    <div key={candidate.scryfall_id} className="flex flex-col gap-1">
                      <CardTile
                        card={candidate}
                        caption={`${displayName(candidate)} — ${candidate.price_eur?.toFixed(2)} €`}
                      />
                      <div className="flex gap-1">
                        <WishlistButton
                          card={candidate}
                          wanted={candidate.wanted_quantity}
                          note={`Conseillée pour ${group.label.toLowerCase()}`}
                          className="h-6 flex-1 px-1 text-xs"
                          onError={setError}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 flex-1 px-1 text-xs"
                          disabled={busy === `i:${candidate.oracle_id}`}
                          onClick={() =>
                            run(`i:${candidate.oracle_id}`, () =>
                              decksApi.ignore(deckId, candidate.oracle_id, group.label)
                            )
                          }
                          aria-label={`Ne plus proposer ${displayName(candidate)} pour ce deck`}
                        >
                          ignorer
                        </Button>
                      </div>
                    </div>
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
