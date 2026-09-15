"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { decksApi, type SimulationResponse } from "@/lib/api"

export default function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const deckId = Number(id)

  const [seed, setSeed] = useState(0)
  const [data, setData] = useState<SimulationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    decksApi
      .simulation(deckId, seed)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [deckId, seed])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Simulation en cours...</p>

  const { metrics, sample_opening: opening } = data
  const percent = (value: number) => `${Math.round(value * 100)} %`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Simulation de sorties</h1>
          <p className="text-sm text-muted-foreground">
            {metrics.iterations} parties en solitaire, sans adversaire. Aucun modèle d&apos;IA : ce sont des
            tirages aléatoires et du calcul de mana.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSeed(Math.floor(Math.random() * 100000))}>Nouvelle main</Button>
          <Button asChild variant="ghost">
            <Link href={`/decks/${deckId}`}>Retour au deck</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mains gardées à 7" value={percent(metrics.keep_seven_rate)} hint={`${metrics.avg_mulligans} mulligan en moyenne`} />
        <Stat
          label="Commandant lancé"
          value={metrics.avg_commander_turn ? `tour ${metrics.avg_commander_turn}` : "—"}
          hint={`${percent(metrics.commander_cast_rate)} des parties`}
        />
        <Stat label="Terrains en main de départ" value={metrics.avg_opening_lands.toFixed(2)} hint="sur 7 cartes" />
        <Stat
          label="Blocage de couleurs"
          value={percent(metrics.color_screw_rate)}
          hint="mana suffisant, mauvaises couleurs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Probabilité d&apos;avoir lancé le commandant</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {Object.entries(metrics.commander_cast_by_turn).map(([turn, rate]) => (
              <div key={turn} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 text-muted-foreground">Tour {turn}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/80" style={{ width: `${rate * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{percent(rate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mana disponible par tour</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {Object.entries(metrics.avg_mana_by_turn).map(([turn, mana]) => (
              <div key={turn} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 text-muted-foreground">Tour {turn}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/80" style={{ width: `${(mana / 10) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{mana}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Main de départ</h2>
          <Badge variant={opening.kept ? "secondary" : "outline"}>
            {opening.mulligans === 0 ? "gardée à 7" : `${opening.mulligans} mulligan(s)`}
          </Badge>
          <Badge variant="outline">{opening.lands_in_hand} terrains</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {opening.hand.map((card, index) => (
            <CardTile key={`${card.scryfall_id}-${index}`} card={card} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Pioches suivantes</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {opening.draws.map((card, index) => (
            <CardTile key={`${card.scryfall_id}-${index}`} card={card} caption={`Tour ${index + 2} — ${card.name}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  )
}
