"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ApiError, decksApi, displayName, ROLE_LABELS, type DeckDetail } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ManaCurveChart } from "@/components/ManaCurveChart"
import { CardTile } from "@/components/CardTile"
import { ColorDonut } from "@/components/ColorDonut"
import { ManabaseAdvice } from "@/components/ManabaseAdvice"
import { DeckToolbar } from "@/components/DeckToolbar"
import { ImportIssuesPanel } from "@/components/ImportIssuesPanel"
import { CombosAndSynergies } from "@/components/CombosAndSynergies"

const STATUS_STYLES: Record<string, string> = {
  ok: "text-muted-foreground",
  insuffisant: "text-amber-600 dark:text-amber-500",
  "excédentaire": "text-amber-600 dark:text-amber-500",
}

export default function DeckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const deckId = Number(id)

  // Composant client et non serveur : le jeton vit dans le navigateur, un
  // rendu serveur n'y aurait pas accès et se ferait renvoyer un 401.
  const [data, setData] = useState<DeckDetail | null>(null)
  const [deckMissing, setDeckMissing] = useState(false)
  // Un id non numérique se déduit du rendu : pas besoin d'un état, et un
  // setState synchrone dans l'effet déclencherait un rendu en cascade.
  const invalidId = !Number.isInteger(deckId)

  // Rechargement explicite, partagé avec les composants qui modifient le deck.
  // `router.refresh()` ne conviendrait pas : il re-rend les composants serveur
  // et préserve l'état client, donc l'effet ci-dessous ne se rejouerait pas et
  // l'écran garderait les anciennes données.
  const load = useCallback(
    () =>
      decksApi
        .get(deckId)
        .then(setData)
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) setDeckMissing(true)
        }),
    [deckId]
  )

  useEffect(() => {
    if (invalidId) return
    load()
  }, [invalidId, load])

  if (invalidId || deckMissing) notFound()
  if (!data) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const { deck, cards, import_issues, mana_curve, total_price_eur, legality_warnings, bracket, manabase, role_diagnostics, synergies } = data
  const commander = cards.find((c) => c.is_commander)
  const expensive = cards.filter((c) => (c.price_eur ?? 0) > 50)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{deck.name}</h1>
          <p className="text-muted-foreground">
            {commander ? displayName(commander) : "Commandant non déterminé"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{total_price_eur.toFixed(2)} €</Badge>
          <Badge variant="outline">{bracket.label}</Badge>
          <Badge variant="outline">{deck.format === "duel" ? "Duel Commander" : "Commander (multi)"}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={`/decks/${deck.id}/simulation`}>Simuler des sorties</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/decks/${deck.id}/suggestions`}>Suggestions d&apos;amélioration</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/matchup?a=${deck.id}`}>Comparer à un autre deck</Link>
        </Button>
      </div>

      <DeckToolbar
        deckId={deck.id}
        name={deck.name}
        format={deck.format}
        hasCommander={Boolean(commander)}
        onChanged={load}
      />

      <ImportIssuesPanel deckId={deck.id} issues={import_issues} onResolved={load} />

      {legality_warnings.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Alertes de légalité / consistance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            {legality_warnings.map((w, i) => (
              <div key={i}>
                <span className="font-medium text-foreground">{w.card}</span> — {w.issue}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{bracket.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            {bracket.floor_reasons.length > 0 && (
              <ul className="flex flex-col gap-1">
                {bracket.floor_reasons.map((reason) => (
                  <li key={reason} className="text-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
            {bracket.mass_land_denial.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p>
                  Destruction de terrains de masse — interdite jusqu&apos;au bracket 3 inclus, donc
                  suffisante à elle seule pour classer le deck en bracket 4 :
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {bracket.mass_land_denial.map((card) => (
                    <li key={card.scryfall_id}>
                      <Badge variant="destructive">{displayName(card)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>{bracket.game_changer_count} carte(s) Game Changer (liste officielle du Commander Format Panel).</p>
            {bracket.game_changers.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {bracket.game_changers.map((gc) => (
                  <li key={gc.scryfall_id}>
                    <Badge variant="secondary">
                      {displayName(gc)}
                      {gc.is_commander ? " (commandant)" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {bracket.two_card_combos.length > 0 && (
              <p>
                {bracket.two_card_combos.length} combo(s) à deux cartes, dont{" "}
                {bracket.winning_combo_count} qui gagne(nt) la partie — détaillés plus bas.
              </p>
            )}
            {bracket.extra_turns.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p>
                  {bracket.extra_turns.length} carte(s) de tour supplémentaire. Le bracket 1 les
                  interdit ; les brackets 2 et 3 ne refusent que de les <em>enchaîner</em>, ce
                  qu&apos;une liste de cartes ne permet pas de constater — à toi de juger.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {bracket.extra_turns.map((card) => (
                    <li key={card.scryfall_id}>
                      <Badge variant="secondary">{displayName(card)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs">
              Sans effet sur le bracket : {bracket.qualitative_signals.tutors} tuteur(s) — le texte
              officiel en parle sans fixer de seuil — et {bracket.qualitative_signals.stax} effet(s)
              stax, qui n&apos;est pas un critère officiel.
            </p>
            <p className="text-xs">{bracket.note}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manabase</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p className={manabase.lands_ok ? "" : STATUS_STYLES.insuffisant}>
              {manabase.land_count} terrains (repère {manabase.recommended_lands})
            </p>
            <ColorDonut colors={manabase.colors} colorlessCards={manabase.colorless_cards} />
            <ManabaseAdvice
              stuckCards={manabase.stuck_cards}
              measuredStuckRate={manabase.measured_stuck_rate}
              strained={manabase.strained_cards}
              strainedTotal={manabase.strained_total}
              basicLands={manabase.basic_lands}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Équilibre des rôles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {role_diagnostics.map((d) => (
              <div key={d.role} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{ROLE_LABELS[d.role] ?? d.role}</span>
                <span className={STATUS_STYLES[d.status]}>
                  {d.count} <span className="text-xs">(repère {d.target})</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courbe de mana</CardTitle>
          </CardHeader>
          <CardContent>
            <ManaCurveChart curve={mana_curve} />
          </CardContent>
        </Card>
      </div>

      <CombosAndSynergies
        combos={bracket.two_card_combos}
        synergies={synergies}
        subject={commander ? displayName(commander) : "le commandant"}
      />

      {expensive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cartes les plus chères de ce deck</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="mb-1 text-xs">
              Purement informatif — ce sont des cartes que tu possèdes déjà. Le plafond de 50 €
              s&apos;applique aux suggestions d&apos;achat, pas au deck existant.
            </p>
            {expensive.map((c) => (
              <div key={c.scryfall_id}>
                <span className="font-medium text-foreground">{displayName(c)}</span> — {c.price_eur?.toFixed(2)} €
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cartes ({cards.length})</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {cards.map((c) => (
            <CardTile key={c.scryfall_id} card={c} />
          ))}
        </div>
      </div>
    </div>
  )
}
