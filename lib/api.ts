import { authHeaders, clearToken } from "./auth"

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://mtg-edh-api.julien-cloud.eu"

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "ApiError"
  }
}

type ApiInit = Omit<RequestInit, "body"> & {
  /**
   * Objet **non sérialisé** : `apiFetch` s'en charge. Le type refuse une
   * chaîne exprès — passer un `JSON.stringify(...)` ici l'encodait deux fois,
   * et l'API répondait 422 sur un corps qui avait pourtant l'air juste.
   */
  body?: Record<string, unknown> | unknown[]
  /** Joindre le jeton (défaut : true). */
  auth?: boolean
  errorMessage?: string
}

/**
 * Point d'entrée unique vers l'API : URL de base, jeton, parsing des erreurs
 * FastAPI (`detail`) et déconnexion automatique sur jeton expiré.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, auth = true, errorMessage, headers, ...rest } = init

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(auth ? authHeaders() : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    // 401 sur un appel authentifié = jeton expiré ou absent : inutile de
    // laisser l'utilisateur sur une page qui ne chargera jamais.
    if (res.status === 401 && auth && typeof window !== "undefined") {
      clearToken()
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login"
    }
    const detail = await res
      .json()
      .then((d) => (typeof d?.detail === "string" ? d.detail : null))
      .catch(() => null)
    throw new ApiError(detail || errorMessage || `Erreur serveur (${res.status})`, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/**
 * Image servie par notre back une fois rapatriée ; tant qu'elle ne l'est pas
 * (téléchargement échoué, fiche ouverte pendant la récupération), on retombe
 * sur l'URL Scryfall plutôt que d'afficher une image cassée.
 */
export function cardImageUrl(card: Pick<Card, "image_uri" | "image_downloaded" | "scryfall_id">): string | null {
  if (!card.image_uri) return null
  return card.image_downloaded ? `${API_BASE}/card-images/${card.scryfall_id}.jpg` : card.image_uri
}

// --- Types ---

export type DeckFormat = "commander" | "duel"

/**
 * Nom affiché d'une carte : le français quand il existe, l'anglais sinon.
 * Environ 12 % des cartes n'ont jamais été imprimées en français (vieux sets,
 * Secret Lairs) — le repli anglais n'est pas un cas d'erreur, c'est la norme
 * pour ces cartes-là.
 */
export function displayName(card: { name: string; name_fr?: string | null }): string {
  return card.name_fr || card.name
}

/** Libellés des rôles renvoyés par le back (clés techniques côté API). */
export const ROLE_LABELS: Record<string, string> = {
  ramp: "Accélération de mana",
  draw: "Pioche",
  removal: "Removal ciblé",
  board_wipe: "Board wipe",
  counterspell: "Contresorts",
  protection: "Protection",
  recursion: "Récupération",
  tutor: "Tuteurs",
  land: "Terrains",
}

export interface DeckSummary {
  id: number
  name: string
  format: DeckFormat
  created_at: string
  commander_name: string | null
  commander_name_fr: string | null
  commander_image_uri: string | null
  card_count: number
}

export interface Card {
  scryfall_id: string
  oracle_id: string
  name: string
  mana_cost: string | null
  cmc: number | null
  type_line: string | null
  color_identity: string[]
  rarity: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  legal_commander: boolean
  legal_duel: boolean
  game_changer: boolean
  categories: string[]
  /** Mots-clés Scryfall, en anglais (« Flying », « Infect ») : voir `lib/mtg-labels`. */
  keywords?: string[]
  produced_mana: string[]
  edhrec_rank: number | null
  allows_multiple: boolean
  name_fr: string | null
  quantity: number
  is_commander: boolean
  /**
   * Nom français ayant déclenché la correspondance lors d'une recherche.
   * Sert de repère dans les résultats quand il diffère du nom affiché.
   */
  matched_fr?: string | null
}

export interface ImportIssue {
  raw_line: string
  reason: string
}

export interface LegalityWarning {
  card: string
  issue: string
}

