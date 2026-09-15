/**
 * Part des parties simulées où chaque deck est opérationnel le premier.
 *
 * Volontairement libellé « initiative » et non « victoire » : le simulateur ne
 * modélise ni combat ni interaction, et aucun résultat de vraie partie ne
 * permettrait de calibrer un pronostic. Ce que la barre montre est mesuré ;
 * un pourcentage de victoire serait inventé.
 */
export function InitiativeSplit({
  a,
  b,
  tie,
  nameA,
  nameB,
  iterations,
}: {
  a: number
  b: number
  tie: number
  nameA: string
  nameB: string
  iterations: number
}) {
  const segments = [
    { key: "a", label: nameA, value: a, token: "var(--series-a)" },
    { key: "tie", label: "Même tour", value: tie, token: "var(--grid-line)" },
    { key: "b", label: nameB, value: b, token: "var(--series-b)" },
  ]
  const percent = (value: number) => `${Math.round(value * 100)} %`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className="flex items-center justify-center text-[11px] font-medium"
              style={{
                width: `${segment.value * 100}%`,
                background: segment.token,
                color: segment.key === "tie" ? "var(--color-muted-foreground)" : "#fff",
              }}
              title={`${segment.label} — ${percent(segment.value)}`}
            >
              {segment.value >= 0.12 ? percent(segment.value) : ""}
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
        Sur {iterations} parties simulées, part des cas où le deck pose son commandant en premier.
        <strong className="text-foreground"> Ce n&apos;est pas un taux de victoire</strong> : ni le combat, ni
        le removal ciblé, ni la politique du multi ne sont modélisés. C&apos;est un indicateur de
        vitesse relative, utile pour l&apos;équilibrage.
      </p>
    </div>
  )
}
