"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CardTile } from "@/components/CardTile"
import {
  displayName,
  rulesApi,
  type CompetitiveFormat,
  type RuleCard,
  type RulesResponse,
} from "@/lib/api"

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

const FORMATS: { value: CompetitiveFormat; label: string }[] = [
  { value: "commander", label: "Multijoueur" },
  { value: "duel", label: "Duel Commander" },
]

type Onglet = "banlist" | "brackets" | "game-changers"

const ONGLETS: { value: Onglet; label: string }[] = [
  { value: "banlist", label: "Banlists" },
  { value: "brackets", label: "Brackets" },
  { value: "game-changers", label: "Game Changers" },
]

/**
 * Le tri suit le **nom affiché**, pas le nom anglais que renvoie le serveur.
 * Une banlist se parcourt pour y chercher un nom : classée sur l'anglais mais
 * écrite en français, elle donne « Amulette saugrenue, Balance, Tablette de
 * bronze, Chaos Orb… », c'est-à-dire un ordre qui n'en est pas un.
 */
function parNomAffiche(cards: RuleCard[]): RuleCard[] {
  return [...cards].sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"))
}

function matches(card: RuleCard, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    card.name.toLowerCase().includes(needle) ||
    (card.name_fr ?? "").toLowerCase().includes(needle)
  )
}

/** Une carte en ligne : le format de lecture d'une banlist, qu'on parcourt
 *  pour y chercher un nom et non pour comparer des prix. */
function Ligne({ card, note }: { card: RuleCard; note?: React.ReactNode }) {
  return (
    <li className="flex break-inside-avoid items-baseline gap-2 border-b py-1 text-sm last:border-0">
      <span className="truncate" title={card.type_line ?? undefined}>
        {displayName(card)}
      </span>
      {card.owned_quantity > 0 && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          tu la possèdes
        </Badge>
      )}
      {note}
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {card.price_eur === null ? "—" : EURO.format(card.price_eur)}
      </span>
    </li>
  )
}

