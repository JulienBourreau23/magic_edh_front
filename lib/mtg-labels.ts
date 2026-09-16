/**
 * Libellés français des données de carte.
 *
 * Scryfall ne fournit ni les mots-clés ni les types en français : seuls les
 * *noms* de cartes sont traduits (`card_names_fr`). Or la page collection parle
 * à un joueur francophone, qui cherche « vol », pas « Flying ».
 *
 * La règle est la même que pour `displayName` : français si on le connaît,
 * anglais sinon. Un mot-clé absent de la table s'affiche donc tel quel — c'est
 * la norme pour les mécaniques rares, pas un cas d'erreur.
 */

/** Les mots-clés les plus portés par les cartes de la base, par fréquence. */
const KEYWORD_LABELS: Record<string, string> = {
  Flying: "vol",
  Enchant: "enchanter",
  Trample: "piétinement",
  Vigilance: "vigilance",
  Haste: "célérité",
  Equip: "équipement",
  Flash: "flash",
  Mill: "meule",
  Scry: "scruter",
  Transform: "transformation",
  Reach: "portée",
  Cycling: "recyclage",
  "First strike": "initiative",
  Menace: "menace",
  Lifelink: "lien de vie",
  Treasure: "trésor",
  Deathtouch: "contact mortel",
  Defender: "défenseur",
  Regenerate: "régénération",
  Surveil: "sonder",
  Kicker: "coût de renfort",
  Flashback: "flashback",
  Protection: "protection",
  Ward: "gardien",
  Crew: "équipage",
  Landfall: "atterrissage",
  Food: "nourriture",
  Morph: "morphe",
  Fight: "combat",
  Partner: "partenaire",
  Investigate: "enquêter",
  Devoid: "dénué",
  Landwalk: "traversée",
  "Double strike": "double initiative",
  Indestructible: "indestructible",
  Convoke: "convocation",
  Threshold: "seuil",
  Proliferate: "prolifération",
  Hexproof: "défense talismanique",
  Prowess: "prouesse",
  Goad: "provocation",
  Affinity: "affinité",
  Delirium: "délire",
  Suspend: "suspension",
  Amass: "amassement",
  Changeling: "changeforme",
  Madness: "démence",
  Manifest: "manifestation",
  Domain: "domaine",
  Unearth: "exhumation",
  Infect: "infection",
  Annihilator: "annihilateur",
  Cascade: "cascade",
  Storm: "tempête",
  Delve: "fouille",
  Dredge: "drague",
  Persist: "persistance",
  Undying: "immortalité",
  Evoke: "évocation",
  Exalted: "exalté",
  Extort: "extorsion",
  Melee: "mêlée",
  Mentor: "mentor",
  Riot: "émeute",
  Adapt: "adaptation",
  Explore: "exploration",
  Embalm: "embaumement",
  Eternalize: "éternalisation",
  Escape: "évasion",
  Mutate: "mutation",
  Foretell: "prédiction",
  Disturb: "perturbation",
  Blitz: "assaut éclair",
  Casualty: "sacrifice de guerre",
  Connive: "machination",
  Backup: "renfort",
  Bargain: "marchandage",
  "Split second": "seconde d'arrêt",
  Shroud: "linceul",
  Banding: "bande",
  Bushido: "bushido",
  Soulbond: "lien d'âme",
  Miracle: "miracle",
  Overload: "surcharge",
  Rebound: "ricochet",
  Retrace: "calque",
  Buyback: "rachat",
  Echo: "écho",
  Entwine: "enchevêtrement",
  Fabricate: "fabrication",
  Ninjutsu: "ninjutsu",
  Offering: "offrande",
  Outlast: "survie",
  Rampage: "déchaînement",
  Replicate: "réplication",
  Scavenge: "charognage",
  Transmute: "transmutation",
  Unleash: "déchaînement furieux",
  Vanishing: "disparition",
}

export function keywordLabel(keyword: string): string {
  return KEYWORD_LABELS[keyword] ?? keyword
}

/**
 * Les grands types, dans l'ordre où un joueur les cherche. Le test se fait sur
 * le type anglais, qui est celui de la base ; « Legendary » n'en est pas un,
 * c'est un sur-type, d'où son filtre séparé.
 */
export const CARD_TYPES: { value: string; label: string }[] = [
  { value: "Creature", label: "Créature" },
  { value: "Instant", label: "Éphémère" },
  { value: "Sorcery", label: "Rituel" },
  { value: "Artifact", label: "Artefact" },
  { value: "Enchantment", label: "Enchantement" },
  { value: "Planeswalker", label: "Planeswalker" },
  { value: "Land", label: "Terrain" },
  { value: "Battle", label: "Bataille" },
]

/** Les cinq couleurs, avec la lettre que porte le jeton de couleur. */
export const COLORS: { value: string; label: string; letter: string }[] = [
  { value: "W", label: "blanc", letter: "W" },
  { value: "U", label: "bleu", letter: "U" },
  { value: "B", label: "noir", letter: "B" },
  { value: "R", label: "rouge", letter: "R" },
  { value: "G", label: "vert", letter: "G" },
]

/** Rôles calculés par `card_categories.classify()` au moment du sync. */
export const ROLE_LABELS: Record<string, string> = {
  ramp: "accélération",
  draw: "pioche",
  removal: "removal",
  board_wipe: "board wipe",
  counterspell: "contresort",
  protection: "protection",
  recursion: "récupération",
  tutor: "tuteur",
  extra_turn: "tour supplémentaire",
  stax: "stax",
  land: "terrain",
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}
