"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTile } from "@/components/CardTile"
import { displayName, type CompetitiveBuild, type CompetitiveCard } from "@/lib/api"

const TYPE_LABELS: Record<string, string> = {
  Creature: "Créatures",
  Instant: "Éphémères",
  Sorcery: "Rituels",
  Artifact: "Artefacts",
  Enchantment: "Enchantements",
  Planeswalker: "Planeswalkers",
  Battle: "Batailles",
}

function typeOf(card: CompetitiveCard): string {
  const line = card.type_line ?? ""
  return Object.keys(TYPE_LABELS).find((type) => line.includes(type)) ?? "Autre"
}

/**
 * Courbe obtenue face à la courbe visée. Les deux barres partagent la même
 * échelle — c'est une seule grandeur (un nombre de cartes), donc les comparer
 * directement est légitime, contrairement aux axes de la page de comparaison.
 */
function Curve({ build }: { build: CompetitiveBuild }) {
  const buckets = [...new Set([
    ...Object.keys(build.curve.target),
    ...Object.keys(build.curve.achieved),
  ])].sort((a, b) => Number(a) - Number(b))
  const max = Math.max(
    1,
    ...buckets.map((b) => Math.max(build.curve.target[b] ?? 0, build.curve.achieved[b] ?? 0))
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        {buckets.map((bucket) => {
          const target = build.curve.target[bucket] ?? 0
          const achieved = build.curve.achieved[bucket] ?? 0
          return (
            <div key={bucket} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 rounded-t bg-muted-foreground/30"
                  style={{ height: `${(target / max) * 100}%` }}
                  title={`visé : ${target}`}
                />
                <div
                  className="w-1/2 rounded-t bg-primary"
                  style={{ height: `${(achieved / max) * 100}%` }}
                  title={`obtenu : ${achieved}`}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {bucket === "7" ? "7+" : bucket}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Gris : la courbe des decks réels de l&apos;archétype. Couleur : celle obtenue avec ta
        collection.
      </p>
    </div>
  )
}

export function CompetitiveDeck({ build }: { build: CompetitiveBuild }) {
  const [showImages, setShowImages] = useState(false)
  const grouped = new Map<string, CompetitiveCard[]>()
  for (const card of build.cards) {
    const type = typeOf(card)
    grouped.set(type, [...(grouped.get(type) ?? []), card])
  }

  const upgradeCost = build.upgrades.reduce((sum, item) => sum + item.price_eur, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={build.counts.total === 100 ? "secondary" : "destructive"}>
          {build.counts.total} cartes
        </Badge>
        <Badge variant="secondary">{build.counts.lands} terrains</Badge>
        <Badge variant="outline">
          {build.format === "duel" ? "Duel Commander" : "Multijoueur"} — banlist appliquée
        </Badge>
        <Badge variant="outline">vivier de {build.pool_size} cartes légales</Badge>
        <Button size="sm" variant="ghost" onClick={() => setShowImages((value) => !value)}>
          {showImages ? "Voir en liste" : "Voir les visuels"}
        </Button>
      </div>

      <Curve build={build} />

      <div className="grid gap-4 md:grid-cols-2">
        {[...grouped.entries()].map(([type, cards]) => (
          <div key={type} className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium">
              {TYPE_LABELS[type] ?? type}{" "}
              <span className="text-muted-foreground">
                {cards.length}
                {build.type_targets[type] != null && ` / ${build.type_targets[type]} visé(s)`}
              </span>
            </h3>
            {showImages ? (
              <div className="grid grid-cols-3 gap-2">
                {cards.map((card) => (
                  <CardTile key={card.oracle_id} card={card} caption={displayName(card)} />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col text-sm">
                {cards.map((card) => (
                  <li key={card.oracle_id} className="flex justify-between gap-2">
                    <span>{displayName(card)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {Math.round(card.theme_rate * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">
          Terrains <span className="text-muted-foreground">{build.lands.total}</span>
        </h3>
        <p className="text-sm">
          {build.lands.nonbasic.map((land) => displayName(land)).join(", ")}
          {build.lands.nonbasic.length > 0 && Object.keys(build.lands.basics).length > 0 && " · "}
          {Object.entries(build.lands.basics)
            .map(([name, count]) => `${count} ${name}`)
            .join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          Aucun terrain n&apos;est acheté : une manabase achetée coûte vite plus cher que le reste du
          deck, et des terrains de base font le travail.
        </p>
      </div>

      {build.upgrades.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">
            Achats utiles{" "}
            <span className="text-muted-foreground">
              {build.upgrades.length} cartes, {upgradeCost.toFixed(2)} € au total
            </span>
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {build.upgrades.map((item) => (
              <li key={item.buy.oracle_id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{displayName(item.buy)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.price_eur.toFixed(2)} €
                </span>
                <span className="text-xs text-muted-foreground">
                  → une fois acheté, retire {displayName(item.replace)}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {Math.round(item.buy.theme_rate * 100)}% contre{" "}
                  {Math.round(item.replace.theme_rate * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Le pourcentage est la part des decks de l&apos;archétype qui jouent la carte : un achat
            n&apos;est proposé que s&apos;il est plus joué que celle qu&apos;il remplace.
          </p>
        </div>
      )}
    </div>
  )
}
