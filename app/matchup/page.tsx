"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { decksApi, matchupApi, type DeckSummary, type Matchup } from "@/lib/api"
import { ColorDonut } from "@/components/ColorDonut"
import { AxisRings } from "@/components/AxisRings"
import { InitiativeSplit } from "@/components/InitiativeSplit"
import { DuelOutcome } from "@/components/DuelOutcome"

export default function MatchupPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement...</p>}>
      <MatchupComparison />
    </Suspense>
  )
}

function MatchupComparison() {
  const searchParams = useSearchParams()
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [a, setA] = useState<number | null>(Number(searchParams.get("a")) || null)
  const [b, setB] = useState<number | null>(Number(searchParams.get("b")) || null)
  const [result, setResult] = useState<Matchup | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    decksApi.list().then(setDecks).catch(() => setDecks([]))
  }, [])

  const pairIsValid = Boolean(a && b && a !== b)
  // Le résultat affiché est dérivé de la paire courante : on ne remet pas
  // l'état à zéro, on s'abstient simplement de montrer une comparaison
  // qui ne correspond plus aux decks sélectionnés.
  const comparison = pairIsValid && result?.a.deck_id === a && result?.b.deck_id === b ? result : null

  useEffect(() => {
    if (!pairIsValid) return
    matchupApi
      .compare(a as number, b as number)
      .then((response) => {
        setResult(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [a, b, pairIsValid])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Comparer deux decks</h1>
        <p className="text-sm text-muted-foreground">
          Chaque axe est mesuré (simulation de 1000 parties + comptages). Le verdict n&apos;est que la
          mise en phrase du décompte — aucune IA n&apos;intervient.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DeckPicker label="Deck A" decks={decks} selected={a} exclude={b} onSelect={setA} />
        <DeckPicker label="Deck B" decks={decks} selected={b} exclude={a} onSelect={setB} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {comparison && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {comparison.a.name} {comparison.wins.a} — {comparison.wins.b} {comparison.b.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{comparison.verdict}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duel simulé — taux de victoire</CardTitle>
            </CardHeader>
            <CardContent>
              <DuelOutcome duel={comparison.duel} nameA={comparison.a.name} nameB={comparison.b.name} />
            </CardContent>
          </Card>

          {comparison.initiative.a !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Qui démarre le plus vite</CardTitle>
              </CardHeader>
              <CardContent>
                <InitiativeSplit
                  a={comparison.initiative.a}
                  b={comparison.initiative.b ?? 0}
                  tie={comparison.initiative.tie ?? 0}
                  nameA={comparison.a.name}
                  nameB={comparison.b.name}
                  iterations={comparison.initiative.iterations}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparaison axe par axe</CardTitle>
            </CardHeader>
            <CardContent>
              <AxisRings axes={comparison.axes} nameA={comparison.a.name} nameB={comparison.b.name} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {[comparison.a, comparison.b].map((profile) => (
              <Card key={profile.deck_id}>
                <CardHeader>
                  <CardTitle className="text-base">{profile.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="w-fit">{profile.bracket.label}</Badge>
                  <ColorDonut
                    colors={profile.manabase.colors}
                    colorlessCards={profile.manabase.colorless_cards}
                  />
                  <span>
                    {profile.manabase.land_count} terrains · {profile.interaction_count}{" "}
                    cartes d&apos;interaction · commandant tour{" "}
                    {profile.simulation.avg_commander_turn ?? "—"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Voir les chiffres en tableau</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Axe</th>
                    <th className="py-2 text-right font-medium">{comparison.a.name}</th>
                    <th className="py-2 text-right font-medium">{comparison.b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.axes.map((axis) => (
                    <tr key={axis.label} className="border-b last:border-0">
                      <td className="py-2 pr-4">{axis.label}</td>
                      <td className={`py-2 text-right tabular-nums ${axis.winner === "a" ? "font-semibold" : "text-muted-foreground"}`}>
                        {axis.a ?? "—"}
                      </td>
                      <td className={`py-2 text-right tabular-nums ${axis.winner === "b" ? "font-semibold" : "text-muted-foreground"}`}>
                        {axis.b ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

function DeckPicker({
  label,
  decks,
  selected,
  exclude,
  onSelect,
}: {
  label: string
  decks: DeckSummary[]
  selected: number | null
  exclude: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {decks.map((deck) => (
          <Button
            key={deck.id}
            size="sm"
            variant={selected === deck.id ? "secondary" : "outline"}
            disabled={exclude === deck.id}
            onClick={() => onSelect(deck.id)}
          >
            {deck.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
