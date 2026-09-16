/**
 * Filtrage de la collection, côté navigateur.
 *
 * Tout tient en mémoire : quelques centaines de cartes, chargées une fois. Un
 * aller-retour au serveur par frappe n'apporterait rien et rendrait les
 * filtres saccadés. Les fonctions sont pures pour être testables sans rendu.
 */
import type { CollectionEntry } from "@/lib/api"

export interface CollectionFilterState {
  search: string
  types: string[]
  colors: string[]
  manaValues: number[]
  keyword: string | null
  role: string | null
  legendaryOnly: boolean
  gameChangersOnly: boolean
}

export const EMPTY_FILTERS: CollectionFilterState = {
  search: "",
  types: [],
  colors: [],
  manaValues: [],
  keyword: null,
  role: null,
  legendaryOnly: false,
  gameChangersOnly: false,
}

/** Au-delà, les coûts sont regroupés : un 8 et un 12 se cherchent pareil. */
export const MAX_MANA_VALUE = 7

export function manaBucket(cmc: number | null): number {
  return Math.min(Math.floor(cmc ?? 0), MAX_MANA_VALUE)
}

/**
 * Accents et ligatures neutralisés, des deux côtés de la comparaison.
 *
 * Les noms français de Scryfall ne sont pas homogènes — « Ile » sans accent,
 * « Nuée de fÆries » avec ligature — et personne ne tape « fÆries ». Le back
 * applique la même règle à la résolution des decklists (`normalize_card_name`),
 * mais il s'agit là d'une égalité en SQL : ici c'est une recherche de sous-
 * chaîne dans le navigateur, d'où une seconde écriture, volontairement courte.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function matchesSearch(entry: CollectionEntry, search: string): boolean {
  const needle = normalizeForSearch(search.trim())
  if (!needle) return true
  // Les deux langues : la carte s'affiche en français mais se retient parfois
  // en anglais, et l'inverse pour les ~12 % non traduites.
  return (
    normalizeForSearch(entry.name).includes(needle) ||
    (entry.name_fr ? normalizeForSearch(entry.name_fr).includes(needle) : false)
  )
}

export function filterCollection(
  entries: CollectionEntry[],
  filters: CollectionFilterState
): CollectionEntry[] {
  return entries.filter((entry) => {
    if (!matchesSearch(entry, filters.search)) return false

    const typeLine = entry.type_line ?? ""
    if (filters.types.length > 0 && !filters.types.some((type) => typeLine.includes(type))) {
      return false
    }
    if (filters.legendaryOnly && !typeLine.includes("Legendary")) return false
    if (filters.gameChangersOnly && !entry.game_changer) return false

    // Identité de couleur : « jouable dans ces couleurs », donc l'identité de
    // la carte doit être **incluse** dans la sélection — pas la croiser. C'est
    // la question qu'on se pose en construisant un deck, et elle laisse
    // naturellement passer les cartes incolores, jouables partout.
    if (filters.colors.length > 0) {
      if (!entry.color_identity.every((color) => filters.colors.includes(color))) return false
    }

    if (filters.manaValues.length > 0 && !filters.manaValues.includes(manaBucket(entry.cmc))) {
      return false
    }
    if (filters.keyword && !(entry.keywords ?? []).includes(filters.keyword)) return false
    if (filters.role && !(entry.categories ?? []).includes(filters.role)) return false

    return true
  })
}

/** Les valeurs réellement présentes : un filtre qui ne renvoie rien est du bruit. */
export function availableKeywords(entries: CollectionEntry[]): string[] {
  const seen = new Set<string>()
  for (const entry of entries) for (const keyword of entry.keywords ?? []) seen.add(keyword)
  return [...seen].sort()
}

export function availableRoles(entries: CollectionEntry[]): string[] {
  const seen = new Set<string>()
  for (const entry of entries) for (const role of entry.categories ?? []) seen.add(role)
  return [...seen].sort()
}

export function isFiltered(filters: CollectionFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.types.length > 0 ||
    filters.colors.length > 0 ||
    filters.manaValues.length > 0 ||
    filters.keyword !== null ||
    filters.role !== null ||
    filters.legendaryOnly ||
    filters.gameChangersOnly
  )
}