export interface TwoCardCombo {
  variant_id: string
  /** Page Commander Spellbook du combo, pour vérifier à la main. */
  url: string
  /** Les deux cartes, déjà affichées en français quand la traduction existe. */
  cards: string[]
  produces: string[]
  /** Gagne la partie à lui seul : c'est celui qui pèse sur le bracket. */
  wins_outright: boolean
  mana_needed: string | null
  /** Mana pour lancer les deux cartes ET exécuter le combo. */
  total_mana_value: number
  bracket_tag: string | null
  popularity: number | null
}

/** Carte citée pour expliquer un plancher de bracket. */
export interface BracketCardRef {
  name: string
  name_fr: string | null
  scryfall_id: string
  is_commander: boolean
}

export interface BracketEstimate {
  game_changers: BracketCardRef[]
  game_changer_count: number
  min: number
  max: number
  label: string
  two_card_combos: TwoCardCombo[]
  winning_combo_count: number
  /** Interdite jusqu'au bracket 3 inclus : le critère le plus punitif. */
  mass_land_denial: BracketCardRef[]
  /** Interdits au bracket 1 ; les brackets 2 et 3 n'interdisent que l'enchaînement. */
  extra_turns: BracketCardRef[]
  /** Ce qui a fixé le plancher, en clair. Vide si rien ne l'a relevé. */
  floor_reasons: string[]
  /** Comptés et affichés, mais sans effet : ce ne sont pas des critères officiels. */
  qualitative_signals: { tutors: number; stax: number }
  note: string
}

export interface ManabaseColor {
  sources: number
  pips: number
  /** Sources conseillées pour cette couleur, calculées depuis sa propre demande. */
  target: number
  shortfall: number
  under_supplied: boolean
}

/** Une carte que les couleurs laissent en main : il lui faut plus de sources qu'il n'y en a. */
export interface StrainedCard {
  name: string
  mana_cost: string | null
  color: string
  needed: number
  sources: number
}

/**
 * Répartition conseillée des terrains de base. Le total ne bouge jamais : c'est
 * un échange, pas un achat.
 */
export interface BasicLandAdvice {
  total: number
  current: Record<string, number>
  suggested: Record<string, number>
  moves: { land: string; from: number; to: number; delta: number }[]
  stuck_before: number
  stuck_after: number
  /**
   * Contrôle par simulation : l'estimation rapide raisonne couleur par couleur
   * et ne voit pas qu'une duale W/U ne paie qu'un symbole à la fois. Quand les
   * deux se contredisent, c'est la simulation qui tranche. Absents hors des
   * pages qui conseillent.
   */
  measured_before?: number
  measured_after?: number
  confirmed?: boolean
}

export interface Manabase {
  land_count: number
  recommended_lands: string
  lands_ok: boolean
  colors: Record<string, ManabaseColor>
  /** Cartes bloquées en main par les couleurs, en espérance (estimation rapide). */
  stuck_cards: number
  /** Part des sorts bloqués par la couleur, mesurée par simulation. null hors des pages qui conseillent. */
  measured_stuck_rate: number | null
  strained_cards: StrainedCard[]
  strained_total: number
  basic_lands: BasicLandAdvice | null
  colorless_cards: number
}

export interface RoleDiagnostic {
  role: string
  count: number
  target: string
  status: "ok" | "insuffisant" | "excédentaire"
  gap: number
}

export interface DeckDetail {
  deck: {
    id: number
    name: string
    format: DeckFormat
    commander_scryfall_id: string | null
    created_at: string
  }
  cards: Card[]
  import_issues: ImportIssue[]
  mana_curve: Record<string, number>
  total_price_eur: number
  legality_warnings: LegalityWarning[]
  bracket: BracketEstimate
  manabase: Manabase
  role_diagnostics: RoleDiagnostic[]
}

