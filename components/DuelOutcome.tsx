import type { DuelResult } from "@/lib/api"

/**
 * Taux de victoire en duel simulé.
 *
 * Le chiffre est mesuré, mais son modèle est grossier et son biais a une
 * direction connue — l'encadré sous la barre le dit, et ce texte n'est pas
 * décoratif : sans lui, un 60/40 se lirait comme un pronostic.
 */
export function DuelOutcome({ duel, nameA, nameB }: { duel: DuelResult; nameA: string; nameB: string }) {
  const percent = (value: number) => `${Math.round(value * 100)} %`
  const segments = [
    { key: "a", label: nameA, value: duel.win_rate_a, token: "var(--series-a)" },
    { key: "tie", label: "Sans vainqueur", value: duel.unfinished_rate, token: "var(--grid-line)" },
    { key: "b", label: nameB, value: duel.win_rate_b, token: "var(--series-b)" },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-md">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className="flex items-center justify-center text-xs font-semibold"
              style={{
                width: `${segment.value * 100}%`,
                background: segment.token,
                color: segment.key === "tie" ? "var(--color-muted-foreground)" : "#fff",
              }}
              title={`${segment.label} — ${percent(segment.value)}`}
            >
              {segment.value >= 0.1 ? percent(segment.value) : ""}
            </div>
          ))}
      </div>

      <ul className="flex flex-wrap gap-4 text-xs">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: segment.token }} />
            <span className="text-muted-foreground">
              {segment.label} — {percent(segment.value)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        {duel.iterations} parties jouées coup par coup, {duel.starting_life} points de vie, durée
        moyenne {duel.avg_turns}{" "}
        tours. Chaque deck commence la moitié des parties, pour que l&apos;avantage du premier
        joueur ne soit pas confondu avec la force du deck.
      </p>

      <details className="rounded-md border p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Ce que cette simulation modélise — et ce qu&apos;elle ignore
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>
            <strong className="text-foreground">Modélisé :</strong> terrains et accélération, coût et
            couleurs du mana (calcul exact), déploiement des créatures avec leur vraie force et
            endurance, removal ciblé sur la plus grosse menace visable, board wipes, points de vie.
          </p>
          <p>
            <strong className="text-foreground">Combat joué avec ses règles :</strong> vol et portée
            (qui peut bloquer quoi), menace, initiative et double initiative (l&apos;ordre des dégâts
            décide qui meurt), contact mortel, piétinement, lien de vie, indestructible, défenseur,
            célérité, et vigilance — attaquer engage, donc une créature qui attaque ne bloquera pas
            au tour suivant.
          </p>
          <p>
            <strong className="text-foreground">Aussi pris en compte :</strong> les dégâts de
            commandant (21 d&apos;un même commandant font perdre), la menace du linceul qui échappe
            au removal ciblé, les contresorts gardés en réserve pour une vraie menace, la pioche
            apportée par un sort, et les combos gagnants à deux cartes — quand les deux pièces sont
            disponibles et le mana total payable, la partie est gagnée sur place.
          </p>
          <p>
            <strong className="text-foreground">Toujours ignoré :</strong> les capacités activées et
            déclenchées en général — « quand cette créature meurt, chaque joueur sacrifie un
            terrain » est du texte libre, et l&apos;exécuter demanderait un moteur de règles complet.
            Même chose pour les jetons, les moteurs de pioche récurrents, la politique, et les
            erreurs de jeu.
          </p>
          <p>
            <strong className="text-foreground">Biais résiduel :</strong> il garde une direction,
            plus faible qu&apos;avant. Le modèle reste{" "}
            <strong className="text-foreground">plus à l&apos;aise avec les decks qui gagnent par le
            combat ou par un combo identifié</strong> qu&apos;avec ceux qui gagnent en accumulant de
            petits avantages tour après tour. Lis ce taux comme une mesure de pression et de rythme,
            pas comme un pronostic de table.
          </p>
        </div>
      </details>
    </div>
  )
}
