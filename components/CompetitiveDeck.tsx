"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTile } from "@/components/CardTile"
import { displayName, type CompetitiveBuild } from "@/lib/api"
import { groupIntoSections } from "@/lib/decklist"
import { DeckExport } from "@/components/DeckExport"
import { WishlistButton } from "@/components/WishlistButton"
import { generatedDeckCards } from "@/lib/deck-pdf"

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
  const sections = groupIntoSections(build.cards)

  // Le deck compétitif est une decklist complète — commandant, sorts et
  // manabase — donc les trois exports ont un sens, feuille de tournoi comprise.
  const pdfCards = generatedDeckCards({
    commander: build.commander,
    cards: [...build.cards, ...build.lands.nonbasic],
    basics: build.lands.basics,
  })

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

      <DeckExport
        deck={{
          name: `${displayName(build.commander)} — ${build.theme.label}`,
          format: build.format,
        }}
        cards={pdfCards}
        hint={
          <>
            Le deck n&apos;est pas enregistré : ces PDF sont la seule trace qu&apos;il en reste.
            Les terrains de base y figurent par leur compte, sans visuel —{" "}
            <strong>aucune édition n&apos;a été choisie pour eux</strong>, seul leur nombre est
            calculé.
          </>
        }
      />

      <Curve build={build} />

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ key, label, cards }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium">
              {label}{" "}
              <span className="text-muted-foreground">
                {cards.length}
                {build.type_targets[key] != null && ` / ${build.type_targets[key]} visé(s)`}
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
        {showImages && build.lands.nonbasic.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {build.lands.nonbasic.map((land) => (
              <CardTile key={land.oracle_id} card={land} caption={displayName(land)} />
            ))}
          </div>
        )}
        {/* En liste comme les autres sections : une énumération à la suite se
            relit mal, et les terrains de base ont une quantité à lire. Les
            basiques n'ont pas de visuel ici — ils n'ont pas d'impression
            choisie, seulement un nom et un compte. */}
        <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
          {(!showImages ? build.lands.nonbasic : []).map((land) => (
            <li key={land.oracle_id} className="flex gap-2">
              <span className="w-5 shrink-0 tabular-nums text-muted-foreground">1</span>
              <span>{displayName(land)}</span>
            </li>
          ))}
          {Object.entries(build.lands.basics).map(([name, count]) => (
            <li key={name} className="flex gap-2">
              <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{count}</span>
              <span>{name}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Les terrains de base complètent la manabase au prorata des symboles de mana demandés. Les
          non-basiques qui vaudraient mieux figurent dans les achats ci-dessous : sur un deck de
          compétition unique, la manabase est souvent le premier poste qui manque.
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
                <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  {Math.round(item.buy.theme_rate * 100)}% contre{" "}
                  {Math.round(item.replace.theme_rate * 100)}%
                  <WishlistButton
                    card={item.buy}
                    wanted={item.buy.wanted_quantity}
                    note={`Achat utile pour ${displayName(build.commander)} — ${build.theme.label}`}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Le pourcentage est la part des decks de l&apos;archétype qui jouent la carte : un achat
            n&apos;est proposé que s&apos;il est plus joué que celle qu&apos;il remplace. Le plafond
            de 50 € s&apos;applique <strong>par carte</strong>. Les terrains sont inclus : ils
            évincent d&apos;abord un terrain de base, puis les non-basiques les moins joués.
          </p>
        </div>
      )}
    </div>
  )
}