export interface SimulationMetrics {
  iterations: number
  commander: string | null
  keep_seven_rate: number
  avg_mulligans: number
  avg_opening_lands: number
  avg_commander_turn: number | null
  commander_cast_rate: number
  commander_cast_by_turn: Record<string, number>
  avg_mana_by_turn: Record<string, number>
  color_screw_rate: number
}

export interface SimulationResponse {
  metrics: SimulationMetrics
  sample_opening: {
    mulligans: number
    kept: boolean
    lands_in_hand: number
    hand: Card[]
    draws: Card[]
  }
}

export interface SuggestionCandidate extends Pick<Card,
  "scryfall_id" | "name" | "name_fr" | "price_eur" | "image_uri" | "image_downloaded" | "type_line" | "mana_cost"> {
  edhrec_rank: number | null
}

export interface Suggestions {
  error?: string
  format: DeckFormat
  max_price_eur: number
  target_bracket: number | null
  diagnostics: RoleDiagnostic[]
  manabase: Manabase
  to_add: { role: string; label: string; missing: number; reason: string; candidates: SuggestionCandidate[] }[]
  /** `card` est nul quand le retrait n'a pas de carte à désigner — un combo
   *  dont les deux moitiés sont des commandants ne se casse pas. */
  to_cut: { card: Pick<Card, "scryfall_id" | "name" | "name_fr" | "price_eur" | "image_uri" | "image_downloaded"> | null; reason: string }[]
}

export interface MatchupAxis {
  label: string
  a: number | null
  b: number | null
  winner: "a" | "b" | null
  /** Sur certains axes (tour du commandant, blocage de couleurs) plus bas est meilleur. */
  lower_is_better: boolean
  hint: string
}

export interface MatchupProfile {
  deck_id: number
  name: string
  bracket: BracketEstimate
  manabase: Manabase
  role_counts: Record<string, number>
  interaction_count: number
  simulation: SimulationMetrics
}

/** Part des parties où chaque deck démarre en premier — pas un taux de victoire. */
export interface Initiative {
  a: number | null
  b: number | null
  tie: number | null
  iterations: number
}

/** Duel joué coup par coup : combat modélisé, moteurs et combos non modélisés. */
export interface DuelResult {
  iterations: number
  starting_life: number
  win_rate_a: number
  win_rate_b: number
  unfinished_rate: number
  avg_turns: number
  decided: number
}

export interface Matchup {
  a: MatchupProfile
  b: MatchupProfile
  axes: MatchupAxis[]
  wins: { a: number; b: number }
  initiative: Initiative
  duel: DuelResult
  verdict: string
}

export interface CollectionEntry extends Card {
  quantity: number
  updated_at: string
}

export interface CollectionStats {
  distinct_cards: number
  total_cards: number
  total_value_eur: number
}

export interface CollectionImportResult {
  added_distinct: number
  added_total: number
  skipped_basic_lands: number
  issues: ImportIssue[]
}

/** Carte candidate enrichie du statut de possession. */
export interface OwnedCandidate extends SuggestionCandidate {
  oracle_id: string
  owned_quantity: number
  free_to_use: boolean
  categories: string[]
}

export interface ShoppingItem {
  scryfall_id: string
  oracle_id: string
  name: string
  name_fr: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  quantity: number
  decks: string[]
  motif: string
  total_eur: number
}

export interface BalancePlan {
  deck_id: number
  name: string
  bracket: BracketEstimate
  cuts: { card: Pick<Card, "scryfall_id" | "name" | "name_fr" | "price_eur"> | null; reason: string }[]
  adds: { role: string; label: string; missing: number; reason: string; candidates: OwnedCandidate[] }[]
  free_picks: number
  purchases_cost_eur: number
}

export interface BalanceResult {
  error?: string
  target_bracket: number
  spread: { min: number; max: number; gap: number }
  allocation: {
    decks: { deck_id: number; name: string; owned_count: number; to_buy_count: number; to_buy_cost_eur: number }[]
    shopping_list: ShoppingItem[]
    total_cost_eur: number
  }
  plans: BalancePlan[]
  shopping_list: ShoppingItem[]
  total_cost_eur: number
  max_price_eur: number
}

