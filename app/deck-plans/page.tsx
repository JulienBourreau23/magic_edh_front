"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import {
  deckPlansApi,
  displayName,
  ROLE_LABELS,
  type CommanderComparison,
  type CreatedDecks,
  type DeckPlan,
  type DeckPlansResult,
} from "@/lib/api"
import { downloadShoppingListPdf } from "@/lib/shopping-pdf"
import { WishlistButton } from "@/components/WishlistButton"

const BRACKET_CHOICES = [
  { value: undefined, label: "Automatique" },
  { value: 2, label: "1-2" },
  { value: 3, label: "3" },
  { value: 5, label: "4-5" },
]

export default function DeckPlansPage() {
  const [maxPrice, setMaxPrice] = useState(50)
  const [targetBracket, setTargetBracket] = useState<number | undefined>(undefined)
  const [forced, setForced] = useState<string[]>([])
  // « Sans achat » : quatre decks montables ce soir avec la collection seule.
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [answer, setAnswer] = useState<{ query: string; result: DeckPlansResult } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedDecks | null>(null)
  const [creating, setCreating] = useState(false)

  // Le résultat affiché est dérivé des réglages courants : tant que la réponse
  // ne correspond pas à la question posée, on ne la montre pas. Pas de drapeau
  // « chargement » en état, qui imposerait un setState synchrone dans l'effet.
  const query = `${maxPrice}|${targetBracket ?? ""}|${forced.join(",")}|${ownedOnly}`

  useEffect(() => {
    deckPlansApi
      .build(maxPrice, targetBracket, forced, ownedOnly)
      .then((result) => {
        setAnswer({
          query: `${maxPrice}|${targetBracket ?? ""}|${forced.join(",")}|${ownedOnly}`,
          result,
        })
        // Le plan a changé : le compte rendu de création ne parle plus de lui,
        // et le bouton doit redevenir cliquable.
        setCreated(null)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [maxPrice, targetBracket, forced, ownedOnly])

  const data = answer?.query === query ? answer.result : null
  const loading = data === null && error === null

  function toggleCommander(oracleId: string) {
    setForced((current) =>
      current.includes(oracleId)
        ? current.filter((id) => id !== oracleId)
        : current.length >= (data?.decks_to_build ?? 4)
          ? current
          : [...current, oracleId]
    )
  }

  const selection = data?.selection ?? null

  /**
   * Enregistre les quatre decks. On n'envoie que les commandants : le back
   * recalcule le groupe, ce qui évite de lui faire confiance sur 400 cartes et
   * garde une seule implémentation de la construction.
   */
  async function createDecks() {
    if (!selection) return
    setCreating(true)
    try {
      const response = await deckPlansApi.create(
        selection.plans.map((plan) => plan.commander.oracle_id),
        maxPrice,
        targetBracket,
        ownedOnly
      )
      setCreated(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Monter 4 decks</h1>
        <p className="text-sm text-muted-foreground">
          Pour chaque commandant que tu possèdes, le deck qu&apos;EDHREC monte réellement derrière
          lui, croisé avec ta collection. Les quatre retenus sont d&apos;abord ceux qui tiennent les
          repères de construction, ensuite ceux dont les manques coûtent le moins cher.{" "}
          <strong>Un exemplaire ne peut être que dans un deck à la fois</strong> : quatre decks qui
          réclament la même carte obligent à en racheter trois.
        </p>
        {ownedOnly && (
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Sans achat</strong> : seules les cartes que tu possèdes entrent dans les decks,
            et le vivier s&apos;élargit à toute ta collection jouable dans l&apos;identité du
            commandant — pas seulement à ce qu&apos;EDHREC voit jouer derrière lui. Un noyau peut
            donc rester incomplet : c&apos;est ce que dit ta collection, pas un échec du calcul.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Ce qui entre dans les decks</span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={ownedOnly ? "outline" : "secondary"}
              onClick={() => setOwnedOnly(false)}
            >
              Collection + achats
            </Button>
            <Button
              size="sm"
              variant={ownedOnly ? "secondary" : "outline"}
              onClick={() => setOwnedOnly(true)}
            >
              Sans achat
            </Button>
          </div>
        </div>

        {/* Le plafond ne concerne que les achats : sans achat, il ne dit rien. */}
        {!ownedOnly && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Prix max par carte achetée (€)
            </span>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Bracket visé</span>
          <div className="flex gap-1.5">
            {BRACKET_CHOICES.map((choice) => (
              <Button
                key={choice.label}
                size="sm"
                variant={targetBracket === choice.value ? "secondary" : "outline"}
                onClick={() => setTargetBracket(choice.value)}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </div>

        {forced.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setForced([])}>
            Revenir à la sélection automatique
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data?.error && <p className="text-sm text-amber-600 dark:text-amber-500">{data.error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Calcul en cours...</p>}

      {data && !data.error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Comparaison par commandant ({data.commanders_compared})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Chaque ligne est le deck monté <em>seul</em>, collection entière disponible : c&apos;est
                le seul point de vue où les commandants sont comparables. Dans un groupe, ce que
                coûte l&apos;un dépend des trois autres. Clique pour imposer un commandant
                (4 maximum).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Commandant</th>
                      <th className="py-2 font-medium">Noyau déjà possédé</th>
                      <th className="py-2 text-right font-medium">À acheter</th>
                      <th className="py-2 text-right font-medium">Coût</th>
                      <th className="py-2 text-right font-medium">Rôles</th>
                      <th className="py-2 text-right font-medium">Bracket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commanders.map((plan) => (
                      <CommanderRow
                        key={plan.commander.oracle_id}
                        plan={plan}
                        coreSize={data.core_size}
                        ownedOnly={data.owned_only}
                        selected={forced.includes(plan.commander.oracle_id)}
                        retained={Boolean(
                          selection?.plans.some(
                            (p) => p.commander.oracle_id === plan.commander.oracle_id
                          )
                        )}
                        onToggle={() => toggleCommander(plan.commander.oracle_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selection && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-lg font-semibold">
                  {selection.plans.length} deck(s) retenu(s)
                </h2>
                <Badge variant="outline">Bracket visé : {selection.target_bracket}</Badge>
                <Badge variant={selection.role_gap === 0 ? "outline" : "secondary"}>
                  {selection.role_gap === 0
                    ? "Tous les repères de rôle tenus"
                    : `${selection.role_gap} carte(s) manquante(s) aux repères`}
                </Badge>
                <Badge variant="secondary">
                  {selection.missing_count} carte(s) à acheter · {selection.total_cost_eur.toFixed(2)} €
                </Badge>
                {data.selection_forced && <Badge variant="outline">sélection imposée</Badge>}
                <Button
                  className="ml-auto"
                  disabled={creating || created !== null}
                  onClick={() => {
                    if (confirm(`Créer ${selection.plans.length} deck(s) à partir de ce plan ?`)) {
                      createDecks()
                    }
                  }}
                >
                  {creating ? "Création…" : "Créer ces decks"}
                </Button>
              </div>

              {created && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {created.created.length} deck(s) créé(s)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <ul className="flex flex-col gap-1">
                      {created.created.map((deck) => (
                        <li key={deck.deck_id}>
                          <Link
                            href={`/decks/${deck.deck_id}`}
                            className="underline underline-offset-2"
                          >
                            {deck.name}
                          </Link>{" "}
                          <span className="text-muted-foreground">— {deck.card_count} cartes</span>
                        </li>
                      ))}
                    </ul>
                    {created.skipped.length > 0 && (
                      <p className="text-amber-600 dark:text-amber-500">
                        Ignoré(s), un deck existe déjà pour ce commandant :{" "}
                        {created.skipped.map((deck) => deck.name).join(", ")}. Rien n&apos;a été
                        dupliqué.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Rien n&apos;a été ajouté à la collection : ces cartes y sont déjà, les
                      compter deux fois ferait disparaître des achats pourtant nécessaires.
                    </p>
                    {created.created.length > 0 && (
                      <p>
                        <Link
                          href={`/balance?decks=${created.created.map((d) => d.deck_id).join(",")}`}
                          className="underline underline-offset-2"
                        >
                          Équilibrer ces decks et voir quoi acheter en premier
                        </Link>{" "}
                        <span className="text-muted-foreground">
                          — c&apos;est là que se décident les améliorations, une fois les decks
                          montés.
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {selection.brackets.length > 1 && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Tous les decks n&apos;atteignent pas le même bracket ({selection.brackets.join(" et ")})
                  : certains commandants n&apos;ont pas assez de Game Changers abordables dans leur
                  pool pour monter au bracket visé. C&apos;est un écart de puissance réel, pas un
                  détail d&apos;affichage.
                </p>
              )}

              {data.incomplete && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Moins de {data.decks_to_build} commandants exploitables : seuls{" "}
                  {selection.plans.length} deck(s) ont pu être montés.
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {selection.plans.map((plan) => (
                  <DeckPlanCard
                    key={plan.commander.oracle_id}
                    plan={plan}
                    coreSize={data.core_size}
                    ownedOnly={data.owned_only}
                  />
                ))}
              </div>

              {!data.owned_only && (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Ce qu&apos;il te manque — {selection.shopping_list.length} ligne(s),{" "}
                    {selection.total_cost_eur.toFixed(2)} €
                  </CardTitle>
                  <Button
                    onClick={() =>
                      downloadShoppingListPdf(
                        selection.shopping_list,
                        selection.plans.map((plan) => displayName(plan.commander)),
                        selection.total_cost_eur
                      )
                    }
                    disabled={selection.shopping_list.length === 0}
                  >
                    Exporter en PDF
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Les terrains de base n&apos;y figurent pas : quantité illimitée, coût nul. Une
                    carte réclamée par deux decks compte pour deux exemplaires — le format est
                    singleton, un même exemplaire ne peut pas être dans les deux.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Qté</th>
                          <th className="py-2 font-medium">Carte</th>
                          <th className="py-2 pr-4 text-right font-medium">P.U.</th>
                          <th className="py-2 pr-4 text-right font-medium">Total</th>
                          <th className="py-2 font-medium">Pour</th>
                          <th className="py-2 font-medium sr-only">Liste de recherche</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selection.shopping_list.map((item) => (
                          <tr key={item.oracle_id} className="border-b last:border-0">
                            <td className="py-1.5 pr-4 tabular-nums">{item.quantity}</td>
                            <td className="py-1.5 pr-4">
                              {displayName(item)}
                              <span className="block text-xs text-muted-foreground">{item.motif}</span>
                            </td>
                            <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                              {item.price_eur != null ? `${item.price_eur.toFixed(2)} €` : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right tabular-nums">
                              {item.total_eur.toFixed(2)} €
                            </td>
                            <td className="py-1.5 text-xs text-muted-foreground">
                              {item.decks.join(", ")}
                            </td>
                            <td className="py-1.5 text-right">
                              <WishlistButton
                                card={item}
                                wanted={item.wanted_quantity}
                                note={`À acheter pour ${item.decks.join(", ")}`}
                                onError={setError}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Barre de couverture : la valeur brute reste écrite à côté, rien n'est masqué. */
function CoverageMeter({ owned, total }: { owned: number; total: number }) {
  const percent = total > 0 ? Math.round((owned / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full"
        style={{ background: "var(--grid-line)" }}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {owned}/{total}
      </span>
    </div>
  )
}

function CommanderRow({
  plan,
  coreSize,
  ownedOnly,
  selected,
  retained,
  onToggle,
}: {
  plan: CommanderComparison
  coreSize: number
  ownedOnly: boolean
  selected: boolean
  retained: boolean
  onToggle: () => void
}) {
  return (
    <tr className={`border-b last:border-0 ${retained ? "" : "text-muted-foreground"}`}>
      <td className="py-1.5 pr-4">
        <button type="button" onClick={onToggle} className="text-left hover:underline">
          <span className={retained ? "font-medium text-foreground" : ""}>
            {displayName(plan.commander)}
          </span>
        </button>
        <span className="ml-2 inline-flex gap-1 align-middle">
          {selected && <Badge variant="secondary">imposé</Badge>}
          {retained && !selected && <Badge variant="outline">retenu</Badge>}
          {plan.commander.existing_deck_id && (
            <Link
              href={`/decks/${plan.commander.existing_deck_id}`}
              className="text-xs underline decoration-dotted"
            >
              deck existant
            </Link>
          )}
        </span>
      </td>
      <td className="py-1.5 pr-4">
        <CoverageMeter owned={plan.owned_count} total={coreSize} />
      </td>
      {/* Sans achat, ces deux colonnes valent zéro par construction : un tiret
          dit qu'il n'y a rien à lire, là où « 0 » se lirait comme un résultat. */}
      <td className="py-1.5 text-right tabular-nums">{ownedOnly ? "—" : plan.to_buy_count}</td>
      <td className="py-1.5 text-right tabular-nums">
        {ownedOnly ? "—" : `${plan.cost_eur.toFixed(2)} €`}
      </td>
      <td className="py-1.5 text-right tabular-nums">
        {plan.role_gap === 0 ? (
          "ok"
        ) : (
          <span className="text-amber-600 dark:text-amber-500">−{plan.role_gap}</span>
        )}
      </td>
      <td className="py-1.5 text-right tabular-nums">{plan.bracket.min}</td>
    </tr>
  )
}

function DeckPlanCard({
  plan,
  coreSize,
  ownedOnly,
}: {
  plan: DeckPlan
  coreSize: number
  ownedOnly: boolean
}) {
  const basics = Object.entries(plan.lands.basics)
  const empty = coreSize - plan.core_size
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {displayName(plan.commander)}
          <Badge variant="outline">{plan.bracket.label}</Badge>
          <Badge variant="secondary">{plan.cost_eur.toFixed(2)} €</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <CoverageMeter owned={plan.owned_count} total={coreSize} />

        {ownedOnly && empty > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {empty} créneau(x) vide(s) : ta collection ne contient pas assez de cartes jouables
            dans cette identité de couleur. Le deck se joue tel quel, il est juste plus court.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Équilibre des rôles (repères de construction)
          </span>
          {Object.entries(plan.role_counts).map(([role, count]) => {
            const target = plan.role_targets[role]
            const low = Number(target.split("-")[0])
            return (
              <div key={role} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>
                <span className={count < low ? "text-amber-600 dark:text-amber-500" : ""}>
                  {count} <span className="text-xs text-muted-foreground">(repère {target})</span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Manabase — {plan.lands.total} terrains, aucun achat
          </span>
          {/* En liste, nommés : une énumération à la suite ne se relit pas, et
              le détail des non-basiques possédés est justement ce qui distingue
              deux manabases gratuites. */}
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {plan.lands.owned_nonbasic.map((land) => (
              <li key={land.oracle_id} className="flex gap-2">
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground">1</span>
                <span>{displayName(land)}</span>
              </li>
            ))}
            {basics.map(([name, count]) => (
              <li key={name} className="flex gap-2">
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{count}</span>
                <span className="text-muted-foreground">{name}</span>
              </li>
            ))}
          </ul>
        </div>

        {plan.to_buy.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {`${plan.to_buy_count} carte(s) à acheter — les plus chères d'abord`}
            </span>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {[...plan.to_buy]
                .sort((a, b) => (b.price_eur ?? 0) - (a.price_eur ?? 0))
                .slice(0, 4)
                .map((card) => (
                  <CardTile
                    key={card.scryfall_id}
                    card={card}
                    caption={`${displayName(card)} — ${card.price_eur?.toFixed(2)} €`}
                  />
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
