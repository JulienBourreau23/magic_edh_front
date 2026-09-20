"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import { CardHoverPreview, hoverHandlers, type HoveredCard } from "@/components/CardHoverPreview"
import { DeckExport } from "@/components/DeckExport"
import { deckAnalysis } from "@/lib/deck-sheet"
import { groupIntoSections } from "@/lib/decklist"
import { CARD_TYPES, roleLabel } from "@/lib/mtg-labels"
import {
  buildApi,
  decksApi,
  displayName,
  ROLE_LABELS,
  type BuildEvaluation,
  type BuildPoolCard,
  type Card as MtgCard,
  type DeckFormat,
  type DeckSummary,
  type Matchup,
} from "@/lib/api"

/** Un deck Commander : 100 cartes, commandant compris. */
const DECK_SIZE = 100
const LAND_SLOTS = 36
const BROUILLON = "magic-edh:brouillon"

/** Ce qui vit dans le navigateur tant qu'on n'a pas cliqué « enregistrer ». */
type Draft = {
  format: DeckFormat
  commander: MtgCard | null
  /** scryfall_id -> exemplaires. Le commandant y figure comme les autres. */
  quantities: Record<string, number>
  /** Les cartes posées, pour les afficher sans réinterroger le serveur. */
  cards: Record<string, BuildPoolCard>
}

const VIDE: Draft = { format: "commander", commander: null, quantities: {}, cards: {} }

