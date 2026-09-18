"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { balanceApi, decksApi, displayName, type BalanceResult, type DeckSummary } from "@/lib/api"
import { WishlistButton } from "@/components/WishlistButton"
import { downloadShoppingListPdf } from "@/lib/shopping-pdf"

const MAX_DECKS = 4

/**
 * `useSearchParams` force le rendu client de tout ce qui est sous lui : la
 * documentation de Next demande une frontière `Suspense`, sans quoi la page
 * entière sort du prérendu.
 */
export default function BalancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <BalanceContent />
    </Suspense>
  )
}

function BalanceContent() {
  // `?decks=12,13,14,15` : ce que « Créer ces decks » passe depuis /deck-plans,
  // pour que la suite — les améliorations à faire dans le temps — s'ouvre déjà
  // sur les bons decks plutôt que sur quatre cases à recocher.
  const searchParams = useSearchParams()
  const preselected = (searchParams.get("decks") ?? "")
    .split(",")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, MAX_DECKS)

  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [selected, setSelected] = useState<number[]>(preselected)
  const [maxPrice, setMaxPrice] = useState(50)
  const [result, setResult] = useState<BalanceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Refuser une carte relance le calcul : une autre doit prendre sa place, et
  // seul le moteur peut la désigner.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    decksApi.list().then(setDecks).catch(() => setDecks([]))
  }, [])

  useEffect(() => {
    if (selected.length === 0) return
    balanceApi
      .run(selected, maxPrice)
      .then((response) => {
        setResult(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [selected, maxPrice, reload])

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

  // Rien à afficher tant que la réponse ne correspond pas à la sélection courante.
  const report = selected.length > 0 ? result : null

  function toggle(deckId: number) {
    setSelected((current) =>
      current.includes(deckId)
        ? current.filter((id) => id !== deckId)
        : current.length >= MAX_DECKS
          ? current
          : [...current, deckId]
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Équilibrer mes decks</h1>
        <p className="text-sm text-muted-foreground">
          Jusqu&apos;à {MAX_DECKS} decks comparés à ta collection. Un exemplaire ne sert qu&apos;à un
          deck : <strong>l&apos;ordre de sélection fixe la priorité</strong>. Le bracket visé est par
          défaut celui du deck le plus faible, parce que retirer des cartes ne coûte rien alors
          qu&apos;en ajouter coûte de l&apos;argent.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap gap-1.5">
          {decks.map((deck) => {
            const rank = selected.indexOf(deck.id)
            return (
              <Button
                key={deck.id}
                size="sm"
                variant={rank >= 0 ? "secondary" : "outline"}
                onClick={() => toggle(deck.id)}
              >
                {rank >= 0 && <span className="mr-1 tabular-nums opacity-70">{rank + 1}.</span>}
                {deck.name}
              </Button>
            )
          })}
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {report?.error && <p className="text-sm text-amber-600 dark:text-amber-500">{report.error}</p>}

      {report && !report.error && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Bracket visé : {report.target_bracket}</Badge>
            <Badge variant={report.spread.gap > 0 ? "secondary" : "outline"}>
              Écart actuel : {report.spread.gap} niveau(x) ({report.spread.min} → {report.spread.max})
            </Badge>
            <Badge variant="secondary">{report.total_cost_eur.toFixed(2)} € d&apos;achats</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Couverture par la collection</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {report.allocation.decks.map((deck) => (
                <div key={deck.deck_id} className="flex flex-wrap justify-between gap-2">
                  <span>{deck.name}</span>
                  <span className="text-muted-foreground">
                    {deck.owned_count} possédée(s) · {deck.to_buy_count} à acheter (
                    {deck.to_buy_cost_eur.toFixed(2)} €)
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {report.plans.map((plan) => (
            <Card key={plan.deck_id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {plan.name} <span className="font-normal text-muted-foreground">— {plan.bracket.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {plan.cuts.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      À retirer (gratuit, fait baisser le bracket)
                    </span>
                    {plan.cuts.map((cut, index) => (
                      <div key={cut.card?.scryfall_id ?? `sans-carte-${index}`}>
                        {cut.card && (
                          <span className="font-medium">{displayName(cut.card)} </span>
                        )}
                        <span className="text-muted-foreground">
                          {cut.card ? "— " : ""}
                          {cut.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {plan.adds.map((group) => (
                  <div key={group.role} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.label} — {group.reason}
                    </span>
                    {group.candidates.map((candidate) => (
                      <div key={candidate.scryfall_id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{displayName(candidate)}</span>
                        <span className="flex items-center gap-2">
                          {candidate.free_to_use ? (
                            <Badge variant="secondary">déjà en collection</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              à acheter · {candidate.price_eur?.toFixed(2)} €
                            </span>
                          )}
                          {!candidate.free_to_use && (
                            <WishlistButton
                              card={candidate}
                              wanted={candidate.wanted_quantity}
                              note={`Conseillée pour ${plan.name}`}
                              onError={setError}
                            />
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            disabled={busy === `i:${plan.deck_id}:${candidate.oracle_id}`}
                            onClick={() =>
                              run(`i:${plan.deck_id}:${candidate.oracle_id}`, () =>
                                decksApi.ignore(plan.deck_id, candidate.oracle_id, group.label)
                              )
                            }
                            aria-label={`Ne plus proposer ${displayName(candidate)} pour ${plan.name}`}
                          >
                            ignorer
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                <p className="text-xs text-muted-foreground">
                  Les cartes refusées ne sont plus proposées pour ce deck. Pour revenir sur un
                  refus, voir « Ignorées » dans les suggestions du deck.
                </p>

                <div className="text-xs text-muted-foreground">
                  {plan.free_picks} carte(s) prise(s) dans la collection · {plan.purchases_cost_eur.toFixed(2)} €
                  d&apos;achats conseillés
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Liste d&apos;achats — {report.shopping_list.length} ligne(s), {report.total_cost_eur.toFixed(2)} €
              </CardTitle>
              <Button
                onClick={() =>
                  downloadShoppingListPdf(
                    report.shopping_list,
                    report.plans.map((plan) => plan.name),
                    report.total_cost_eur
                  )
                }
                disabled={report.shopping_list.length === 0}
              >
                Exporter en PDF
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Qté</th>
                    <th className="py-2 font-medium">Carte</th>
                    <th className="py-2 text-right font-medium">Total</th>
                    <th className="py-2 font-medium">Pour</th>
                    <th className="py-2 font-medium sr-only">Liste de recherche</th>
                  </tr>
                </thead>
                <tbody>
                  {report.shopping_list.map((item) => (
                    <tr key={item.oracle_id} className="border-b last:border-0">
                      <td className="py-1.5 tabular-nums">{item.quantity}</td>
                      <td className="py-1.5 pr-4">
                        {displayName(item)}
                        <span className="block text-xs text-muted-foreground">{item.motif}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{item.total_eur.toFixed(2)} €</td>
                      <td className="py-1.5 text-xs text-muted-foreground">{item.decks.join(", ")}</td>
                      <td className="py-1.5 text-right">
                        <WishlistButton
                          card={item}
                          wanted={item.wanted_quantity}
                          note={`Manque pour ${item.decks.join(", ")}`}
                          onError={setError}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
