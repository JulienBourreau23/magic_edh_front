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
            endurance, removal ciblé sur la plus grosse menace, board wipes, attaques, blocages,
            points de vie.
          </p>
          <p>
            <strong className="text-foreground">Ignoré :</strong> vol et piétinement, capacités
            activées et déclenchées, jetons, moteurs de pioche, combos, contresorts joués au bon
            moment, dégâts de commandant.
          </p>
          <p>
            <strong className="text-foreground">Biais à connaître :</strong> ce n&apos;est pas du
            bruit, il a une direction. Le modèle <strong className="text-foreground">avantage les
            decks dont la puissance est dans les corps de créature</strong> et sous-estime ceux qui
            gagnent par moteurs, combos ou contrôle. Lis ce taux comme une mesure de pression et de
            rythme, pas comme un pronostic de table.
          </p>
        </div>
      </details>
    </div>
  )
}
