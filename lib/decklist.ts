/**
 * Découpage d'une decklist en sections, partagé par tous les écrans qui
 * affichent ou exportent une liste de cartes. Une seule implémentation, sinon
 * la fiche, le deck compétitif et le PDF finiraient par ranger la même carte
 * dans trois sections différentes.
 */

/**
 * Ordre de **classement** : le premier type reconnu gagne. `Land` passe avant
 * tout — une Cité de Darksteel est un « Artifact Land », et un joueur la
 * cherche dans ses terrains, pas dans ses artefacts. `Creature` avant
 * `Artifact` pour la raison inverse : un Solemn Simulacrum se joue comme une
 * créature.
 */
const MATCH_ORDER = [
  "Land",
  "Creature",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
]

/** Ordre d'**affichage** : les sorts d'abord, les terrains à la fin. */
const DISPLAY_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Autre",
]

export const SECTION_LABELS: Record<string, string> = {
  Creature: "Créatures",
  Planeswalker: "Planeswalkers",
  Instant: "Éphémères",
  Sorcery: "Rituels",
  Artifact: "Artefacts",
  Enchantment: "Enchantements",
  Battle: "Batailles",
  Land: "Terrains",
  Autre: "Autre",
}

export function sectionKey(typeLine: string | null | undefined): string {
  const line = typeLine ?? ""
  return MATCH_ORDER.find((key) => line.includes(key)) ?? "Autre"
}

export function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key
}

export interface DeckSection<T> {
  key: string
  label: string
  cards: T[]
}

/**
 * Les sections non vides, dans l'ordre d'affichage. L'ordre des cartes à
 * l'intérieur est celui reçu : c'est à l'appelant de trier s'il le veut (la
 * fiche trie par nom, le deck compétitif garde son classement par popularité).
 */
export function groupIntoSections<T extends { type_line?: string | null }>(
  cards: T[]
): DeckSection<T>[] {
  const grouped = new Map<string, T[]>()
  for (const card of cards) {
    const key = sectionKey(card.type_line)
    grouped.set(key, [...(grouped.get(key) ?? []), card])
  }
  return DISPLAY_ORDER.filter((key) => grouped.has(key)).map((key) => ({
    key,
    label: sectionLabel(key),
    cards: grouped.get(key) ?? [],
  }))
}