export interface ImportDeckResult {
  deck_id: number
  commander_resolved: boolean
  import_issues: ImportIssue[]
  /** Renseigné seulement si l'import a aussi alimenté la collection. */
  collection: {
    added_distinct: number
    added_total: number
    skipped_basic_lands: number
  } | null
}

// --- Endpoints ---

export const decksApi = {
  list: () => apiFetch<DeckSummary[]>("/decks"),
  get: (id: number) => apiFetch<DeckDetail>(`/decks/${id}`),
  import: (
    name: string,
    decklist: string,
    format: DeckFormat = "commander",
    addToCollection = false,
  ) =>
    apiFetch<ImportDeckResult>("/decks", {
      method: "POST",
      body: { name, decklist, format, add_to_collection: addToCollection },
    }),
  update: (id: number, changes: { name?: string; format?: DeckFormat; commander_scryfall_id?: string }) =>
    apiFetch<DeckSummary>(`/decks/${id}`, { method: "PATCH", body: changes }),
  remove: (id: number) => apiFetch<void>(`/decks/${id}`, { method: "DELETE" }),
  addCard: (id: number, card: { scryfall_id: string; quantity?: number; is_commander?: boolean; resolves_raw_line?: string }) =>
    apiFetch<{ status: string }>(`/decks/${id}/cards`, { method: "POST", body: card }),
  removeCard: (id: number, scryfallId: string) =>
    apiFetch<void>(`/decks/${id}/cards/${scryfallId}`, { method: "DELETE" }),
  simulation: (id: number, seed = 0) =>
    apiFetch<SimulationResponse>(`/decks/${id}/simulation?seed=${seed}`),
  suggestions: (id: number, maxPrice = 50, targetBracket?: number) =>
    apiFetch<Suggestions>(
      `/decks/${id}/suggestions?max_price=${maxPrice}` +
      (targetBracket ? `&target_bracket=${targetBracket}` : "")
    ),
}

export const cardsApi = {
  search: (query: string) => apiFetch<Card[]>(`/cards/search?q=${encodeURIComponent(query)}`),
}

export const matchupApi = {
  compare: (a: number, b: number) => apiFetch<Matchup>(`/matchup?a=${a}&b=${b}`),
}

