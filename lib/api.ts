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
  /** Non nul quand le deck est rangé : il sort des écrans qui parlent de jeu. */
  archived_at?: string | null
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
  /**
   * Les étapes d'exécution, une par ligne. « Infinite damage » ne dit pas quelle
   * carte lancer en premier : sans elles, la fiche annonce un combo que le
   * joueur ne sait pas jouer.
   */
  description: string | null
  /** Ce qu'il faut avoir en place avant de lancer. */
  prerequisites: string | null
}

/**
 * Une carte du deck qu'EDHREC voit particulièrement associée au commandant.
 *
 * La synergie n'est pas la popularité : c'est l'écart entre « jouée avec ce
 * commandant » et « jouée dans cette couleur en général ». Sol Ring est
 * partout, donc synergique avec personne.
 */
export interface DeckSynergy {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  type_line: string | null
  mana_cost: string | null
  image_uri: string | null
  image_downloaded: boolean
  synergy: number
  inclusion_rate: number | null
  section: string | null
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
  /**
   * Vide quand le commandant n'a pas de données EDHREC : il n'est pas dans la
   * collection, ou la synchronisation n'a pas encore tourné.
   */
  synergies: DeckSynergy[]
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
  "scryfall_id" | "oracle_id" | "name" | "name_fr" | "price_eur" | "image_uri" | "image_downloaded" | "type_line" | "mana_cost"> {
  edhrec_rank: number | null
  /**
   * Exemplaires **déjà** dans la liste de recherche. Les quantités s'y
   * additionnent : sans ce compte, un second clic en demanderait un second
   * sans rien dire.
   */
  wanted_quantity: number
}

/** Carte refusée pour ce deck : « ne me la propose plus ». */
export interface IgnoredCard extends Card {
  reason: string | null
  created_at: string
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
  to_cut: { card: Pick<Card, "scryfall_id" | "oracle_id" | "name" | "name_fr" | "price_eur" | "image_uri" | "image_downloaded"> | null; reason: string }[]
  /**
   * Les cartes refusées pour ce deck, avec de quoi les afficher et annuler.
   * Elles voyagent avec les conseils parce que c'est le seul écran d'où on
   * peut revenir dessus — une liste invisible serait un piège.
   */
  ignored: IgnoredCard[]
  ignored_count: number
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
  /**
   * Vide quand le commandant n'a pas de données EDHREC : il n'est pas dans la
   * collection, ou la synchronisation n'a pas encore tourné.
   */
  synergies: DeckSynergy[]
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
  /** Exemplaires déjà dans la liste de recherche — voir `SuggestionCandidate`. */
  wanted_quantity: number
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
  list: (archived = false) =>
    apiFetch<DeckSummary[]>(`/decks${archived ? "?archived=true" : ""}`),
  /** Range un deck ou le remet en service. Aucune carte n'est touchée. */
  archive: (id: number, archived = true) =>
    apiFetch<DeckSummary>(`/decks/${id}/archive?archived=${archived}`, { method: "POST" }),
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
  /** « Ne me propose plus cette carte pour ce deck. » Idempotent. */
  ignore: (id: number, oracle_id: string, reason?: string) =>
    apiFetch<{ status: string }>(`/decks/${id}/ignored`, {
      method: "POST",
      body: { oracle_id, reason },
    }),
  unignore: (id: number, oracleId: string) =>
    apiFetch<void>(`/decks/${id}/ignored/${oracleId}`, { method: "DELETE" }),
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
  /** Sert à ranger la liste par section — à l'écran comme dans l'export PDF. */
  type_line: string | null
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  /** Part des decks de ce commandant qui jouent la carte, d'après EDHREC. */
  inclusion_rate: number | null
  game_changer: boolean
  /** Rôles calculés : servent à remplacer une carte par une autre du même rôle. */
  categories: string[]
  edhrec_rank: number | null
  owned_quantity: number
  /** Exemplaires déjà dans la liste de recherche : le bouton se désactive. */
  wanted_quantity: number
}

/** Une carte du noyau proposé, avec le fait qu'on la possède ou non. */
export interface DeckIdeaCoreCard extends DeckIdeaCard {
  owned: boolean
}

export interface DeckIdeaDetail {
  combos: TwoCardCombo[]
  /** Mesurée contre tous les decks du commandant : cette liste n'a pas de thème. */
  synergies: DeckSynergy[]
  commander: DeckIdea["commander"]
  format: string
  max_price_eur: number
  nonland_core: number
  /** Le deck existe déjà : inutile de proposer de le monter. */
  existing_deck_id: number | null
  core: DeckIdeaCoreCard[]
  /**
   * Cartes possédées, hors noyau, utilisables avec ce commandant. Le
   * remplacement se fait côté navigateur à partir de ce vivier : instantané,
   * réversible, et rien n'est écrit tant qu'on n'a pas décidé que le deck
   * existe.
   */
  substitutes: DeckIdeaCard[]
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
  detail: (commanderOracleId: string, maxPrice = 50) =>
    apiFetch<DeckIdeaDetail>(`/deck-ideas/${commanderOracleId}?max_price=${maxPrice}`),
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
  /** Mode « sans achat » : rien n'entre dans les decks qui ne soit déjà possédé. */
  owned_only: boolean
  /** Les decks déjà enregistrés gardent leurs cartes : elles ne resservent pas ici. */
  reserve_existing_decks: boolean
  /**
   * Vrai quand `commanders` montre les candidats évalués **sur ce qu'il reste**
   * après les commandants déjà choisis, et non montés seuls sur la collection
   * entière. Les deux lectures ne se comparent pas.
   */
  after_selection: boolean
  /** Places encore à pourvoir dans le groupe de quatre. */
  remaining_slots: number
  commanders_compared: number
  selection_forced: boolean
  commanders: CommanderComparison[]
  selection: DeckPlanSelection | null
  incomplete: boolean
}

/** Ce que la création a écrit en base — et ce qu'elle a refusé d'écrire. */
export interface CreatedDecks {
  created: { deck_id: number; name: string; card_count: number }[]
  /** Commandants qui avaient déjà un deck : ignorés plutôt que dupliqués. */
  skipped: { name: string; deck_id: number }[]
  missing_basics: string[]
}

export const deckPlansApi = {
  /** Sans `commanders`, le back choisit lui-même le meilleur groupe de quatre. */
  build: (
    maxPrice = 50,
    targetBracket?: number,
    commanders?: string[],
    ownedOnly = false,
    reserveExistingDecks = true
  ) =>
    apiFetch<DeckPlansResult>(
      `/deck-plans?max_price=${maxPrice}` +
      (targetBracket ? `&target_bracket=${targetBracket}` : "") +
      (commanders?.length ? `&commanders=${commanders.join(",")}` : "") +
      (ownedOnly ? "&owned_only=true" : "") +
      (reserveExistingDecks ? "" : "&reserve_existing_decks=false")
    ),
  /**
   * Enregistre les decks proposés. Le back **recalcule** le groupe à partir des
   * commandants : la decklist n'est pas envoyée d'ici, elle serait une seconde
   * vérité à vérifier.
   */
  create: (
    commanders: string[],
    maxPrice = 50,
    targetBracket?: number,
    ownedOnly = false,
    reserveExistingDecks = true
  ) =>
    apiFetch<CreatedDecks>("/deck-plans/create", {
      method: "POST",
      body: {
        commanders,
        max_price: maxPrice,
        target_bracket: targetBracket ?? null,
        owned_only: ownedOnly,
        reserve_existing_decks: reserveExistingDecks,
      },
    }),
}

// --- Atelier de construction --------------------------------------------------

/** Une carte du vivier : ce que la collection permet de mettre dans ce deck. */
export interface BuildPoolCard extends Pick<Card,
  "scryfall_id" | "oracle_id" | "name" | "name_fr" | "mana_cost" | "cmc" | "type_line" |
  "color_identity" | "price_eur" | "image_uri" | "image_downloaded" | "categories" |
  "game_changer" | "edhrec_rank"> {
  owned_quantity: number
  wanted_quantity: number
  /** Part des decks de ce commandant qui jouent la carte. Nul si EDHREC l'ignore. */
  inclusion_rate: number | null
}

/** Une ligne du brouillon : une carte et son nombre d'exemplaires. */
export interface DraftEntry {
  card: Pick<Card, "scryfall_id" | "oracle_id" | "name" | "name_fr" | "type_line" |
    "image_uri" | "image_downloaded" | "cmc" | "price_eur"> & { categories?: string[] }
  quantity: number
}

export interface BuildLands {
  owned_nonbasic: BuildPoolCard[]
  basics: Record<string, number>
  /** Les basiques avec leur impression : le conseil ne les nomme pas, il les pose. */
  basics_cards: (BuildPoolCard & { quantity: number })[]
  total: number
}

export interface BuildEvaluation {
  counts: { total: number; lands: number; distinct: number }
  mana_curve: Record<string, number>
  total_price_eur: number
  legality_warnings: LegalityWarning[]
  bracket: BracketEstimate
  manabase: Manabase
  role_diagnostics: RoleDiagnostic[]
  synergies: DeckSynergy[]
}

type DraftPayload = {
  format: DeckFormat
  commander_scryfall_id: string | null
  cards: { scryfall_id: string; quantity: number }[]
}

export const buildApi = {
  /** Le classeur : les commandants possédés, légaux dans ce format. */
  commanders: (format: DeckFormat) =>
    apiFetch<{ commanders: Card[] }>(`/build/commanders?format=${format}`),
  pool: (commanderOracleId: string, format: DeckFormat) =>
    apiFetch<{ commander: Card; cards: BuildPoolCard[] }>(
      `/build/pool?commander=${commanderOracleId}&format=${format}`
    ),
  lands: (draft: DraftPayload, commanderOracleId: string, slots: number) =>
    apiFetch<BuildLands>("/build/lands", {
      method: "POST",
      body: { ...draft, commander_oracle_id: commanderOracleId, slots },
    }),
  evaluate: (draft: DraftPayload) =>
    apiFetch<BuildEvaluation>("/build/evaluate", { method: "POST", body: draft }),
  compare: (draft: DraftPayload, deckId: number, name: string) =>
    apiFetch<Matchup>("/build/compare", {
      method: "POST",
      body: { ...draft, deck_id: deckId, name },
    }),
  /** Le seul appel qui écrit : sans ce clic, le brouillon n'existe pas côté serveur. */
  save: (draft: DraftPayload, name: string) =>
    apiFetch<{ deck_id: number; name: string }>("/build/save", {
      method: "POST",
      body: { ...draft, name },
    }),
}

// --- Terrains budget, par cycle ------------------------------------------------

/** Une vidéo qui conseille ce cycle, et le moment où elle en parle. */
export interface VideoAdvice {
  video_id: string
  title: string
  channel: string | null
  url: string
  mentions: number
  first_seconds: number | null
}

export interface BudgetLandCard extends Pick<Card,
  "oracle_id" | "scryfall_id" | "name" | "name_fr" | "type_line" | "price_eur" |
  "image_uri" | "image_downloaded" | "produced_mana" | "color_identity" | "edhrec_rank"> {
  owned_quantity: number
  wanted_quantity: number
  /** Decks actifs qui la jouent déjà — les archivés ne comptent pas. */
  decks: number
}

export interface LandCycle {
  key: string
  label: string
  condition: string
  cards: BudgetLandCard[]
  owned: number
  missing_cost_eur: number
  videos: VideoAdvice[]
}

export interface BudgetLands {
  identity: string[]
  max_price_eur: number
  format: DeckFormat
  cycles: LandCycle[]
  /** Terrains utiles mais sans famille : utilitaires, arc-en-ciel, fetchlands. */
  other_count: number
  totals: { cards: number; owned: number; missing_cost_eur: number }
}

export const budgetLandsApi = {
  byIdentity: (identity: string[], maxPrice = 2, format: DeckFormat = "commander") =>
    apiFetch<BudgetLands>(
      `/budget-lands?identity=${identity.join("")}&max_price=${maxPrice}&format=${format}`
    ),
  byDeck: (deckId: number, maxPrice = 2, format: DeckFormat = "commander") =>
    apiFetch<BudgetLands>(`/budget-lands?deck=${deckId}&max_price=${maxPrice}&format=${format}`),
}

export interface VideoSource {
  video_id: string
  title: string
  channel: string | null
  url: string
  language: string | null
  auto_generated: boolean
  fetched_at: string
  cards: number
  cycles: number
}

export const videosApi = {
  list: () => apiFetch<{ videos: VideoSource[] }>("/videos"),
}

// --- Performance mesurée ------------------------------------------------------

/** Un archétype mesuré, ou le commandant lui-même quand `theme_slug` est vide. */
export interface PerformanceRow {
  theme_slug: string
  theme_label: string | null
  /** Part des parties gagnées contre le panel. Les nulles sont au dénominateur. */
  win_rate: number
  games: number
  unfinished_rate: number
  avg_turns: number | null
  core_size: number
  role_gap: number
  bracket: number | null
}

export interface PerformanceCommander extends PerformanceRow {
  commander_oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  image_uri: string | null
  image_downloaded: boolean
  color_identity: string[]
  existing_deck_id: number | null
  /** Tous ses archétypes mesurés, le meilleur d'abord. Vide si non mesurés. */
  themes: PerformanceRow[]
}

export interface PerformanceRanking {
  commanders: PerformanceCommander[]
  /** Les decks affrontés : un score ne se compare qu'à panel égal. */
  panel: string | null
  computed_at: string | null
  /** Parties jouées par commandant, panel entier confondu. */
  games: number | null
}

export const performanceApi = {
  ranking: (limit = 10) => apiFetch<PerformanceRanking>(`/performance?limit=${limit}`),
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

/** Ce qu'un commandant peut monter d'un archétype, avec la collection. */
export interface CompetitiveThemeScore {
  slug: string
  label: string
  /** Somme des taux d'inclusion des 63 meilleures cartes possédées : ce qui classe. */
  consensus: number
  cards_usable: number
  /** Part de l'optimum de cet archétype. 99 % d'une référence molle vaut moins que 93 % d'une forte. */
  score: number
  deck_count: number
}

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
   * L'archétype dont la collection couvre la plus grande part. Nul tant que la
   * synchronisation EDHREC n'a pas tourné.
   */
  best_theme: CompetitiveThemeScore | null
  /**
   * L'archétype demandé à l'étape facultative, quand il y en a un : c'est lui
   * qui classe alors la grille. Nul sinon — et il peut différer de
   * `best_theme`, auquel cas l'écran le signale sans l'imposer.
   */
  selected_theme: CompetitiveThemeScore | null
}

/** Un archétype montable avec la collection, à l'étape facultative. */
export interface CompetitiveArchetype {
  slug: string
  label: string
  /** Combien de commandants possédés le jouent. */
  commanders: number
  /** Decks recensés par EDHREC **chez ces commandants**, pas dans le format. */
  deck_count: number
  /** Le commandant qui en monte le plus avec la collection. */
  best: CompetitiveThemeScore & {
    oracle_id: string
    name: string
    name_fr: string | null
  }
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
  /** Exemplaires déjà dans la liste de recherche — voir `SuggestionCandidate`. */
  wanted_quantity: number
  /** Part des decks de cet archétype qui jouent la carte. */
  theme_rate: number
  commander_rate: number
}

export interface CompetitiveBuild {
  combos: TwoCardCombo[]
  /** Mesurée contre les decks de l'archétype choisi, pas contre tous ceux du commandant. */
  synergies: DeckSynergy[]
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
  archetypes: (format: CompetitiveFormat) =>
    apiFetch<{ archetypes: CompetitiveArchetype[] }>(`/competitive/archetypes?format=${format}`),
  commanders: (format = "commander", theme?: string | null) =>
    apiFetch<{ commanders: CompetitiveCommander[]; theme: string | null }>(
      `/competitive/commanders?format=${format}` +
      (theme ? `&theme=${encodeURIComponent(theme)}` : "")
    ),
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

// --- Archétypes du format ----------------------------------------------------

/** Une ligne du catalogue : ce que le format joue, et si on peut s'y mettre. */
export interface ArchetypeSummary {
  slug: string
  label: string
  /** Decks recensés par EDHREC sur cet archétype, tous commandants confondus. */
  deck_count: number
  commanders: number
  /** Combien de ces commandants sont dans la collection. */
  owned_commanders: number
  /** Écrit à la main, nul pour un archétype non décrit. */
  principle: string | null
  /** Mots par lesquels on cherche l'archétype (« superfriends » → Planeswalkers). */
  aliases: string[]
}

/** Le texte de l'article : d'un joueur, jamais d'une mesure. */
export interface ArchetypeNote {
  principle: string
  wins: string
  watch: string
  aliases: string[]
}

/** Les colonnes renvoyées par `db/archetypes.CARD_COLUMNS`, rien de plus. */
export interface ArchetypeCardBase {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  type_line: string | null
  mana_cost: string | null
  cmc: number | null
  color_identity: string[]
  price_eur: number | null
  image_uri: string | null
  image_downloaded: boolean
  categories: string[]
  game_changer: boolean
  edhrec_rank: number | null
  owned_quantity: number
  wanted_quantity: number
}

export interface ArchetypeCommander extends ArchetypeCardBase {
  /** Decks de ce commandant dans l'archétype, et decks de l'archétype en tout. */
  num_decks: number
  potential_decks: number
  /**
   * Cartes de l'archétype jouables dans son identité de couleur, plafonnées aux
   * créneaux du noyau. En dessous de `core_slots`, l'archétype n'a pas assez de
   * cartes dans ces couleurs — ce n'est pas un manque de la collection.
   */
  core_size: number
  core_owned: number
  /** Prix des cartes du noyau qui manquent. Les cartes sans prix n'y sont pas. */
  missing_price: number
  unknown_price: number
  /** Ce qui manque au-dessus du plafond : trois pièces chères ≠ soixante à 5 €. */
  over_cap_cards: number
  over_cap_price: number
}

export interface ArchetypeCard extends ArchetypeCardBase {
  /** La rubrique d'EDHREC qui cite la carte : c'est elle qui dit pourquoi. */
  section: string
  /** Écart avec « jouée dans cette couleur en général ». Négative = moins jouée ici. */
  synergy: number | null
  /** Part des decks **qui pouvaient la jouer** et qui la jouent. */
  inclusion_rate: number | null
}

export interface ArchetypeDetail {
  archetype: { slug: string; label: string; deck_count: number; fetched_at: string }
  note: ArchetypeNote | null
  commanders: ArchetypeCommander[]
  cards: ArchetypeCard[]
  core_slots: number
  headline_sections: string[]
  max_price: number
  format: CompetitiveFormat
}

export const archetypesApi = {
  list: (format: CompetitiveFormat = "commander") =>
    apiFetch<{ archetypes: ArchetypeSummary[]; documented: number; error: string | null }>(
      `/archetypes?format=${format}`
    ),
  get: (slug: string, format: CompetitiveFormat = "commander", maxPrice = 50) =>
    apiFetch<ArchetypeDetail>(
      `/archetypes/${encodeURIComponent(slug)}?format=${format}&max_price=${maxPrice}`
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

// --- Cartes à avoir -------------------------------------------------------

/** Une carte du classement, possédée ou à acheter sous le plafond. */
export interface MustHaveCard {
  oracle_id: string
  scryfall_id: string
  name: string
  name_fr: string | null
  type_line: string
  mana_cost: string | null
  cmc: number
  price_eur: number | null
  edhrec_rank: number
  image_uri: string | null
  image_downloaded: boolean
  color_identity: string[]
  /** Exemplaires en collection. 0 = à acheter. */
  owned: number
  /**
   * Exemplaires déjà dans la liste de recherche. Les quantités s'additionnent
   * en base : sans cet état affiché, un second clic demanderait un second
   * exemplaire sans rien dire.
   */
  wanted: number
}

export interface MustHaveGroup {
  key: string
  label: string
  /** Taille visée du classement : 50, sauf 30 pour les planeswalkers. */
  top: number
  cards: MustHaveCard[]
  owned_count: number
  to_buy_count: number
  /**
   * Cartes du classement écartées faute de tenir sous le plafond. Comptées et
   * non listées : la liste reste une liste d'achats sans se faire passer pour
   * un classement complet.
   */
  over_budget: number
}

export interface MustHave {
  format: string
  max_price_eur: number
  groups: MustHaveGroup[]
}

export const mustHaveApi = {
  list: (format = "commander", maxPrice = 50) =>
    apiFetch<MustHave>(`/must-have?format=${format}&max_price=${maxPrice}`),
}

// --- Récapitulatif de collection ------------------------------------------

export interface CoverageGroup {
  key: string
  label: string
  /** Taille réelle du classement : les Batailles sont moins de 50 en tout. */
  listed: number
  /** Taille visée (50, ou 30 pour les planeswalkers). */
  target: number
  owned: number
  cards: MustHaveCard[]
}

export interface RankBand {
  label: string
  cards: number
  copies: number
}

export interface CollectionCoverage {
  format: string
  stats: CollectionStats
  groups: CoverageGroup[]
  rank_distribution: RankBand[]
}

export const coverageApi = {
  /**
   * Sans plafond de prix, contrairement à `mustHaveApi` : la question est
   * « où en est ma collection », pas « qu'est-ce que je peux acheter ».
   */
  get: (format = "commander") =>
    apiFetch<CollectionCoverage>(`/collection/coverage?format=${format}`),
}
