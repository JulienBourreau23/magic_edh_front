"use client"

import { Suspense, use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { WishlistButton } from "@/components/WishlistButton"
import {
  archetypesApi,
  displayName,
  type ArchetypeCard,
  type ArchetypeCommander,
  type ArchetypeDetail,
  type CompetitiveFormat,
} from "@/lib/api"

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)} %`
}

/**
 * Ce que coûterait le deck derrière ce commandant, en une phrase.
 *
 * Le total seul ne répond pas à « gros investissement ou non » : soixante
 * cartes à cinq euros et trois pièces à cent font la même somme et ne se
 * décident pas pareil. D'où le détail au-dessus du plafond, et le compte des
 * cartes sans prix — qui ne sont **pas** des cartes gratuites.
 */
function cost(commander: ArchetypeCommander, coreSlots: number, maxPrice: number) {
  const missing = commander.core_size - commander.core_owned
  return (
    <span className="text-xs text-muted-foreground">
      noyau <span className="tabular-nums">{commander.core_owned}</span>/
      <span className="tabular-nums">{commander.core_size}</span>
      {commander.core_size < coreSlots && (
        <span title={`L'archétype n'a que ${commander.core_size} cartes dans ces couleurs`}>
          {" "}(sur {coreSlots} créneaux)
        </span>
      )}
      {missing > 0 && (
        <>
          {" · "}
          <span className="tabular-nums">{missing}</span> à acheter,{" "}
          <span className="tabular-nums">{EURO.format(commander.missing_price)}</span>
          {commander.over_cap_cards > 0 && (
            <>
              {" dont "}
              <span className="tabular-nums">{commander.over_cap_cards}</span> au-dessus de{" "}
              {EURO.format(maxPrice)} (
              <span className="tabular-nums">{EURO.format(commander.over_cap_price)}</span>)
            </>
          )}
          {commander.unknown_price > 0 && (
            <>
              {" · "}
              <span className="tabular-nums">{commander.unknown_price}</span> sans prix connu, hors
              total
            </>
          )}
        </>
      )}
    </span>
  )
}

/**
 * `useSearchParams` force le rendu client de tout ce qui est sous lui : Next
 * demande une frontière `Suspense`, comme sur `/balance` et `/matchup`.
 */
export default function ArchetypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement...</p>}>
      <Article slug={slug} />
    </Suspense>
  )
}

function Article({ slug }: { slug: string }) {
  // Le format vient de la page précédente : la banlist change à la fois les
  // commandants éligibles et les cartes du noyau, donc ouvrir l'article du
  // multi depuis un catalogue de duel raconterait autre chose.
  const searchParams = useSearchParams()
  const format: CompetitiveFormat = searchParams.get("format") === "duel" ? "duel" : "commander"

  const [data, setData] = useState<ArchetypeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    archetypesApi
      .get(slug, format)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [slug, format])

  const sections = useMemo(() => {
    const grouped = new Map<string, ArchetypeCard[]>()
    for (const card of data?.cards ?? []) {
      const list = grouped.get(card.section)
      if (list) list.push(card)
      else grouped.set(card.section, [card])
    }
    return grouped
  }, [data])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const headline = data.headline_sections.filter((section) => sections.has(section))
  const rest = [...sections.keys()].filter((section) => !data.headline_sections.includes(section))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/archetypes" className="text-xs text-muted-foreground hover:text-foreground">
          ← tous les archétypes
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.archetype.label}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">
            {data.archetype.deck_count.toLocaleString("fr-FR")}
          </span>{" "}
          decks recensés par EDHREC sur cet archétype.
        </p>
      </div>

      {data.note ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Le principe</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>{data.note.principle}</p>
            <p>
              <span className="font-medium">Comment ça gagne. </span>
              {data.note.wins}
            </p>
            <p>
              <span className="font-medium">Ce qui lui tombe dessus. </span>
              {data.note.watch}
            </p>
            <p className="text-xs text-muted-foreground">
              Ces trois paragraphes sont <strong>écrits à la main</strong> : EDHREC ne publie
              aucune description, et le projet préfère ne rien dire plutôt que de faire rédiger une
              mesure. Tout ce qui est chiffré sur cette page, en revanche, est mesuré.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cet archétype n&apos;est pas encore expliqué — les chiffres ci-dessous, eux, sont
          mesurés comme partout ailleurs.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Qui le pilote — et ce que ça te coûterait
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Le coût n&apos;est pas une propriété de l&apos;archétype mais du commandant : seules
            les cartes de <strong>son identité de couleur</strong> comptent, et le noyau visé est
            de {data.core_slots}{" "}non-terrains — la manabase se calcule, elle ne s&apos;achète
            pas. Un noyau plus court que {data.core_slots}{" "}signifie que l&apos;archétype
            n&apos;a pas assez de cartes recensées dans ces couleurs, pas que ta collection
            manque.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.commanders.map((commander) => (
              <div key={commander.oracle_id} className="flex flex-col gap-1">
                <CardTile card={commander} caption={displayName(commander)} />
                <span className="text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {commander.num_decks.toLocaleString("fr-FR")}
                  </span>{" "}
                  decks ·{" "}
                  <span className="tabular-nums">
                    {percent(
                      commander.potential_decks
                        ? commander.num_decks / commander.potential_decks
                        : null
                    )}
                  </span>{" "}
                  de l&apos;archétype
                </span>
                {cost(commander, data.core_slots, data.max_price)}
                <div className="flex flex-wrap items-center gap-1">
                  {commander.owned_quantity > 0 ? (
                    <Badge variant="secondary">en collection</Badge>
                  ) : (
                    <>
                      <Badge variant="outline">
                        commandant{" "}
                        {commander.price_eur === null
                          ? "prix inconnu"
                          : EURO.format(commander.price_eur)}
                      </Badge>
                      <WishlistButton
                        card={commander}
                        wanted={commander.wanted_quantity}
                        note={`Commandant ${data.archetype.label}`}
                        onError={setError}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">
            <Link href={`/competitive?archetype=${data.archetype.slug}&format=${data.format}`}>
              <Button variant="outline" size="sm">
                Monter cet archétype avec ma collection
              </Button>
            </Link>
          </p>
        </CardContent>
      </Card>

      {headline.map((section) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle className="text-base">
              {section === "High Synergy Cards"
                ? "Les cartes signature"
                : section === "Top Cards"
                  ? "Les plus jouées"
                  : "Game Changers"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {section === "High Synergy Cards"
                ? "Celles qu'on joue ici et presque nulle part ailleurs : c'est la synergie, pas la popularité, qui les désigne — Sol Ring est dans tous les decks et ne caractérise donc aucun archétype."
                : section === "Top Cards"
                  ? "Les plus présentes dans les decks de l'archétype, synergie comprise ou non."
                  : "Cartes de la liste officielle du Commander Format Panel présentes dans cet archétype : leur nombre pèse directement sur le bracket du deck qu'on en tirera."}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {(sections.get(section) ?? []).map((card) => (
                <div key={card.oracle_id} className="flex flex-col gap-1">
                  <CardTile card={card} caption={displayName(card)} />
                  <span className="text-xs text-muted-foreground">
                    <span className="tabular-nums">{percent(card.inclusion_rate)}</span> des decks
                    {card.synergy !== null && (
                      <>
                        {" · synergie "}
                        <span className="tabular-nums">
                          {card.synergy > 0 ? "+" : ""}
                          {card.synergy.toFixed(2)}
                        </span>
                      </>
                    )}
                  </span>
                  {card.owned_quantity > 0 ? (
                    <Badge variant="secondary" className="w-fit">
                      possédée
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {card.price_eur === null ? "prix inconnu" : EURO.format(card.price_eur)}
                      </span>
                      <WishlistButton
                        card={card}
                        wanted={card.wanted_quantity}
                        note={`Archétype ${data.archetype.label}`}
                        onError={setError}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Le catalogue complet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Toutes les cartes recensées sur l&apos;archétype, par rubrique. Une carte peut figurer
            dans deux rubriques : c&apos;est la rubrique qui dit pourquoi elle est citée. Les
            terrains de base en sont absents, comme partout. Les visuels ne sont pas rapatriés sur
            cette section — plus de trois cents images au premier affichage feraient attendre pour
            des cartes qu&apos;on ne regarde pas.
          </p>
          {!showAll ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
              Afficher les {rest.reduce((total, section) => total + (sections.get(section)?.length ?? 0), 0)}{" "}
              cartes
            </Button>
          ) : (
            <div className="flex flex-col gap-4">
              {rest.map((section) => (
                <div key={section}>
                  <h3 className="mb-1 text-sm font-medium">{section}</h3>
                  <ul className="grid gap-x-6 sm:grid-cols-2">
                    {(sections.get(section) ?? []).map((card) => (
                      <li
                        key={card.oracle_id}
                        className="flex items-baseline gap-2 border-b py-1 text-sm last:border-0"
                      >
                        <span className={card.owned_quantity > 0 ? "" : "text-muted-foreground"}>
                          {displayName(card)}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {percent(card.inclusion_rate)}
                        </span>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                          {card.price_eur === null ? "—" : EURO.format(card.price_eur)}
                        </span>
                        {card.owned_quantity > 0 ? (
                          <span className="w-24 text-right text-xs text-muted-foreground">
                            possédée
                          </span>
                        ) : (
                          <WishlistButton
                            card={card}
                            wanted={card.wanted_quantity}
                            note={`Archétype ${data.archetype.label}`}
                            className="h-6 w-24 px-2 text-xs"
                            onError={setError}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
