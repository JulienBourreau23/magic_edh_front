/**
 * Barres horizontales à **une seule série**, pour une magnitude comparée entre
 * catégories.
 *
 * Une seule teinte (`--chart-seq`), et c'est un choix, pas une facilité : il
 * n'y a ici aucune identité à distinguer — seulement des quantités à comparer.
 * Une palette catégorielle donnerait huit couleurs sans information, et
 * enterrerait la seule chose qui compte, l'ordre des longueurs. Les teintes
 * `--series-a` / `--series-b` sont réservées aux deux decks comparés et
 * n'auraient rien à faire ici.
 *
 * Horizontal plutôt que vertical parce que les libellés sont des mots — en
 * colonnes, « Enchantements » et « Planeswalkers » finiraient couchés.
 *
 * Pas de légende : avec une série, le titre la nomme. Chaque barre porte sa
 * valeur en clair, ce qui tient aussi lieu de vue tabulaire.
 */
export function RankedBars({
  rows,
}: {
  /**
   * `total` n'est renseigné que lorsque la valeur est une part d'un ensemble
   * connu (« 12 des 50 »). Sans lui, la barre n'est qu'un compte et afficher
   * un dénominateur inventerait une référence.
   */
  rows: { key: string; label: string; value: number; total?: number; hint?: string }[]
}) {
  // L'échelle est commune à toutes les barres, sinon leurs longueurs ne se
  // comparent plus — c'est le défaut le plus courant de ce type de graphique.
  const scale = Math.max(1, ...rows.map((row) => row.total ?? row.value))

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const share = Math.min(1, row.value / scale)
        return (
          <li key={row.key} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
            <span className="truncate text-xs text-muted-foreground">{row.label}</span>
            <span
              className="h-4 w-full overflow-hidden rounded-sm"
              style={{ background: "var(--grid-line)" }}
              title={
                row.hint ??
                `${row.label} — ${row.value}${row.total !== undefined ? ` sur ${row.total}` : ""}`
              }
            >
              {/* Extrémité arrondie côté données seulement : la barre reste
                  ancrée à sa ligne de base, elle ne flotte pas. */}
              <span
                className="block h-full rounded-r-sm"
                style={{ width: `${share * 100}%`, background: "var(--chart-seq)" }}
              />
            </span>
            <span className="w-20 text-right text-xs tabular-nums text-foreground">
              {row.value}
              {row.total !== undefined && (
                <span className="text-muted-foreground"> / {row.total}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
