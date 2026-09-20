import type { jsPDF } from "jspdf"
import {
  ROLE_LABELS,
  basicSwapWorthwhile,
  displayName,
  type BracketEstimate,
  type DeckSynergy,
  type LegalityWarning,
  type Manabase,
  type RoleDiagnostic,
  type TwoCardCombo,
} from "@/lib/api"
import { CONTENT_WIDTH, INK, LINE_HEIGHT, MARGIN, PageFlow, fit } from "@/lib/pdf-page"

/**
 * Ce qu'on dit du deck, en plus de ce qu'il contient.
 *
 * Une decklist imprimée répond à « qu'est-ce qu'il y a dedans » ; elle ne dit
 * pas pourquoi le deck est bracket 3, quelle couleur le fait rester en main,
 * ni comment s'exécute le combo qu'il embarque. Ce sont exactement les
 * chiffres que l'écran affiche déjà — ils sont **repris tels quels**, jamais
 * recalculés ici : un PDF qui compterait de son côté finirait par contredire
 * la fiche.
 *
 * Tous les champs sont facultatifs parce que les écrans n'en savent pas
 * autant les uns que les autres : `/deck-ideas` propose un noyau sans
 * manabase, donc sans bracket ni diagnostic de couleurs. Une section absente
 * n'est pas dessinée, plutôt que dessinée vide.
 *
 * La feuille de tournoi, elle, n'en reçoit jamais rien : un arbitre vérifie
 * des cartes, le reste l'encombrerait.
 */
export type DeckPdfAnalysis = {
  bracket?: BracketEstimate | null
  manabase?: Manabase | null
  roles?: RoleDiagnostic[] | null
  manaCurve?: Record<string, number> | null
  totalPriceEur?: number | null
  legalityWarnings?: LegalityWarning[] | null
  /** Par défaut ceux du bracket ; séparés quand l'écran les mesure à part. */
  combos?: TwoCardCombo[] | null
  synergies?: DeckSynergy[] | null
  /** Ce sur quoi porte la synergie : le commandant, ou l'archétype visé. */
  synergySubject?: string
  /** Ce que cette analyse ne couvre pas, écrit en tête de la fiche. */
  caveat?: string
}

/**
 * La forme commune à `DeckDetail` (fiche de deck) et `BuildEvaluation`
 * (atelier, deck compétitif évalué à l'export). Les deux viennent du **même**
 * calcul côté serveur : la fiche PDF n'a donc qu'un seul adaptateur.
 */
type EvaluationLike = {
  bracket: BracketEstimate
  manabase: Manabase
  role_diagnostics: RoleDiagnostic[]
  mana_curve: Record<string, number>
  total_price_eur: number
  legality_warnings: LegalityWarning[]
  synergies: DeckSynergy[]
}

export function deckAnalysis(evaluation: EvaluationLike,
                             extra: Partial<DeckPdfAnalysis> = {}): DeckPdfAnalysis {
  return {
    bracket: evaluation.bracket,
    manabase: evaluation.manabase,
    roles: evaluation.role_diagnostics,
    manaCurve: evaluation.mana_curve,
    totalPriceEur: evaluation.total_price_eur,
    legalityWarnings: evaluation.legality_warnings,
    combos: evaluation.bracket.two_card_combos,
    synergies: evaluation.synergies,
    ...extra,
  }
}

/** Y a-t-il de quoi écrire une fiche, ou seulement une liste ? */
export function hasAnalysis(
  analysis: DeckPdfAnalysis | null | undefined
): analysis is DeckPdfAnalysis {
  if (!analysis) return false
  return Boolean(
    analysis.bracket ||
    analysis.manabase ||
    analysis.roles?.length ||
    analysis.manaCurve ||
    analysis.legalityWarnings?.length ||
    analysis.combos?.length ||
    analysis.synergies?.length
  )
}

const MANA_LABEL: Record<string, string> = {
  W: "blanc", U: "bleu", B: "noir", R: "rouge", G: "vert",
}

const STATUS_LABEL: Record<RoleDiagnostic["status"], string> = {
  ok: "ok",
  insuffisant: "insuffisant",
  excédentaire: "excédentaire",
}

