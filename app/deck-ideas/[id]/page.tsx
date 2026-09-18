"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { CombosAndSynergies } from "@/components/CombosAndSynergies"
import { DeckExport } from "@/components/DeckExport"
import { WishlistButton } from "@/components/WishlistButton"
import { generatedDeckCards } from "@/lib/deck-pdf"
import {
  deckIdeasApi,
  displayName,
  ROLE_LABELS,
  type DeckIdeaCard,
  type DeckIdeaCoreCard,
  type DeckIdeaDetail,
} from "@/lib/api"

/** Une ligne du deck en construction : la carte proposée, ou son remplaçant. */
type Slot = {
  proposed: DeckIdeaCoreCard
  /** Non nul quand le créneau a été remplacé par une carte possédée. */
  replacement: DeckIdeaCard | null
}

/** Le rôle principal d'une carte, celui sur lequel on cherche un équivalent. */
function mainRole(card: DeckIdeaCard): string | null {
  return card.categories.find((role) => role in ROLE_LABELS) ?? null
}

export default function DeckIdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [data, setData] = useState<DeckIdeaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])

  useEffect(() => {
    deckIdeasApi
      .detail(id)
      .then((response) => {
        setData(response)
        setSlots(response.core.map((proposed) => ({ proposed, replacement: null })))
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [id])

  // Ce qui est déjà pris, remplaçants compris : un même exemplaire ne peut pas
  // occuper deux créneaux, c'est la règle physique du projet.
  const used = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of slots) {
      ids.add((slot.replacement ?? slot.proposed).oracle_id)
    }
    return ids
  }, [slots])

  const available = useMemo(
    () => (data?.substitutes ?? []).filter((card) => !used.has(card.oracle_id)),
    [data, used]
  )

  /**
   * Le meilleur remplaçant disponible : d'abord le même rôle, puis le plus
   * joué. Sans la contrainte de rôle, échanger un removal contre un rocher de
   * mana dépannerait le budget en déséquilibrant le deck.
   */
  function bestSubstitute(card: DeckIdeaCoreCard): DeckIdeaCard | null {
    const role = mainRole(card)
    const sameRole = role ? available.filter((c) => c.categories.includes(role)) : []
    return (sameRole[0] ?? available[0]) ?? null
  }

  function replace(index: number) {
    setSlots((current) => {
      const slot = current[index]
      const pick = bestSubstitute(slot.proposed)
      if (!pick) return current
      const next = [...current]
      next[index] = { ...slot, replacement: pick }
      return next
    })
  }

  function restore(index: number) {
    setSlots((current) => {
      const next = [...current]
      next[index] = { ...next[index], replacement: null }
      return next
    })
  }

  const toBuy = slots.filter((s) => !s.proposed.owned && !s.replacement)
  const replaced = slots.filter((s) => s.replacement)
  const cost = toBuy.reduce((sum, s) => sum + (s.proposed.price_eur ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {data ? displayName(data.commander) : "Chargement…"}
          </h1>
          <p className="text-sm text-muted-foreground">
            La liste que les joueurs d&apos;EDHREC montent réellement avec ce commandant. Remplace
            ce que tu ne veux pas acheter par une carte que tu as déjà :{" "}
            <strong>le deck perdra en puissance mais sera jouable ce soir</strong>, ce qui suffit
            pour essayer l&apos;archétype avant de dépenser.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/deck-ideas">Retour aux idées</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Noyau proposé" value={`${slots.length} cartes`} />
            <Stat label="Déjà en collection" value={`${slots.filter((s) => s.proposed.owned).length}`} />
            <Stat label="Remplacées" value={`${replaced.length}`} />
            <Stat
              label="Reste à acheter"
              value={`${toBuy.length} · ${cost.toFixed(2)} €`}
              hint={available.length === 0 ? "Plus aucun remplaçant disponible" : undefined}
            />
          </div>

          {/* Pas de feuille de tournoi ici : cette liste n'a pas de manabase, et
              l'exporter comme une decklist officielle serait un piège. Ce qui
              part au PDF est l'état courant de l'écran, remplacements compris. */}
          <DeckExport
            deck={{
              name: `${displayName(data.commander)} — idée de deck`,
              format: "commander",
              note: `Brouillon EDHREC : ${slots.length} non-terrains, les ${99 - slots.length} terrains restent à compléter en basiques.`,
            }}
            cards={generatedDeckCards({
              commander: data.commander,
              cards: slots.map((slot) => slot.replacement ?? slot.proposed),
            })}
            modes={["names", "images"]}
            hint={
              <>
                Le PDF reprend la liste <strong>telle qu&apos;elle est à l&apos;écran</strong>,
                remplacements compris. Pas de feuille de tournoi : il manque les{" "}
                {99 - slots.length} terrains, et une liste incomplète ne se présente pas à un
                arbitre.
              </>
            }
          />

          {data.existing_deck_id && (
            <p className="text-sm text-muted-foreground">
              Ce commandant a déjà un deck monté —{" "}
              <Link href={`/decks/${data.existing_deck_id}`} className="underline underline-offset-2">
                voir la fiche
              </Link>
              .
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Le noyau{" "}
                <span className="font-normal text-muted-foreground">
                  — {data.nonland_core} non-terrains ; les {99 - data.nonland_core} terrains se
                  complètent en basiques, sans rien acheter
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {slots.map((slot, index) => {
                const shown = slot.replacement ?? slot.proposed
                const owned = slot.replacement !== null || slot.proposed.owned
                return (
                  <div key={slot.proposed.oracle_id} className="flex flex-col gap-1">
                    <CardTile card={shown} caption={displayName(shown)} />

                    <div className="flex items-baseline justify-between gap-1 text-xs">
                      {owned ? (
                        <Badge variant="secondary">en collection</Badge>
                      ) : (
                        <span className="tabular-nums text-muted-foreground">
                          {slot.proposed.price_eur?.toFixed(2)} €
                        </span>
                      )}
                    </div>

                    {slot.replacement ? (
                      <div className="flex flex-col gap-1">
                        <span className="truncate text-[11px] text-muted-foreground">
                          remplace {displayName(slot.proposed)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-xs"
                          onClick={() => restore(index)}
                        >
                          annuler
                        </Button>
                      </div>
                    ) : (
                      !slot.proposed.owned && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1 text-xs"
                            disabled={bestSubstitute(slot.proposed) === null}
                            onClick={() => replace(index)}
                            aria-label={`Remplacer ${displayName(slot.proposed)} par une carte possédée`}
                          >
                            remplacer
                          </Button>
                          <WishlistButton
                            card={slot.proposed}
                            wanted={slot.proposed.wanted_quantity}
                            note={`Conseillée pour ${displayName(data.commander)}`}
                            className="h-6 px-1 text-xs"
                            onError={setError}
                          />
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <CombosAndSynergies
            combos={data.combos}
            synergies={data.synergies}
            subject={displayName(data.commander)}
          />

          <p className="text-xs text-muted-foreground">
            Le remplaçant est choisi <strong>du même rôle</strong> quand c&apos;en existe un —
            échanger un removal contre un rocher de mana dépannerait le budget en déséquilibrant le
            deck. Un même exemplaire ne peut occuper qu&apos;un créneau : une carte déjà employée ne
            ressort pas ailleurs. Rien n&apos;est enregistré — cette page est un brouillon, elle ne
            crée ni deck ni achat.
          </p>
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
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}
