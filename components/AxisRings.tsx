import type { MatchupAxis } from "@/lib/api"

/**
 * Comparaison axe par axe : deux cercles côte à côte, un par deck.
 *
 * Un cercle complet = le meilleur des deux sur cet axe, un cercle vide = zéro.
 * Le remplissage suit donc la **performance**, pas la valeur brute : sur
 * « tour moyen du commandant », plus bas est meilleur, et c'est le deck le plus
 * rapide qui a le cercle plein. Sans cette inversion, le deck le plus lent
 * aurait le plus gros cercle et la lecture d'un coup d'œil serait fausse.
 * La valeur brute reste écrite sous chaque cercle, rien n'est masqué.
 *
 * Chaque axe garde sa propre échelle : un tour (5,06) et un taux (0,76) n'ont
 * pas la même unité, une échelle commune n'aurait aucun sens.
 */
const RADIUS = 26
const STROKE = 7
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function AxisRings({ axes, nameA, nameB }: { axes: MatchupAxis[]; nameA: string; nameB: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <ul className="flex flex-wrap gap-4">
          {[
            { name: nameA, token: "var(--series-a)" },
            { name: nameB, token: "var(--series-b)" },
          ].map((serie) => (
            <li key={serie.name} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: serie.token }} />
              <span className="text-muted-foreground">{serie.name}</span>
            </li>
          ))}
        </ul>
        <span className="text-muted-foreground opacity-80">Cercle plein = meilleur sur l&apos;axe</span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {axes.map((axis) => (
          <AxisPair key={axis.label} axis={axis} nameA={nameA} nameB={nameB} />
        ))}
      </div>
    </div>
  )
}

/** Part de remplissage : 1 pour le meilleur, proportionnel pour l'autre. */
function fillFor(value: number | null, other: number | null, lowerIsBetter: boolean): number {
  if (value === null) return 0
  if (other === null) return 1

  const best = lowerIsBetter ? Math.min(value, other) : Math.max(value, other)
  if (best === 0) return lowerIsBetter ? (value === 0 ? 1 : 0) : 0
  const ratio = lowerIsBetter ? best / value : value / best
  return Math.max(Math.min(ratio, 1), 0)
}

function AxisPair({ axis, nameA, nameB }: { axis: MatchupAxis; nameA: string; nameB: string }) {
  return (
    <figure className="flex flex-col items-center gap-2 text-center">
      <figcaption className="text-xs font-medium leading-tight">{axis.label}</figcaption>

      <div className="flex items-start gap-5">
        <Gauge
          value={axis.a}
          fill={fillFor(axis.a, axis.b, axis.lower_is_better)}
          token="var(--series-a)"
          deckName={nameA}
          isWinner={axis.winner === "a"}
        />
        <Gauge
          value={axis.b}
          fill={fillFor(axis.b, axis.a, axis.lower_is_better)}
          token="var(--series-b)"
          deckName={nameB}
          isWinner={axis.winner === "b"}
        />
      </div>

      <span className="text-[10px] leading-tight text-muted-foreground">{axis.hint}</span>
    </figure>
  )
}

function Gauge({
  value,
  fill,
  token,
  deckName,
  isWinner,
}: {
  value: number | null
  fill: number
  token: string
  deckName: string
  isWinner: boolean
}) {
  const length = fill * CIRCUMFERENCE
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 60 60" className="h-16 w-16" role="img"
           aria-label={`${deckName} : ${value ?? "valeur inconnue"}`}>
        <circle cx="30" cy="30" r={RADIUS} fill="none" stroke="var(--grid-line)" strokeWidth={STROKE} />
        <g transform="rotate(-90 30 30)">
          <circle
            cx="30"
            cy="30"
            r={RADIUS}
            fill="none"
            stroke={token}
            strokeWidth={STROKE}
            strokeLinecap={fill >= 1 ? "butt" : "round"}
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
          >
            <title>{`${deckName} — ${value ?? "—"}`}</title>
          </circle>
        </g>
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
              className="fill-current text-[11px] tabular-nums"
              style={{ fontWeight: isWinner ? 600 : 400, opacity: isWinner ? 1 : 0.65 }}>
          {value ?? "—"}
        </text>
      </svg>
    </div>
  )
}
