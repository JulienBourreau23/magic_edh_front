"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import {
  collectionApi,
  displayName,
  mustHaveApi,
  wishlistApi,
  type DeckFormat,
  type MustHave,
  type MustHaveCard,
  type MustHaveGroup,
} from "@/lib/api"

type View = "visuels" | "liste"
type Destination = "collection" | "wishlist"

export default function MustHavePage() {
  const [format, setFormat] = useState<DeckFormat>("commander")
  const [maxPrice, setMaxPrice] = useState(50)
  // Les visuels par défaut : sur une liste d'achats, beaucoup de ces cartes
  // sont inconnues, et une illustration les fait reconnaître plus vite qu'un
  // nom. Le tableau reste à un clic pour comparer des prix.
  const [view, setView] = useState<View>("visuels")
  const [data, setData] = useState<MustHave | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Clés `oracle_id:destination` en cours d'envoi : c'est ce qui empêche un
  // double-clic de demander deux exemplaires, les quantités s'additionnant en
  // base.
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    mustHaveApi
      .list(format, maxPrice)
      .then((response) => {
        setData(response)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [format, maxPrice])

  /**
   * Ajout d'un exemplaire, puis mise à jour locale plutôt que rechargement :
   * la page fait seize requêtes SQL, la recharger à chaque clic rendrait la
   * saisie pénible alors qu'on ajoute des cartes à la chaîne.
   *
   * La mise à jour parcourt **tous** les groupes : une même carte peut figurer
   * dans plusieurs types (un « Artifact Creature » est dans les deux), et
   * n'en marquer qu'un laisserait l'autre affirmer le contraire.
   */
  async function add(card: MustHaveCard, destination: Destination) {
    const key = `${card.oracle_id}:${destination}`
    setPending((p) => new Set(p).add(key))
    try {
      if (destination === "collection") {
        await collectionApi.add(card.scryfall_id)
      } else {
        await wishlistApi.add(card.scryfall_id, 1, "Ajoutée depuis les cartes à avoir")
      }
      setData((prev) =>
        prev && {
          ...prev,
          groups: prev.groups.map((group) => ({
            ...group,
            cards: group.cards.map((c) =>
              c.oracle_id === card.oracle_id
                ? {
                    ...c,
                    owned: destination === "collection" ? c.owned + 1 : c.owned,
                    wanted: destination === "wishlist" ? c.wanted + 1 : c.wanted,
                  }
                : c
            ),
          })),
        }
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartes à avoir</h1>
        <p className="text-sm text-muted-foreground">
          Les cartes les plus jouées de chaque type — par popularité EDHREC en multijoueur, par
          présence dans les tops de tournoi en duel. Ce n&apos;est
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Affichage</span>
          {(["visuels", "liste"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={view === value ? "default" : "outline"}
              onClick={() => setView(value)}
            >
              {value === "visuels" ? "Visuels" : "Liste"}
            </Button>
          ))}
        </div>
      </div>

      {format === "duel" && data?.source === "mtgtop8" && data.duel_meta && (
        <p className="text-sm text-muted-foreground">
          En duel, le classement ne suit <strong>pas</strong> EDHREC, qui mesure le multijoueur :
          il suit la part des <strong>tops de tournoi de Duel Commander</strong> relevés sur
          MTGTop8 qui jouent la carte — {data.duel_meta.decks.toLocaleString("fr-FR")} decks
          {data.duel_meta.since && <> depuis le {formatDate(data.duel_meta.since)}</>}. Ce qui gagne
          en face à face n&apos;est pas ce qui se joue à quatre.
        </p>
      )}
      {format === "duel" && data?.source === "edhrec" && (
        <p className="text-sm text-muted-foreground">
          Le méta du duel n&apos;est pas encore synchronisé (<code>scripts/sync_mtgtop8.py</code>) :
          ce classement est celui d&apos;EDHREC, donc du <strong>multijoueur</strong>, limité à la
          banlist du duel. Sol Ring et Ancient Tomb en sortent, mais l&apos;ordre reste celui
          d&apos;un autre format.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.groups.map((group) => (
        <TypeSection
          key={group.key}
          group={group}
          maxPrice={data.max_price_eur}
          view={view}
          onAdd={add}
          pending={pending}
        />
      ))}
    </div>
  )
}

/** Les deux gestes possibles sur une carte de la liste. */
function AddButtons({
  card,
  onAdd,
  pending,
}: {
  card: MustHaveCard
  onAdd: (card: MustHaveCard, destination: Destination) => void
  pending: Set<string>
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        disabled={pending.has(`${card.oracle_id}:collection`)}
        onClick={() => onAdd(card, "collection")}
        aria-label={`Ajouter ${displayName(card)} à la collection`}
      >
        + collection
      </Button>
      {/* Une carte déjà cherchée ne se redemande pas : les quantités de la
          liste de recherche s'additionnent, un second clic en réclamerait un
          second exemplaire sans rien dire. Le compte vient du serveur, puis de
          la mise à jour locale — le bouton bascule dès le premier ajout. */}
      <Button
        size="sm"
        variant={card.wanted > 0 ? "ghost" : "outline"}
        className="h-6 px-2 text-xs"
        disabled={card.wanted > 0 || pending.has(`${card.oracle_id}:wishlist`)}
        onClick={() => onAdd(card, "wishlist")}
        aria-label={
          card.wanted > 0
            ? `${displayName(card)} est déjà dans la liste de recherche`
            : `Ajouter ${displayName(card)} à la liste de recherche`
        }
      >
        {card.wanted > 0 ? "déjà cherchée" : "+ recherche"}
      </Button>
    </div>
  )
}

/** Prix à payer, ou l'état de la carte quand il n'y a rien à payer. */
/**
 * Ce qui classe la carte. En duel, la part des tops de tournoi qui la jouent :
 * un rang EDHREC y serait un rang de multijoueur.
 */
function Popularity({ card }: { card: MustHaveCard }) {
  if (card.duel_share !== undefined) {
    return (
      <span title={`${card.duel_decks} decks de tops de duel la jouent`}>
        {Math.round(card.duel_share * 100)} % des tops
      </span>
    )
  }
  return <>n°{card.edhrec_rank}</>
}

/** « 2026-03-28 » → « 28/03/2026 ». */
function formatDate(iso: string) {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

function Price({ card }: { card: MustHaveCard }) {
  if (card.owned > 0) {
    return (
      <Badge variant="secondary">
        en collection{card.owned > 1 ? ` ×${card.owned}` : ""}
      </Badge>
    )
  }
  if (card.wanted > 0) {
    return (
      <Badge variant="outline">
        recherchée{card.wanted > 1 ? ` ×${card.wanted}` : ""} —{" "}
        {Number(card.price_eur).toFixed(2)} €
      </Badge>
    )
  }
  return <span className="tabular-nums">{Number(card.price_eur).toFixed(2)} €</span>
}

function TypeSection({
  group,
  maxPrice,
  view,
  onAdd,
  pending,
}: {
  group: MustHaveGroup
  maxPrice: number
  view: View
  onAdd: (card: MustHaveCard, destination: Destination) => void
  pending: Set<string>
}) {
  if (group.cards.length === 0) return null

  // Recomptés ici et non lus depuis la réponse : un ajout met la liste à jour
  // localement, et les compteurs du serveur seraient aussitôt périmés.
  const owned = group.cards.filter((c) => c.owned > 0).length
  const toBuy = group.cards.length - owned

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {group.label}{" "}
          <span className="font-normal text-muted-foreground">
            — {owned} en collection, {toBuy} à acheter
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {view === "visuels" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {group.cards.map((card) => (
              // Les cartes déjà possédées sont estompées plutôt que retirées :
              // leur place dans le classement reste une information.
              <div
                key={card.oracle_id}
                className={`flex flex-col gap-1 ${card.owned > 0 ? "opacity-60" : ""}`}
              >
                <CardTile card={card} caption={displayName(card)} />
                <div className="flex items-baseline justify-between gap-1 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    <Popularity card={card} />
                  </span>
                  <Price card={card} />
                </div>
                <AddButtons card={card} onAdd={onAdd} pending={pending} />
              </div>
            ))}
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-16 py-1.5 font-medium">
                {group.cards[0]?.duel_share !== undefined ? "Tops" : "Rang"}
              </th>
              <th className="py-1.5 font-medium">Carte</th>
              <th className="w-28 py-1.5 font-medium">Coût</th>
              <th className="w-44 py-1.5 text-right font-medium">Prix</th>
              <th className="w-56 py-1.5 text-right font-medium">Ajouter à</th>
            </tr>
          </thead>
          <tbody>
            {group.cards.map((card) => (
              <tr
                key={card.oracle_id}
                className={`border-b last:border-0 ${card.owned > 0 ? "text-muted-foreground" : ""}`}
              >
                <td className="py-1.5 tabular-nums">
                  <Popularity card={card} />
                </td>
                <td className="py-1.5">
                  <span className={card.owned > 0 ? "" : "font-medium text-foreground"}>
                    {displayName(card)}
                  </span>
                </td>
                <td className="py-1.5 font-mono text-xs">{card.mana_cost}</td>
                <td className="py-1.5 text-right">
                  <Price card={card} />
                </td>
                <td className="py-1.5">
                  <div className="flex justify-end">
                    <AddButtons card={card} onAdd={onAdd} pending={pending} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

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