/** Une décimale et la virgule française, comme à l'écran. */
function percent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals).replace(".", ",")} %`
}

function euros(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`
}

// --- Le bandeau de tête -------------------------------------------------------

/**
 * Les quatre chiffres qui situent le deck, en tête de la première page.
 *
 * Ils sont là pour le coup d'œil : le reste de la fiche les explique. Un
 * chiffre absent laisse sa case vide plutôt que d'afficher zéro — « prix
 * inconnu n'est pas prix nul » vaut ici comme partout.
 */
export function drawSummaryBand(doc: jsPDF, analysis: DeckPdfAnalysis, y: number): number {
  const cells: { label: string; value: string }[] = []

  if (analysis.bracket) cells.push({ label: "Bracket", value: analysis.bracket.label })
  if (analysis.totalPriceEur !== null && analysis.totalPriceEur !== undefined) {
    cells.push({ label: "Prix du deck", value: euros(analysis.totalPriceEur) })
  }
  if (analysis.manabase) {
    cells.push({
      label: "Terrains",
      value: `${analysis.manabase.land_count} (repère ${analysis.manabase.recommended_lands})`,
    })
    cells.push({
      label: "Sorts bloqués par la couleur",
      value: analysis.manabase.measured_stuck_rate !== null
        ? percent(analysis.manabase.measured_stuck_rate, 0)
        : `${analysis.manabase.stuck_cards.toFixed(1).replace(".", ",")} carte(s)`,
    })
  }
  if (cells.length === 0) return y

  const height = 13
  const width = CONTENT_WIDTH / cells.length

  doc.setDrawColor(INK.rule)
  doc.setFillColor(248, 248, 248)
  doc.rect(MARGIN, y, CONTENT_WIDTH, height, "F")

  cells.forEach((cell, index) => {
    const x = MARGIN + index * width
    if (index > 0) doc.line(x, y + 2, x, y + height - 2)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(INK.muted)
    doc.text(fit(doc, cell.label, width - 6), x + 3, y + 5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(INK.title)
    doc.text(fit(doc, cell.value, width - 6), x + 3, y + 10.5)
  })

  return y + height + 6
}

// --- La fiche -----------------------------------------------------------------

/**
 * L'analyse, sur ses propres pages : la liste d'abord, ce qu'on en dit
 * ensuite. L'ordre suit celui de la fiche à l'écran, pour qu'on puisse lire
 * les deux côte à côte.
 */
export function drawAnalysis(doc: jsPDF, deckName: string, analysis: DeckPdfAnalysis): void {
  doc.addPage()
  const flow = new PageFlow(doc, MARGIN + 8)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(INK.title)
  doc.text(`${deckName} — analyse`, MARGIN, flow.y)
  flow.y += 6

  if (analysis.caveat) {
    flow.paragraph(analysis.caveat, { size: 8, color: INK.muted })
  }
  flow.gap(2)

  // Les combos viennent du bracket sauf quand l'écran les mesure autrement
  // (le deck compétitif, contre son archétype). Sans ce repli, un appelant qui
  // passe un bracket sans recopier sa liste perdrait la section en silence.
  const combos = analysis.combos ?? analysis.bracket?.two_card_combos ?? []

  if (analysis.manaCurve) drawManaCurve(doc, flow, analysis.manaCurve)
  if (analysis.bracket) drawBracket(flow, analysis.bracket)
  if (analysis.manabase) drawManabase(flow, analysis.manabase)
  if (analysis.roles?.length) drawRoles(flow, analysis.roles)
  if (analysis.legalityWarnings?.length) drawLegality(flow, analysis.legalityWarnings)
  if (combos.length) drawCombos(flow, combos)
  if (analysis.synergies?.length) {
    drawSynergies(flow, analysis.synergies, analysis.synergySubject ?? "le commandant")
  }
}

/**
 * La courbe de mana en barres.
 *
 * Une seule série — un nombre de cartes par coût converti — donc aucune
 * légende à porter : le titre nomme la mesure. Chaque barre écrit sa valeur
 * au-dessus d'elle plutôt que de renvoyer à un axe vertical : huit barres se
 * lisent plus vite ainsi, et cela supprime la grille. Un seul gris, parce
 * qu'un PDF s'imprime en noir et blanc et qu'une teinte n'y distinguerait
 * rien.
 */
function drawManaCurve(doc: jsPDF, flow: PageFlow, curve: Record<string, number>): void {
  const buckets = Object.keys(curve).sort((a, b) => Number(a) - Number(b))
  if (buckets.length === 0) return

  const chartHeight = 24
  flow.heading("Courbe de mana")
  flow.line("Nombre de cartes par coût converti, terrains exclus.",
            { size: 8, color: INK.muted })
  flow.gap(1)
  flow.need(chartHeight + 10)

  const gap = 2
  const width = (CONTENT_WIDTH - gap * (buckets.length - 1)) / buckets.length
  const max = Math.max(1, ...buckets.map((bucket) => curve[bucket] ?? 0))
  const baseline = flow.y + chartHeight

  buckets.forEach((bucket, index) => {
    const value = curve[bucket] ?? 0
    const height = (value / max) * chartHeight
    const x = MARGIN + index * (width + gap)

    if (height > 0) {
      doc.setFillColor(70, 70, 70)
      // Coins adoucis, comme à l'écran ; sous 1,6 mm le rayon mangerait la barre.
      if (height > 1.6) doc.roundedRect(x, baseline - height, width, height, 0.8, 0.8, "F")
      else doc.rect(x, baseline - height, width, height, "F")
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(INK.title)
    doc.text(`${value}`, x + width / 2, baseline - height - 1.5, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(INK.muted)
    doc.text(bucket === "7" ? "7+" : bucket, x + width / 2, baseline + 4, { align: "center" })
  })

  // La ligne de base porte la lecture des hauteurs : au gris des filets de
  // section, elle disparaissait à l'impression.
  doc.setDrawColor(INK.muted)
  doc.line(MARGIN, baseline, MARGIN + CONTENT_WIDTH, baseline)
  flow.y = baseline + 9
}

function drawBracket(flow: PageFlow, bracket: BracketEstimate): void {
  flow.heading(bracket.label)

  for (const reason of bracket.floor_reasons) flow.bullet(reason)
  if (bracket.floor_reasons.length > 0) flow.gap(1)

  flow.line(`${bracket.game_changer_count} carte(s) Game Changer — liste officielle du ` +
            "Commander Format Panel.", { color: INK.muted })
  if (bracket.game_changers.length > 0) {
    flow.paragraph(
      bracket.game_changers
        .map((card) => displayName(card) + (card.is_commander ? " (commandant)" : ""))
        .join(", "),
      { indent: 4, size: 8.5 }
    )
  }

  if (bracket.mass_land_denial.length > 0) {
    flow.gap(1)
    flow.paragraph("Destruction de terrains de masse — interdite jusqu'au bracket 3 inclus, " +
                   "donc suffisante à elle seule pour classer le deck en bracket 4 :",
                   { color: INK.muted })
    flow.paragraph(bracket.mass_land_denial.map(displayName).join(", "),
                   { indent: 4, size: 8.5 })
  }

  if (bracket.extra_turns.length > 0) {
    flow.gap(1)
    flow.paragraph(`${bracket.extra_turns.length} carte(s) de tour supplémentaire. Le bracket 1 ` +
                   "les interdit ; les brackets 2 et 3 ne refusent que de les enchaîner, ce " +
                   "qu'une liste de cartes ne permet pas de constater — à toi de juger.",
                   { color: INK.muted })
    flow.paragraph(bracket.extra_turns.map(displayName).join(", "), { indent: 4, size: 8.5 })
  }

  if (bracket.two_card_combos.length > 0) {
    flow.gap(1)
    flow.line(`${bracket.two_card_combos.length} combo(s) à deux cartes, dont ` +
              `${bracket.winning_combo_count} qui gagne(nt) la partie — détaillés plus bas.`,
              { color: INK.muted })
  }

  flow.gap(1)
  flow.paragraph(`Sans effet sur le bracket : ${bracket.qualitative_signals.tutors} tuteur(s) — ` +
                 "le texte officiel en parle sans fixer de seuil — et " +
                 `${bracket.qualitative_signals.stax} effet(s) stax, qui n'est pas un critère ` +
                 "officiel.", { size: 8, color: INK.muted })
  flow.paragraph(bracket.note, { size: 8, color: INK.muted })
  flow.gap(4)
}

function drawManabase(flow: PageFlow, manabase: Manabase): void {
  flow.heading("Manabase")

  flow.line(`${manabase.land_count} terrains (repère ${manabase.recommended_lands})` +
            (manabase.lands_ok ? "" : " — en dessous du repère"),
            { style: manabase.lands_ok ? "normal" : "bold" })
  flow.gap(1)

  const colors = Object.entries(manabase.colors)
  if (colors.length > 0) {
    flow.table(
      [
        { label: "Couleur", width: 34 },
        { label: "Sources", width: 24, align: "right" },
        { label: "Conseillées", width: 28, align: "right" },
        { label: "Symboles de mana", width: 38, align: "right" },
        { label: "Manque", width: 24, align: "right" },
      ],
      colors.map(([color, stats]) => [
        MANA_LABEL[color] ?? color,
        `${stats.sources}`,
        `${stats.target}`,
        `${stats.pips}`,
        stats.shortfall > 0 ? `${stats.shortfall}` : "—",
      ])
    )
    flow.paragraph("Les cibles ne se comparent pas entre elles : chacune vient de la demande de " +
                   "sa propre couleur, et prises ensemble elles réclament plus de sources que le " +
                   "deck n'a de terrains.", { size: 8, color: INK.muted })
    flow.gap(2)
  }

  if (manabase.measured_stuck_rate !== null) {
    flow.line(`${percent(manabase.measured_stuck_rate, 0)} des sorts que tu pourrais payer ` +
              "restent en main faute des bonnes couleurs (mesuré par simulation).")
  } else {
    flow.line(`${manabase.stuck_cards.toFixed(1).replace(".", ",")} carte(s) restent en main, ` +
              "en moyenne, faute des bonnes couleurs (estimation).")
  }

  if (manabase.strained_cards.length > 0) {
    flow.gap(2)
    flow.line("Cartes que la manabase ne soutient pas" +
              (manabase.strained_total > manabase.strained_cards.length
                ? ` (${manabase.strained_total} au total)`
                : ""), { style: "bold", size: 8.5 })
    for (const card of manabase.strained_cards) {
      flow.bullet(`${card.name}${card.mana_cost ? ` ${card.mana_cost}` : ""} — ${card.needed} ` +
                  `sources ${MANA_LABEL[card.color] ?? card.color} conseillées, ` +
                  `${card.sources} disponibles`, { size: 8.5, color: INK.muted })
    }
  }

  const basics = manabase.basic_lands
  flow.gap(2)
  if (basicSwapWorthwhile(basics)) {
    flow.line("Terrains de base à échanger", { style: "bold", size: 8.5 })
    for (const move of basics.moves) {
      // Pas de « → » : la police par défaut de jsPDF (Helvetica, WinAnsi) ne
      // porte pas la flèche et l'imprime en deux caractères parasites.
      flow.bullet(`${move.land} : de ${move.from} à ${move.to} ` +
                  `(${move.delta > 0 ? "+" : ""}${move.delta})`,
                  { size: 8.5, color: INK.muted })
    }
    const measured = basics.measured_before !== undefined && basics.measured_after !== undefined
      ? `Mesuré par simulation : ${percent(basics.measured_before)} de sorts bloqués contre ` +
        `${percent(basics.measured_after)} après l'échange.`
      : `Ferait passer les cartes bloquées de ${basics.stuck_before.toFixed(1)} à ` +
        `${basics.stuck_after.toFixed(1)}.`
    flow.paragraph(`Même nombre de terrains (${basics.total} basiques) : c'est un échange, pas ` +
                   `un achat. ${measured}`, { size: 8, color: INK.muted })
  } else {
    flow.paragraph("Aucun échange de terrains de base n'améliorerait la stabilité de façon " +
                   "mesurable.", { size: 8, color: INK.muted })
  }
  flow.gap(4)
}

function drawRoles(flow: PageFlow, roles: RoleDiagnostic[]): void {
  flow.heading("Équilibre des rôles", 3)
  flow.table(
    [
      { label: "Rôle", width: 60 },
      { label: "Dans le deck", width: 30, align: "right" },
      { label: "Repère", width: 34, align: "right" },
      { label: "État", width: 40 },
    ],
    roles.map((role) => [
      ROLE_LABELS[role.role] ?? role.role,
      `${role.count}`,
      role.target,
      STATUS_LABEL[role.status] ?? role.status,
    ])
  )
  flow.paragraph("Ces repères sont communément admis, pas des vérités : ils servent à signaler " +
                 "un écart franc.", { size: 8, color: INK.muted })
  flow.gap(4)
}

function drawLegality(flow: PageFlow, warnings: LegalityWarning[]): void {
  flow.heading("Alertes de légalité et de consistance")
  for (const warning of warnings) flow.bullet(`${warning.card} — ${warning.issue}`)
  flow.gap(4)
}

function drawCombos(flow: PageFlow, combos: TwoCardCombo[]): void {
  const winning = combos.filter((combo) => combo.wins_outright)
  flow.heading(`Combos à deux cartes — ${combos.length}, dont ${winning.length} ` +
               "qui gagne(nt) la partie")

  for (const combo of combos) {
    // Une section ne commence pas pour trois lignes en bas de page.
    flow.need(4 * LINE_HEIGHT)
    flow.line(`${combo.wins_outright ? "Gagne la partie" : "Combo"} — ${combo.cards.join(" + ")}`,
              { style: "bold", size: 9 })
    flow.line(`${combo.total_mana_value} mana au total` +
              (combo.produces.length > 0 ? ` — ${combo.produces.slice(0, 3).join(", ")}` : ""),
              { size: 8, color: INK.muted, indent: 4 })
    if (combo.prerequisites) {
      flow.paragraph(`Prérequis : ${combo.prerequisites}`,
                     { size: 8, color: INK.muted, indent: 4 })
    }
    if (combo.description) {
      const steps = combo.description.split("\n").map((step) => step.trim()).filter(Boolean)
      steps.forEach((step, index) => {
        flow.paragraph(`${index + 1}. ${step}`, { size: 8, color: INK.muted, indent: 4 })
      })
    }
    flow.gap(2)
  }

  flow.paragraph("« Mana au total » = lancer les deux cartes puis exécuter le combo. À comparer " +
                 "au ramp du deck : le bracket 3 tolère un combo de fin de partie, pas un plan " +
                 "de départ. Les étapes viennent de Commander Spellbook.",
                 { size: 8, color: INK.muted })
  flow.gap(4)
}

/**
 * Les synergies les plus fortes. La liste complète vit à l'écran : un PDF de
 * cent lignes de synergie ne se relit pas, et c'est la tête du classement qui
 * dit pourquoi ces cartes sont là.
 */
const SYNERGIES_IN_PDF = 15

function drawSynergies(flow: PageFlow, synergies: DeckSynergy[], subject: string): void {
  flow.heading(`Synergies avec ${subject}`, 3)
  flow.table(
    [
      { label: "Carte", width: 96 },
      { label: "Synergie", width: 32, align: "right" },
      { label: "Jouée dans", width: 34, align: "right" },
    ],
    synergies.slice(0, SYNERGIES_IN_PDF).map((card) => [
      displayName(card),
      `${card.synergy > 0 ? "+" : ""}${card.synergy.toFixed(2).replace(".", ",")}`,
      card.inclusion_rate !== null ? percent(card.inclusion_rate, 0) : "—",
    ])
  )
  flow.paragraph("La synergie n'est pas la popularité : c'est l'écart entre « jouée avec ce " +
                 "commandant » et « jouée dans cette couleur en général ». Un Anneau solaire est " +
                 "partout, donc synergique avec personne." +
                 (synergies.length > SYNERGIES_IN_PDF
                   ? ` ${synergies.length} cartes sont reconnues au total, les ` +
                     `${SYNERGIES_IN_PDF} premières sont listées ici.`
                   : ""),
                 { size: 8, color: INK.muted })
  flow.gap(4)
}
