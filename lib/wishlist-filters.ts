/**
 * Filtrage et tri de la liste de recherche, côté navigateur.
 *
 * La liste est courte par nature — quelques dizaines de cartes, déjà chargées
 * en une requête — donc tout se fait en mémoire : un aller-retour par frappe
 * rendrait les filtres saccadés sans rien apporter.
 *
 * Ce que ces filtres servent à faire est précis : **décider quoi acheter en
 * premier**. D'où des critères de budget (prix, prix inconnu), de besoin (pour
 * quel deck, combien d'exemplaires demandés) et de qualité (rôle, popularité),
 * et non une recherche générale de cartes — celle-là existe déjà ailleurs.
 */
import { normalizeForSearch } from "@/lib/collection-filters"
import type { WishlistEntry } from "@/lib/api"

export type WishlistSort = "prix-desc" | "prix-asc" | "popularite" | "quantite" | "ajout"

export interface WishlistFilterState {
  search: string
  /** Texte cherché dans la note : « pour quel deck ». */
  reason: string
  maxPrice: number | null
  types: string[]
  colors: string[]
  role: string | null
  /** Cartes déjà en collection : on en veut un exemplaire de plus. */
  ownedOnly: boolean
  /** Demandées par plusieurs decks : ce sont elles qui bloquent le plus. */
  multipleOnly: boolean
  gameChangersOnly: boolean
  /** Prix inconnu : jamais dans un total, donc à traiter à part. */
  hideUnknownPrice: boolean
  sort: WishlistSort
}

export const EMPTY_WISHLIST_FILTERS: WishlistFilterState = {
  search: "",
  reason: "",
  maxPrice: null,
  types: [],
  colors: [],
  role: null,
  ownedOnly: false,
  multipleOnly: false,
  gameChangersOnly: false,
  hideUnknownPrice: false,
  // Le tri d'origine de la page : sur une liste d'achats, ce sont les cartes
  // chères qui décident du budget, pas celles à 0,20 €.
  sort: "prix-desc",
}

export function filterWishlist(
  entries: WishlistEntry[],
  filters: WishlistFilterState
): WishlistEntry[] {
  const needle = normalizeForSearch(filters.search.trim())
  const reason = normalizeForSearch(filters.reason.trim())

  return entries.filter((entry) => {
    if (needle) {
      const noms = [entry.name, entry.name_fr ?? ""].map(normalizeForSearch)
      if (!noms.some((nom) => nom.includes(needle))) return false
    }
    if (reason && !normalizeForSearch(entry.note ?? "").includes(reason)) return false

    // Une carte sans prix connu n'est pas « gratuite » : elle ne peut pas être
    // comparée à un plafond, donc le plafond ne la retient jamais.
    if (filters.maxPrice != null) {
      if (entry.price_eur == null || entry.price_eur > filters.maxPrice) return false
    }
    if (filters.hideUnknownPrice && entry.price_eur == null) return false

    const typeLine = entry.type_line ?? ""
    if (filters.types.length > 0 && !filters.types.some((type) => typeLine.includes(type))) {
      return false
    }
    // Identité incluse dans la sélection, comme sur la collection : « jouable
    // dans ces couleurs », ce qui laisse passer les cartes incolores.
    if (filters.colors.length > 0
        && !entry.color_identity.every((color) => filters.colors.includes(color))) {
      return false
    }
    if (filters.role && !(entry.categories ?? []).includes(filters.role)) return false
    if (filters.ownedOnly && entry.owned_quantity === 0) return false
    if (filters.multipleOnly && entry.quantity < 2) return false
    if (filters.gameChangersOnly && !entry.game_changer) return false
    return true
  })
}

export function sortWishlist(entries: WishlistEntry[], sort: WishlistSort): WishlistEntry[] {
  const copie = [...entries]
  switch (sort) {
    case "prix-asc":
      // Prix inconnu en dernier : une absence de mesure n'est pas un prix bas.
      return copie.sort((a, b) => (a.price_eur ?? Infinity) - (b.price_eur ?? Infinity))
    case "popularite":
      return copie.sort((a, b) => (a.edhrec_rank ?? Infinity) - (b.edhrec_rank ?? Infinity))
    case "quantite":
      return copie.sort((a, b) => b.quantity - a.quantity || (b.price_eur ?? 0) - (a.price_eur ?? 0))
    case "ajout":
      return copie.sort((a, b) => b.added_at.localeCompare(a.added_at))
    default:
      return copie.sort((a, b) => (b.price_eur ?? -1) - (a.price_eur ?? -1))
  }
}

/**
 * Ce que coûte la sélection affichée.
 *
 * Recalculé côté navigateur et non repris du serveur : celui-ci compte la liste
 * entière, et c'est justement l'intérêt d'un filtre de savoir ce que coûte
 * *ce* sous-ensemble. Les prix inconnus sont comptés à part, jamais à zéro.
 */
export function summarize(entries: WishlistEntry[]) {
  return {
    distinct: entries.length,
    copies: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    total: entries.reduce((sum, entry) => sum + (entry.price_eur ?? 0) * entry.quantity, 0),
    unknownPrice: entries.filter((entry) => entry.price_eur == null).length,
  }
}

export function isWishlistFiltered(filters: WishlistFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.reason.trim() !== "" ||
    filters.maxPrice != null ||
    filters.types.length > 0 ||
    filters.colors.length > 0 ||
    filters.role !== null ||
    filters.ownedOnly ||
    filters.multipleOnly ||
    filters.gameChangersOnly ||
    filters.hideUnknownPrice
  )
}

/** Les rôles réellement présents : un filtre qui ne renvoie rien est du bruit. */
export function availableRoles(entries: WishlistEntry[]): string[] {
  const vus = new Set<string>()
  for (const entry of entries) for (const role of entry.categories ?? []) vus.add(role)
  return [...vus].sort()
}
