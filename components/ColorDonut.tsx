/**
 * Répartition des besoins en couleurs d'un deck.
 *
 * Vocabulaire : ce que le back appelle `pips` est un **symbole de mana coloré**
 * dans le coût d'une carte — {1}{B}{B} en demande deux noirs. Le terme anglais
 * ne sort jamais à l'écran, il reste un nom de champ.
 *
 * Les teintes suivent les couleurs de Magic — elles sont sémantiques, on ne
 * peut pas les réattribuer. Conséquence : rouge et vert restent proches sous
 * protanopie, donc **la lettre de couleur est portée par la part elle-même**
 * et par la légende. La couleur est un rappel, jamais le seul identifiant.
 */
const MANA_ORDER = ["W", "U", "B", "R", "G"] as const

const MANA_TOKEN: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
}

const MANA_LABEL: Record<string, string> = {
  W: "Blanc",
  U: "Bleu",
  B: "Noir",
  R: "Rouge",
  G: "Vert",
}

const RADIUS = 42
const STROKE = 16
const GAP = 2 // écart de surface entre deux parts, en unités de circonférence
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const MIN_SHARE_FOR_INLINE_LABEL = 0.08

export function ColorDonut({
  colors,
  colorlessCards,
}: {
  colors: Record<string, { sources: number; pips: number; under_supplied: boolean }>
  colorlessCards?: number
}) {
  const slices = MANA_ORDER.filter((color) => (colors[color]?.pips ?? 0) > 0).map((color) => ({
    color,
    pips: colors[color].pips,
    sources: colors[color].sources,
    underSupplied: colors[color].under_supplied,
  }))
  const total = slices.reduce((sum, slice) => sum + slice.pips, 0)

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Aucun symbole de mana coloré dans ce deck.</p>
  }

  // Décalage cumulé calculé sans mutation : cinq parts au maximum, le coût est nul.
  const arcs = slices.map((slice, index) => {
    const share = slice.pips / total
    const pipsBefore = slices.slice(0, index).reduce((sum, previous) => sum + previous.pips, 0)
    return {
      ...slice,
      share,
      length: Math.max(share * CIRCUMFERENCE - GAP, 1),
      offset: (pipsBefore / total) * CIRCUMFERENCE,
    }
  })

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img"
           aria-label={`Symboles de mana demandés : ${slices.map((s) => `${MANA_LABEL[s.color]} ${s.pips}`).join(", ")}`}>
        <g transform="rotate(-90 60 60)">
          {arcs.map((arc) => (
            <circle
              key={arc.color}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={MANA_TOKEN[arc.color]}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
            >
              <title>{`${MANA_LABEL[arc.color]} — ${arc.pips} symboles demandés, ${arc.sources} sources`}</title>
            </circle>
          ))}
        </g>

        {/* Lettre posée sur la part quand elle est assez large pour la porter. */}
        {arcs
          .filter((arc) => arc.share >= MIN_SHARE_FOR_INLINE_LABEL)
          .map((arc) => {
            const midAngle = ((arc.offset + (arc.share * CIRCUMFERENCE) / 2) / CIRCUMFERENCE) * 2 * Math.PI - Math.PI / 2
            return (
              <text
                key={arc.color}
                x={60 + RADIUS * Math.cos(midAngle)}
                y={60 + RADIUS * Math.sin(midAngle)}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white text-[10px] font-semibold"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 }}
              >
                {arc.color}
              </text>
            )
          })}

        <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
              className="fill-current text-[13px] font-semibold tabular-nums">
          {total}
        </text>
        <text x="60" y="73" textAnchor="middle" className="fill-current text-[7px] opacity-60">
          symboles
        </text>
      </svg>

      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1 text-xs">
          {slices.map((slice) => (
            <li key={slice.color} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: MANA_TOKEN[slice.color] }}
              />
              <span className="w-4 font-mono font-semibold">{slice.color}</span>
              <span className="text-muted-foreground">
                {slice.pips} symboles demandés · {slice.sources} sources
              </span>
              {slice.underSupplied && (
                <span className="text-amber-600 dark:text-amber-500">sous-alimentée</span>
              )}
            </li>
          ))}
          {colorlessCards ? (
            <li className="text-muted-foreground">+ {colorlessCards} cartes sans identité de couleur</li>
          ) : null}
        </ul>
        <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">
          Un <strong className="font-medium text-foreground">symbole</strong>{" "}
          = un symbole de mana coloré dans le coût d&apos;une carte ({"{1}{B}{B}"} en demande deux
          noirs). Plus une couleur est demandée, plus il faut de terrains qui la produisent.
        </p>
      </div>
    </div>
  )
}