export const collectionApi = {
  list: (search?: string) =>
    apiFetch<{ cards: CollectionEntry[]; stats: CollectionStats }>(
      `/collection${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  importBulk: (cards: string) =>
    apiFetch<CollectionImportResult>("/collection/import", { method: "POST", body: { cards } }),
  add: (scryfall_id: string, quantity = 1) =>
    apiFetch<{ status: string }>("/collection", { method: "POST", body: { scryfall_id, quantity } }),
  setQuantity: (oracleId: string, quantity: number) =>
    apiFetch<{ status: string }>(`/collection/${oracleId}`, { method: "PATCH", body: { quantity } }),
  remove: (oracleId: string) => apiFetch<void>(`/collection/${oracleId}`, { method: "DELETE" }),
}

export interface DeckIdeaCard {
  scryfall_id: string
  oracle_id: string
  name: string
  name_fr: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  /** Part des decks de ce commandant qui jouent la carte, d'après EDHREC. */
  inclusion_rate: number | null
  game_changer: boolean
}

export interface DeckIdea {
  commander: {
    oracle_id: string
    scryfall_id: string
    name: string
    name_fr: string | null
    color_identity: string[]
    image_uri: string | null
    image_downloaded: boolean
  }
  /** Répartition des decks par bracket observée sur EDHREC. */
  bracket_counts: Record<string, number> | null
  core_size: number
  owned_count: number
  coverage: number
  to_buy_count: number
  to_buy_cost_eur: number
  over_budget_count: number
  to_buy: DeckIdeaCard[]
  owned: DeckIdeaCard[]
}

export interface DeckIdeas {
  error?: string
  max_price_eur: number
  nonland_core: number
  ideas: DeckIdea[]
}

export const deckIdeasApi = {
  list: (maxPrice = 50) => apiFetch<DeckIdeas>(`/deck-ideas?max_price=${maxPrice}`),
}

/** Carte du noyau d'un deck planifié : possédée ou à acheter. */
export interface PlannedCard {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  inclusion_rate: number | null
  game_changer: boolean
  owned: boolean
  /** Rôle sur lequel la carte a été retenue (`null` = simple carte de noyau). */
  role: string | null
}

export interface LandPlan {
  owned_nonbasic: PlannedCard[]
  /** Terrains de base par nom français — gratuits, donc jamais dans les achats. */
  basics: Record<string, number>
  total: number
}

/**
 * Un commandant dans le tableau de comparaison : des totaux, sans le détail
 * carte par carte (le back ne le renvoie que pour les decks retenus).
 */
export interface CommanderComparison {
  commander: DeckPlan["commander"]
  core_size: number
  pool_size: number
  owned_count: number
  to_buy_count: number
  cost_eur: number
  role_counts: Record<string, number>
  role_targets: Record<string, string>
  role_gap: number
  bracket: BracketEstimate
  avg_inclusion: number
}

export interface DeckPlan {
  commander: {
    oracle_id: string
    scryfall_id: string
    name: string
    name_fr: string | null
    color_identity: string[]
    image_uri: string | null
    image_downloaded: boolean
    /** Deck déjà importé avec ce commandant, le cas échéant. */
    existing_deck_id: number | null
  }
  core: PlannedCard[]
  core_size: number
  pool_size: number
  owned_count: number
  to_buy: PlannedCard[]
  to_buy_count: number
  cost_eur: number
  role_counts: Record<string, number>
  role_targets: Record<string, string>
  /** Somme des cartes manquantes pour atteindre les planchers de rôle. */
  role_gap: number
  bracket: BracketEstimate
  avg_inclusion: number
  lands: LandPlan
}

export interface DeckPlanSelection {
  target_bracket: number
  plans: DeckPlan[]
  shopping_list: ShoppingItem[]
  total_cost_eur: number
  missing_count: number
  role_gap: number
  brackets: number[]
}

export interface DeckPlansResult {
  error?: string
  core_size: number
  land_slots: number
  decks_to_build: number
  max_price_eur: number
  commanders_compared: number
  selection_forced: boolean
  commanders: CommanderComparison[]
  selection: DeckPlanSelection | null
  incomplete: boolean
}

export const deckPlansApi = {
  /** Sans `commanders`, le back choisit lui-même le meilleur groupe de quatre. */
  build: (maxPrice = 50, targetBracket?: number, commanders?: string[]) =>
    apiFetch<DeckPlansResult>(
      `/deck-plans?max_price=${maxPrice}` +
      (targetBracket ? `&target_bracket=${targetBracket}` : "") +
      (commanders?.length ? `&commanders=${commanders.join(",")}` : "")
    ),
}

export const balanceApi = {
  /** L'ordre des ids fixe la priorité d'attribution des exemplaires possédés. */
  run: (deckIds: number[], maxPrice = 50, targetBracket?: number) =>
    apiFetch<BalanceResult>(
      `/balance?decks=${deckIds.join(",")}&max_price=${maxPrice}` +
      (targetBracket ? `&target_bracket=${targetBracket}` : "")
    ),
}

// --- Construction compétitive ------------------------------------------------

export type CompetitiveFormat = "commander" | "duel"

export interface CompetitiveCommander {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  color_identity: string[]
  mana_cost: string | null
  image_uri: string | null
  image_downloaded: boolean
  game_changer: boolean
  /**
   * L'archétype dont la collection couvre la plus grande part : ce qui classe
   * la grille. Nul tant que la synchronisation EDHREC n'a pas tourné.
   */
  best_theme: {
    slug: string
    label: string
    /** Somme des taux d'inclusion des 63 meilleures cartes possédées : ce qui classe. */
    consensus: number
    cards_usable: number
    /** Part de l'optimum de cet archétype. 99 % d'une référence molle vaut moins que 93 % d'une forte. */
    score: number
    deck_count: number
  } | null
}

export interface CompetitiveTheme {
  slug: string
  label: string
  /** Nombre de decks recensés par EDHREC sur cet archétype. */
  deck_count: number
  cards_legal: number
  cards_owned: number
  /** Part du vivier de l'archétype déjà en collection, de 0 à 1. */
  coverage: number
}

export interface CompetitiveCard {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  mana_cost: string | null
  cmc: number | null
  type_line: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  categories: string[]
  color_identity: string[]
  game_changer: boolean
  edhrec_rank: number | null
  owned: boolean
  /** Part des decks de cet archétype qui jouent la carte. */
  theme_rate: number
  commander_rate: number
}

export interface CompetitiveBuild {
  commander: CompetitiveCard
  theme: { slug: string; label: string; deck_count: number }
  format: CompetitiveFormat
  cards: CompetitiveCard[]
  lands: { nonbasic: CompetitiveCard[]; basics: Record<string, number>; total: number }
  counts: {
    total: number
    nonland: number
    nonland_target: number
    lands: number
    owned: number
    missing: number
  }
  /** Courbe visée (celle des decks réels de l'archétype) et courbe obtenue. */
  curve: { target: Record<string, number>; achieved: Record<string, number> }
  type_targets: Record<string, number>
  type_achieved: Record<string, number>
  /** Chaque achat désigne la carte qu'il remplace. */
  upgrades: { buy: CompetitiveCard; replace: CompetitiveCard; price_eur: number }[]
  pool_size: number
}

export const competitiveApi = {
  commanders: () =>
    apiFetch<{ commanders: CompetitiveCommander[] }>("/competitive/commanders"),
  themes: (commander: string, format: CompetitiveFormat) =>
    apiFetch<{ themes: CompetitiveTheme[]; error?: string }>(
      `/competitive/themes?commander=${commander}&format=${format}`
    ),
  build: (commander: string, theme: string, format: CompetitiveFormat, maxPrice = 50) =>
    apiFetch<CompetitiveBuild>(
      `/competitive/build?commander=${commander}&theme=${encodeURIComponent(theme)}` +
      `&format=${format}&max_price=${maxPrice}`
    ),
}

// --- Liste de recherche ------------------------------------------------------

export interface WishlistEntry extends Card {
  quantity: number
  /** Pourquoi on la cherche : « remplace Birds of Paradise dans Atraxa ». */
  note: string | null
  added_at: string
  /** Exemplaires déjà en collection : une carte peut être cherchée en plus. */
  owned_quantity: number
}

export interface WishlistStats {
  distinct_cards: number
  total_cards: number
  total_price_eur: number
  /** Cartes sans prix non-foil connu : elles ne sont pas dans le total. */
  unknown_price: number
}

export const wishlistApi = {
  list: () => apiFetch<{ cards: WishlistEntry[]; stats: WishlistStats }>("/wishlist"),
  add: (scryfall_id: string, quantity = 1, note?: string) =>
    apiFetch<{ status: string }>("/wishlist", {
      method: "POST",
      body: { scryfall_id, quantity, note },
    }),
  importBulk: (cards: string, note?: string) =>
    apiFetch<CollectionImportResult>("/wishlist/import", { method: "POST", body: { cards, note } }),
  setQuantity: (oracleId: string, quantity: number) =>
    apiFetch<{ status: string }>(`/wishlist/${oracleId}`, { method: "PATCH", body: { quantity } }),
  /** L'achat est fait : la carte rejoint la collection, en tout ou en partie. */
  acquire: (oracleId: string, quantity?: number) =>
    apiFetch<{ moved: number; remaining: number }>(
      `/wishlist/${oracleId}/acquire${quantity ? `?quantity=${quantity}` : ""}`,
      { method: "POST" }
    ),
}
