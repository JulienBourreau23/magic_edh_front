import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { displayName, type DeckSynergy, type TwoCardCombo } from "@/lib/api"

const SYNERGIES_SHOWN = 20

/**
 * Combos expliqués et synergies, pour n'importe quelle liste de cartes :
 * une fiche de deck, une decklist proposée, un deck compétitif construit.
 *
 * Factorisé parce que les trois posent la même question et méritent la même
 * mise en garde — la dupliquer laisserait les explications diverger, et c'est
 * l'explication qui fait la valeur de ces deux listes.
 */
export function CombosAndSynergies({
  combos,
  synergies,
  subject,
  themeLabel,
}: {
  combos: TwoCardCombo[]
  synergies: DeckSynergy[]
  /** Ce à quoi la synergie se rapporte : le nom du commandant. */
  subject: string
  /** Renseigné quand la mesure porte sur un archétype et non sur tous ses decks. */
  themeLabel?: string
}) {
  if (combos.length === 0 && synergies.length === 0) return null

  const winning = combos.filter((combo) => combo.wins_outright).length

  return (
    <>
      {combos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Combos à deux cartes{" "}
              <span className="font-normal text-muted-foreground">
                — {combos.length}, dont {winning} qui gagne(nt) la partie
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {combos.map((combo) => (
              <div
                key={combo.variant_id}
                className="flex flex-col gap-1.5 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Badge variant={combo.wins_outright ? "default" : "secondary"}>
                    {combo.wins_outright ? "Gagne la partie" : "Combo"}
                  </Badge>
                  <a
                    href={combo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    {combo.cards.join(" + ")}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {combo.total_mana_value} mana au total
                    {combo.produces.length > 0 && ` — ${combo.produces.slice(0, 3).join(", ")}`}
                  </span>
                </div>

                {combo.prerequisites && (
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Prérequis :</strong> {combo.prerequisites}
                  </p>
                )}

                {combo.description && (
                  <ol className="ml-4 flex list-decimal flex-col gap-0.5 text-xs text-muted-foreground">
                    {combo.description
                      .split("\n")
                      .map((étape) => étape.trim())
                      .filter(Boolean)
                      .map((étape, index) => (
                        <li key={index}>{étape}</li>
                      ))}
                  </ol>
                )}
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              « Mana au total » = lancer les deux cartes puis exécuter le combo. À comparer au ramp
              du deck : le bracket 3 tolère un combo de <em>fin de partie</em>, pas un plan de
              départ. Les étapes viennent de Commander Spellbook — le lien mène à la page du combo
              pour vérifier à la main.
            </p>
          </CardContent>
        </Card>
      )}

      {synergies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Synergies avec {subject}
              {themeLabel && <> — {themeLabel}</>}{" "}
              <span className="font-normal text-muted-foreground">
                ({synergies.length} carte(s) reconnue(s))
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">Carte</th>
                  <th className="w-28 py-1.5 text-right font-medium">Synergie</th>
                  <th className="w-36 py-1.5 text-right font-medium">Jouée dans</th>
                </tr>
              </thead>
              <tbody>
                {synergies.slice(0, SYNERGIES_SHOWN).map((card) => (
                  <tr key={card.oracle_id} className="border-b last:border-0">
                    <td className="py-1.5">{displayName(card)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      <span
                        className={card.synergy > 0 ? "text-foreground" : "text-muted-foreground"}
                      >
                        {card.synergy > 0 ? "+" : ""}
                        {(card.synergy * 100).toFixed(0)} pts
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {card.inclusion_rate != null
                        ? `${Math.round(card.inclusion_rate * 100)} % des decks`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">La synergie n&apos;est pas la popularité.</strong>{" "}
              C&apos;est l&apos;écart entre « jouée ici » et « jouée dans cette couleur en
              général » : Sol Ring est dans presque tous les decks, donc synergique avec personne.
              Une valeur élevée désigne une carte qui est là <em>pour ce cas précis</em>. Une valeur
              négative n&apos;est pas une erreur — c&apos;est souvent le signe d&apos;une carte qui
              n&apos;est pas à sa place.
              {themeLabel
                ? " Mesurée contre les decks de cet archétype, pas contre tous ceux du commandant."
                : ""}
              {synergies.length > SYNERGIES_SHOWN && ` Les ${SYNERGIES_SHOWN} premières sont affichées.`}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