function Grille({ cards }: { cards: RuleCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.oracle_id} className="flex flex-col gap-1">
          <CardTile card={card} caption={displayName(card)} />
          {card.owned_quantity > 0 && (
            <Badge variant="secondary" className="w-fit text-[10px]">
              tu la possèdes
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ReglesPage() {
  const [data, setData] = useState<RulesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>("banlist")
  const [format, setFormat] = useState<CompetitiveFormat>("commander")
  const [query, setQuery] = useState("")
  const [visuels, setVisuels] = useState(false)
  const [horsTournoi, setHorsTournoi] = useState(false)

  useEffect(() => {
    rulesApi
      .get()
      .then((response) => {
        setData(response)
        setError(response.error)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [])

  const banlist = data?.banlists[format]
  const filtrees = useMemo(
    () => parNomAffiche(banlist?.cards ?? []).filter((card) => matches(card, query)),
    [banlist, query]
  )
  const gameChangers = useMemo(
    () => parNomAffiche(data?.game_changers ?? []).filter((card) => matches(card, query)),
    [data, query]
  )

  const autre: CompetitiveFormat = format === "commander" ? "duel" : "commander"
  const autreLabel = autre === "duel" ? "duel" : "multijoueur"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Les règles du format</h1>
        <p className="text-sm text-muted-foreground">
          Ce qu&apos;on subit plutôt que ce qu&apos;on choisit : les deux banlists, le système de
          brackets, et la liste officielle des Game Changers. Tout vient de Scryfall et se
          rafraîchit avec la synchronisation mensuelle des cartes —{" "}
          <strong>aucune liste n&apos;est tenue à la main ici</strong>, et il n&apos;y a donc rien à
          mettre à jour quand le Commander Format Panel publie une annonce.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Chargement...</p>}

      <div className="flex flex-wrap items-center gap-2">
        {ONGLETS.map((entry) => (
          <Button
            key={entry.value}
            size="sm"
            variant={onglet === entry.value ? "default" : "outline"}
            onClick={() => setOnglet(entry.value)}
          >
            {entry.label}
          </Button>
        ))}
        {onglet !== "brackets" && (
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher une carte"
              className="w-56"
            />
            <Button size="sm" variant="ghost" onClick={() => setVisuels((v) => !v)}>
              {visuels ? "Voir en liste" : "Voir les visuels"}
            </Button>
          </>
        )}
      </div>

      {data && onglet === "banlist" && banlist && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {FORMATS.map((entry) => (
              <Button
                key={entry.value}
                size="sm"
                variant={format === entry.value ? "default" : "outline"}
                onClick={() => setFormat(entry.value)}
              >
                {entry.label}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">
              {filtrees.length} / {banlist.cards.length} cartes bannies
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Banlist {format === "commander" ? "multijoueur" : "Duel Commander"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Les deux banlists ne se déduisent pas l&apos;une de l&apos;autre : le duel est plus
                strict dans l&apos;ensemble, mais il <strong>autorise</strong>{" "}des cartes que le
                multijoueur bannit — Dockside Extortionist, Griselbrand, Leovold. Les cartes
                marquées ci-dessous sont celles dont le statut change d&apos;un format à
                l&apos;autre.
              </p>
              {visuels ? (
                <Grille cards={filtrees} />
              ) : (
                <ul className="gap-x-8 lg:columns-2">
                  {filtrees.map((card) => (
                    <Ligne
                      key={card.oracle_id}
                      card={card}
                      note={
                        (autre === "duel" ? !card.banned_duel : !card.banned_commander) ? (
                          <Badge variant="outline" className="text-[10px]">
                            légale en {autreLabel}
                          </Badge>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.banned_as_commander[format].length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Interdites comme commandant seulement —{" "}
                  {data.banned_as_commander[format].length} cartes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  <strong>Ce n&apos;est pas la même chose qu&apos;être bannie.</strong> Ces cartes
                  restent parfaitement jouables dans les 99 — seule la zone de commandement leur
                  est fermée. Le multijoueur n&apos;a aucun équivalent.
                </p>
                <ul className="gap-x-8 lg:columns-2">
                  {parNomAffiche(data.banned_as_commander[format]).map((card) => (
                    <Ligne key={card.oracle_id} card={card} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Et {banlist.outside_tournament.length} cartes qui ne sont pas des cartes de
                tournoi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Scryfall les marque bannies comme les autres, mais personne ne les cherche dans
                une banlist : des Conspiracies (jouées depuis l&apos;extérieur du deck, en draft),
                les Stickers d&apos;Unfinity, et les éditions hors tournoi. Les compter avec le
                reste ferait annoncer{" "}
                <strong>
                  {banlist.cards.length + banlist.outside_tournament.length} cartes bannies
                </strong>{" "}
                au lieu de {banlist.cards.length}. Elles sont donc à part plutôt que cachées.
              </p>
              {horsTournoi ? (
                <ul className="mt-3 gap-x-8 lg:columns-2">
                  {parNomAffiche(banlist.outside_tournament).map((card) => (
                    <Ligne key={card.oracle_id} card={card} />
                  ))}
                </ul>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setHorsTournoi(true)}
                >
                  Les afficher quand même
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {data && onglet === "brackets" && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.brackets.brackets.map((bracket) => (
              <Card key={bracket.level}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {bracket.level}
                    </span>
                    {bracket.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{bracket.principle}</p>
                  <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                    {bracket.rules.map((regle) => (
                      <li key={regle}>{regle}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ce que le site sait en constater</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Les verdicts de la colonne de droite ne sont pas recopiés : ils sont{" "}
                <strong>produits en faisant tourner l&apos;estimateur</strong> sur un deck minimal
                par critère, celui-là même qui juge tes decks. Un seuil qui changerait dans le
                code changerait cette page avec lui. Repère du bas :{" "}
                {data.brackets.baseline.deck} → <strong>{data.brackets.baseline.verdict}</strong>.
              </p>
              {data.brackets.criteria.map((critere) => (
                <div key={critere.key} className="border-t pt-3 first:border-0 first:pt-0">
                  <h3 className="text-sm font-medium">{critere.label}</h3>
                  <div className="mt-1 grid gap-2 text-xs text-muted-foreground lg:grid-cols-3">
                    <p>
                      <span className="font-medium text-foreground">La règle. </span>
                      {critere.official}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Ce qu&apos;on constate. </span>
                      {critere.measured}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Vérification. </span>
                      {critere.demonstration.deck} →{" "}
                      <strong className="text-foreground">{critere.demonstration.verdict}</strong>
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ce qui n&apos;est pas mesuré, et pourquoi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.brackets.not_measured.map((item) => (
                <p key={item.label} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.label}. </span>
                  {item.why}
                </p>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {data && onglet === "game-changers" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Game Changers — {gameChangers.length} / {data.game_changers.length} cartes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              La liste officielle du Commander Format Panel, et le premier critère de bracket :
              aucune aux brackets 1 et 2, jusqu&apos;à trois au bracket 3, sans limite au-delà. Le
              commandant compte s&apos;il y figure lui-même. Elle arrive avec la synchronisation
              des cartes, il n&apos;y a donc rien à tenir à jour.
            </p>
            {visuels ? (
              <Grille cards={gameChangers} />
            ) : (
              <ul className="gap-x-8 lg:columns-2">
                {gameChangers.map((card) => (
                  <Ligne
                    key={card.oracle_id}
                    card={card}
                    note={
                      card.banned_duel ? (
                        <Badge variant="outline" className="text-[10px]">
                          bannie en duel
                        </Badge>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
