"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { RankedBars } from "@/components/RankedBars"
import {
  coverageApi,
  displayName,
  type CollectionCoverage,
  type CoverageGroup,
  type MustHaveCard,
} from "@/lib/api"

const PER_PAGE = 24

export default function DashboardPage() {
  const [data, setData] = useState<CollectionCoverage | null>(null)
  const [error, setError] = useState<string | null>(null)
  // `null` = tous les types. Le filtre et la pagination sont l'affaire du
  // navigateur : la réponse tient en une requête, la repayer à chaque clic de
  // page serait du gaspillage.
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    coverageApi
      .get()
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [])

  const groups = data?.groups ?? []
  const shown = typeFilter ? groups.filter((g) => g.key === typeFilter) : groups

  const cards = useMemo(() => {
    // Une carte peut appartenir à plusieurs types (« Artifact Creature ») :
    // sans dédoublonnage, elle compterait deux fois dans la liste parcourue.
    const seen = new Set<string>()
    const flat: { card: MustHaveCard; group: CoverageGroup }[] = []
    for (const group of shown) {
      for (const card of group.cards) {
        if (seen.has(card.oracle_id)) continue
        seen.add(card.oracle_id)
        flat.push({ card, group })
      }
    }
    return flat.sort((x, y) => x.card.edhrec_rank - y.card.edhrec_rank)
  }, [shown])

  const pageCount = Math.max(1, Math.ceil(cards.length / PER_PAGE))
  // La page courante peut sortir des limites quand le filtre réduit la liste :
  // on la borne à l'affichage plutôt que de la corriger dans un effet, que la
  // règle `react-hooks/set-state-in-effect` interdit.
  const current = Math.min(page, pageCount - 1)
  const visible = cards.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  const ownedTotal = groups.reduce((sum, g) => sum + g.owned, 0)
  const listedTotal = groups.reduce((sum, g) => sum + g.listed, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Vue d&apos;ensemble</h1>
        <p className="text-sm text-muted-foreground">
          Où en est la collection face à ce qui se joue réellement en Commander. Le classement est
          celui d&apos;EDHREC, <strong>sans plafond de prix</strong> : la question ici n&apos;est pas
          ce qui est achetable — ça, c&apos;est{" "}
          <Link href="/must-have" className="underline underline-offset-2">
            Cartes à avoir
          </Link>{" "}
          — mais ce qui est couvert.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Cartes distinctes" value={data.stats.distinct_cards.toLocaleString("fr-FR")} />
            <Stat label="Exemplaires" value={data.stats.total_cards.toLocaleString("fr-FR")} />
            <Stat
              label="Valeur estimée"
              value={`${data.stats.total_value_eur.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
              hint="Prix non-foil connus uniquement"
            />
            <Stat
              label="Couverture des classements"
              value={`${ownedTotal} / ${listedTotal}`}
              hint="Tous types confondus"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Couverture du classement, par type</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <RankedBars
                  rows={groups.map((group) => ({
                    key: group.key,
                    label: group.label,
                    value: group.owned,
                    total: group.listed,
                    hint: `${group.label} — ${group.owned} possédées sur les ${group.listed} plus jouées`,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Le dénominateur est la <strong>taille réelle</strong> de chaque classement, pas la
                  cible : les Batailles sont moins de cinquante en tout, et afficher « 0 / 50 »
                  laisserait croire à un manque qui n&apos;existe pas.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cartes possédées, par popularité</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <RankedBars
                  rows={data.rank_distribution.map((band) => ({
                    key: band.label,
                    label: band.label,
                    value: band.cards,
                    hint: `${band.label} — ${band.cards} cartes, ${band.copies} exemplaires`,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Le rang EDHREC est un classement, pas une note : l&apos;écart entre le 1er et le
                  100e n&apos;a rien à voir avec celui entre le 4000e et le 4100e, d&apos;où des
                  tranches de largeur croissante. Les cartes <strong>sans rang</strong> ne sont
                  comptées nulle part — une absence de mesure n&apos;est pas un mauvais score.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Les cartes les plus jouées{" "}
                <span className="font-normal text-muted-foreground">
                  — {cards.length} carte(s){typeFilter ? " de ce type" : ", tous types confondus"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={typeFilter === null ? "default" : "outline"}
                  onClick={() => {
                    setTypeFilter(null)
                    setPage(0)
                  }}
                >
                  Tous
                </Button>
                {groups.map((group) => (
                  <Button
                    key={group.key}
                    size="sm"
                    variant={typeFilter === group.key ? "default" : "outline"}
                    onClick={() => {
                      setTypeFilter(group.key)
                      setPage(0)
                    }}
                  >
                    {group.label}
                    <span className="ml-1.5 text-xs opacity-70">
                      {group.owned}/{group.listed}
                    </span>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {visible.map(({ card }) => (
                  <div
                    key={card.oracle_id}
                    className={`flex flex-col gap-1 ${card.owned === 0 ? "opacity-50" : ""}`}
                  >
                    <CardTile card={card} caption={displayName(card)} />
                    <div className="flex items-baseline justify-between gap-1 text-xs">
                      <span className="tabular-nums text-muted-foreground">n°{card.edhrec_rank}</span>
                      {card.owned > 0 ? (
                        <Badge variant="secondary">
                          {card.owned > 1 ? `×${card.owned}` : "possédée"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">manquante</span>
                      )}
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
                    ← Précédent
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
                    Suivant →
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Les cartes manquantes sont estompées, pas masquées : un classement dont on retire ce
                qu&apos;on n&apos;a pas ne dit plus rien de ce qu&apos;il reste à couvrir. Une carte
                à plusieurs types n&apos;apparaît qu&apos;une fois.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 pt-6">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}