export default function BuildPage() {
  const [draft, setDraft] = useState<Draft>(VIDE)
  const [commanders, setCommanders] = useState<MtgCard[] | null>(null)
  const [pool, setPool] = useState<BuildPoolCard[] | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<BuildEvaluation | null>(null)
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [comparison, setComparison] = useState<{ deck: string; result: Matchup } | null>(null)
  const [name, setName] = useState("")
  const [saved, setSaved] = useState<{ deck_id: number; name: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Le brouillon survit à un rechargement de page : une heure de construction
  // perdue sur un F5 serait inacceptable. Il ne quitte pas le navigateur pour
  // autant — rien n'est écrit côté serveur sans le bouton.
  useEffect(() => {
    // Relu après le rendu (`.then`) et non pendant : un setState synchrone dans
    // un effet est refusé par le lint, et lire le stockage au premier rendu
    // ferait diverger le HTML du serveur de celui du navigateur.
    Promise.resolve()
      .then(() => window.localStorage.getItem(BROUILLON))
      .then((stored) => {
        if (stored) setDraft(JSON.parse(stored) as Draft)
      })
      .catch(() => {
        // Un brouillon illisible ne doit pas empêcher d'en commencer un autre.
      })
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(BROUILLON, JSON.stringify(draft))
    } catch {
      // Navigation privée, quota plein : la construction continue sans filet.
    }
  }, [draft])

  useEffect(() => {
    buildApi
      .commanders(draft.format)
      .then((response) => setCommanders(response.commanders))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [draft.format])

  useEffect(() => {
    decksApi.list().then(setDecks).catch(() => setDecks([]))
  }, [])

  const commanderOracleId = draft.commander?.oracle_id
  useEffect(() => {
    // Le vivier n'est vidé qu'à l'endroit qui vide le commandant : le faire ici
    // demanderait un setState synchrone dans l'effet.
    if (!commanderOracleId) return
    buildApi
      .pool(commanderOracleId, draft.format)
      .then((response) => setPool(response.cards))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [commanderOracleId, draft.format])

  const entries = useMemo(
    () =>
      Object.entries(draft.quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([scryfallId, quantity]) => ({ card: draft.cards[scryfallId], quantity }))
        .filter((entry) => entry.card),
    [draft]
  )
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const lands = entries
    .filter((entry) => (entry.card.type_line ?? "").includes("Land"))
    .reduce((sum, entry) => sum + entry.quantity, 0)

  // La carte survolée, pour l'aperçu en grand. Elle ne change qu'au passage
  // d'une ligne à l'autre : c'est l'aperçu qui se positionne, la page n'a pas
  // à suivre le curseur.
  const [hovered, setHovered] = useState<HoveredCard | null>(null)

  const payload = useCallback(
    () => ({
      format: draft.format,
      commander_scryfall_id: draft.commander?.scryfall_id ?? null,
      cards: entries.map((entry) => ({
        scryfall_id: entry.card.scryfall_id,
        quantity: entry.quantity,
      })),
    }),
    [draft.format, draft.commander, entries]
  )

  function add(card: BuildPoolCard, quantity = 1) {
    setDraft((current) => ({
      ...current,
      quantities: {
        ...current.quantities,
        [card.scryfall_id]: (current.quantities[card.scryfall_id] ?? 0) + quantity,
      },
      cards: { ...current.cards, [card.scryfall_id]: card },
    }))
    setEvaluation(null)
    setComparison(null)
  }

  function remove(scryfallId: string) {
    setDraft((current) => {
      const quantities = { ...current.quantities }
      const reste = (quantities[scryfallId] ?? 0) - 1
      if (reste > 0) quantities[scryfallId] = reste
      else delete quantities[scryfallId]
      return { ...current, quantities }
    })
    setEvaluation(null)
    setComparison(null)
  }

  function chooseCommander(commander: MtgCard) {
    // Changer de commandant vide le brouillon : l'identité de couleur change,
    // et garder des cartes devenues illégales serait un piège silencieux.
    setDraft({
      format: draft.format,
      commander,
      quantities: { [commander.scryfall_id]: 1 },
      cards: { [commander.scryfall_id]: commander as unknown as BuildPoolCard },
    })
    setEvaluation(null)
    setComparison(null)
    setName(displayName(commander))
  }

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key)
    try {
      await action()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setBusy(null)
    }
  }

  /** Complète la manabase : non-basiques possédés d'abord, puis basiques. */
  async function fillLands() {
    if (!draft.commander) return
    const response = await buildApi.lands(payload(), draft.commander.oracle_id, LAND_SLOTS - lands)
    setDraft((current) => {
      const quantities = { ...current.quantities }
      const cards = { ...current.cards }
      for (const land of response.owned_nonbasic) {
        quantities[land.scryfall_id] = (quantities[land.scryfall_id] ?? 0) + 1
        cards[land.scryfall_id] = land
      }
      for (const basic of response.basics_cards) {
        quantities[basic.scryfall_id] = (quantities[basic.scryfall_id] ?? 0) + basic.quantity
        cards[basic.scryfall_id] = basic
      }
      return { ...current, quantities, cards }
    })
    setEvaluation(null)
  }

  const visible = useMemo(() => {
    if (!pool) return []
    const terme = search.trim().toLowerCase()
    return pool.filter((card) => {
      if (draft.quantities[card.scryfall_id]) return false
      if (typeFilter && !(card.type_line ?? "").includes(typeFilter)) return false
      if (roleFilter && !card.categories.includes(roleFilter)) return false
      if (!terme) return true
      return (
        card.name.toLowerCase().includes(terme) ||
        (card.name_fr ?? "").toLowerCase().includes(terme)
      )
    })
  }, [pool, search, typeFilter, roleFilter, draft.quantities])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Atelier de construction</h1>
        <p className="text-sm text-muted-foreground">
          Le format, puis un commandant pris dans ton classeur, puis les cartes qui peuvent aller
          avec lui : identité de couleur respectée, légalité du format appliquée, et rien qui ne
          soit dans ta collection.{" "}
          <strong>Rien n&apos;est enregistré tant que tu ne cliques pas sur « enregistrer »</strong>{" "}
          — le brouillon vit dans ton navigateur et survit à un rechargement.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Format</span>
          <div className="flex gap-1.5">
            {(["commander", "duel"] as DeckFormat[]).map((format) => (
              <Button
                key={format}
                size="sm"
                variant={draft.format === format ? "secondary" : "outline"}
                onClick={() => setDraft((current) => ({ ...current, format }))}
              >
                {format === "duel" ? "Duel Commander" : "Commander (multi)"}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Le format d&apos;abord : il change la liste des commandants{" "}
          <strong>dans les deux sens</strong> — Edgar Markov est légal en multi et banni en duel,
          Rofellos l&apos;inverse.
        </p>
      </div>

      {!draft.commander ? (
        <CommanderPicker commanders={commanders} onPick={chooseCommander} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="w-20">
              <CardTile card={draft.commander} caption="" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{displayName(draft.commander)}</span>
              <span className="text-xs text-muted-foreground">
                {total}/{DECK_SIZE} cartes · {lands} terrains
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setDraft({ ...VIDE, format: draft.format })
                setPool(null)
              }}
            >
              Changer de commandant (vide le brouillon)
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ce que tu peux poser{" "}
                  <span className="font-normal text-muted-foreground">
                    {visible.length} carte(s)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Input
                  placeholder="Chercher une carte…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {CARD_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      size="sm"
                      variant={typeFilter === type.value ? "secondary" : "ghost"}
                      className="h-6 px-2 text-xs"
                      onClick={() =>
                        setTypeFilter(typeFilter === type.value ? null : type.value)
                      }
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(ROLE_LABELS).map((role) => (
                    <Button
                      key={role}
                      size="sm"
                      variant={roleFilter === role ? "secondary" : "ghost"}
                      className="h-6 px-2 text-xs"
                      onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                    >
                      {roleLabel(role)}
                    </Button>
                  ))}
                </div>
                {/* Classées par ce qu'EDHREC voit jouer derrière ce commandant :
                    l'ordre alphabétique ne dirait rien de ce qui va avec lui. */}
                <ul className="flex max-h-[32rem] flex-col overflow-y-auto text-sm">
                  {visible.slice(0, 200).map((card) => (
                    <li key={card.scryfall_id}>
                      <button
                        type="button"
                        className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                        onClick={() => add(card)}
                        {...hoverHandlers(card, setHovered)}
                      >
                        <span className="flex-1 truncate">{displayName(card)}</span>
                        {card.game_changer && <Badge variant="secondary">GC</Badge>}
                        {card.inclusion_rate != null && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {Math.round(card.inclusion_rate * 100)}%
                          </span>
                        )}
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          ×{card.owned_quantity}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {visible.length > 200 && (
                  <p className="text-xs text-muted-foreground">
                    200 premières affichées — affine la recherche pour voir le reste.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Le deck{" "}
                  <span
                    className={
                      total === DECK_SIZE ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500"
                    }
                  >
                    {total}/{DECK_SIZE}
                  </span>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null || lands >= LAND_SLOTS}
                  onClick={() => run("lands", fillLands)}
                >
                  {busy === "lands" ? "…" : `Compléter la manabase (${lands}/${LAND_SLOTS})`}
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  L&apos;assistance pose d&apos;abord tes terrains non-basiques — ils sont gratuits
                  et meilleurs qu&apos;un basique — puis répartit les basiques au prorata des
                  symboles de mana que le deck demande vraiment, commandant compris.
                </p>
                <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
                  {groupIntoSections(entries.map((entry) => entry.card)).map((section) => (
                    <div key={section.key} className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        {section.label}{" "}
                        {section.cards.reduce(
                          (sum, card) => sum + (draft.quantities[card.scryfall_id] ?? 0),
                          0
                        )}
                      </span>
                      {section.cards.map((card) => (
                        <button
                          key={card.scryfall_id}
                          type="button"
                          className="flex items-baseline gap-2 rounded px-1 text-left text-sm hover:bg-muted"
                          onClick={() => remove(card.scryfall_id)}
                          aria-label={`Retirer ${displayName(card)}`}
                          {...hoverHandlers(card, setHovered)}
                        >
                          <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                            {draft.quantities[card.scryfall_id]}
                          </span>
                          <span className="flex-1 truncate">{displayName(card)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">retirer</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null || entries.length === 0}
              onClick={() => run("eval", async () => setEvaluation(await buildApi.evaluate(payload())))}
            >
              {busy === "eval" ? "Évaluation…" : "Évaluer le deck"}
            </Button>
            {/* L'évaluation est refaite à l'export, jamais lue depuis l'état
                affiché : le brouillon a pu bouger depuis le dernier clic sur
                « Évaluer », et une fiche qui décrirait l'état d'avant serait
                fausse sans rien signaler. */}
            <DeckExport
              deck={{ name: name || "Brouillon", format: draft.format }}
              cards={entries.map((entry) => ({
                ...entry.card,
                quantity: entry.quantity,
                is_commander: entry.card.scryfall_id === draft.commander?.scryfall_id,
              }))}
              loadAnalysis={async () =>
                deckAnalysis(await buildApi.evaluate(payload()), {
                  synergySubject: draft.commander ? displayName(draft.commander) : "le commandant",
                })
              }
              hint={
                <>
                  La fiche reprend le brouillon <strong>tel qu&apos;il est à l&apos;écran</strong>,
                  enregistré ou non, et l&apos;évalue au moment de l&apos;export — mêmes chiffres
                  que le bouton « Évaluer le deck ».
                </>
              }
            />
          </div>

          {evaluation && <Evaluation evaluation={evaluation} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparer à un deck construit</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {decks.map((deck) => (
                  <Button
                    key={deck.id}
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || entries.length === 0}
                    onClick={() =>
                      run(`cmp:${deck.id}`, async () =>
                        setComparison({
                          deck: deck.name,
                          result: await buildApi.compare(payload(), deck.id, name || "Brouillon"),
                        })
                      )
                    }
                  >
                    {busy === `cmp:${deck.id}` ? "…" : deck.name}
                  </Button>
                ))}
                {decks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucun deck actif à confronter — les archivés ne comptent pas.
                  </p>
                )}
              </div>
              {comparison && <Comparison comparison={comparison} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enregistrer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {saved ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    Enregistré :{" "}
                    <Link href={`/decks/${saved.deck_id}`} className="underline underline-offset-2">
                      {saved.name}
                    </Link>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      run("archive", async () => {
                        await decksApi.archive(saved.deck_id, true)
                        setSaved(null)
                        setDraft({ ...VIDE, format: draft.format })
                        setPool(null)
                      })
                    }
                  >
                    {busy === "archive" ? "…" : "Archiver directement"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSaved(null)
                      setDraft({ ...VIDE, format: draft.format })
                      setPool(null)
                    }}
                  >
                    Commencer un autre deck
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs font-medium text-muted-foreground">Nom du deck</span>
                    <Input
                      className="w-64"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <Button
                    disabled={busy !== null || !name.trim() || entries.length === 0}
                    onClick={() =>
                      run("save", async () => setSaved(await buildApi.save(payload(), name.trim())))
                    }
                  >
                    {busy === "save" ? "Enregistrement…" : "Enregistrer ce deck"}
                  </Button>
                  {total !== DECK_SIZE && (
                    <span className="text-xs text-amber-600 dark:text-amber-500">
                      {total} cartes sur {DECK_SIZE} — tu peux enregistrer quand même, la fiche le
                      dira.
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <CardHoverPreview hovered={hovered} />
    </div>
  )
}

/** Le classeur : on prend un commandant comme on le prendrait dans une boîte. */
function CommanderPicker({
  commanders,
  onPick,
}: {
  commanders: MtgCard[] | null
  onPick: (commander: MtgCard) => void
}) {
  const [search, setSearch] = useState("")
  const visible = (commanders ?? []).filter((commander) => {
    const terme = search.trim().toLowerCase()
    if (!terme) return true
    return (
      commander.name.toLowerCase().includes(terme) ||
      (commander.name_fr ?? "").toLowerCase().includes(terme)
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Choisis un commandant{" "}
          <span className="font-normal text-muted-foreground">
            {commanders ? `${visible.length} dans ta collection` : "chargement…"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          placeholder="Chercher un commandant…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {visible.map((commander) => (
            <button
              key={commander.scryfall_id}
              type="button"
              onClick={() => onPick(commander)}
              className="text-left transition-transform hover:scale-[1.03]"
              aria-label={`Construire avec ${displayName(commander)}`}
            >
              <CardTile card={commander} />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Evaluation({ evaluation }: { evaluation: BuildEvaluation }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{evaluation.bracket.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          {evaluation.bracket.floor_reasons.map((reason) => (
            <span key={reason} className="text-foreground">
              {reason}
            </span>
          ))}
          <span>
            {evaluation.counts.total} cartes dont {evaluation.counts.lands} terrains ·{" "}
            {evaluation.total_price_eur.toFixed(2)} €
          </span>
          <span>{evaluation.bracket.note}</span>
          {evaluation.legality_warnings.map((warning, index) => (
            <span key={index} className="text-amber-600 dark:text-amber-500">
              {warning.card} — {warning.issue}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Équilibre des rôles et manabase</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {evaluation.role_diagnostics.map((diagnostic) => (
            <div key={diagnostic.role} className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {ROLE_LABELS[diagnostic.role] ?? diagnostic.role}
              </span>
              <span
                className={
                  diagnostic.status === "ok" ? "" : "text-amber-600 dark:text-amber-500"
                }
              >
                {diagnostic.count} <span className="text-xs">(repère {diagnostic.target})</span>
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between gap-2 text-muted-foreground">
            <span>Terrains</span>
            <span className={evaluation.manabase.lands_ok ? "" : "text-amber-600 dark:text-amber-500"}>
              {evaluation.manabase.land_count} (repère {evaluation.manabase.recommended_lands})
            </span>
          </div>
          {evaluation.manabase.measured_stuck_rate != null && (
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Sorts bloqués par la couleur</span>
              <span>{Math.round(evaluation.manabase.measured_stuck_rate * 100)} %</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Comparison({ comparison }: { comparison: { deck: string; result: Matchup } }) {
  const { result } = comparison
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          duel simulé : {Math.round(result.duel.win_rate_a * 100)} % contre{" "}
          {Math.round(result.duel.win_rate_b * 100)} %
        </Badge>
        <Badge variant="outline">
          axes gagnés {result.wins.a} — {result.wins.b}
        </Badge>
        <span className="text-xs text-muted-foreground">face à {comparison.deck}</span>
      </div>
      <p className="text-sm text-muted-foreground">{result.verdict}</p>
      <p className="text-xs text-muted-foreground">
        Le duel simulé a un biais connu : il est plus à l&apos;aise avec les decks qui gagnent au
        combat ou par un combo identifié qu&apos;avec ceux qui accumulent de petits avantages. Un
        60/40 n&apos;est pas un pronostic.
      </p>
    </div>
  )
}
