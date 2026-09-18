import { jsPDF } from "jspdf"
import { cardImageUrl, displayName } from "@/lib/api"
import { groupIntoSections } from "@/lib/decklist"

/**
 * Export PDF d'une fiche de deck, côté navigateur comme la liste d'achats
 * (`lib/shopping-pdf.ts`). Trois sorties pour trois usages distincts, qui ne se
 * remplacent pas :
 *
 * - `names` : la liste par section, à relire ou à ranger avec le deck ;
 * - `images` : les visuels, pour reconnaître les cartes sans les sortir de la
 *   boîte — c'est le format qui coûte cher (une centaine d'images) ;
 * - `tournament` : **tout** est listé, rien d'autre que les noms et les
 *   quantités, dans l'ordre alphabétique où un arbitre vérifie une feuille de
 *   deck.
 */
export type DeckPdfMode = "names" | "images" | "tournament"

export type DeckPdfCard = {
  scryfall_id: string
  name: string
  name_fr?: string | null
  type_line?: string | null
  quantity: number
  is_commander?: boolean
  image_uri?: string | null
  image_downloaded?: boolean
}

export type DeckPdfDeck = {
  name: string
  format: "commander" | "duel"
  /**
   * Ce que la liste n'est pas. Une liste **générée** n'est pas toujours un deck
   * complet — celle de `/deck-ideas` n'a pas de manabase — et un PDF qui se tait
   * là-dessus se fait passer pour une decklist jouable.
   */
  note?: string
}

/**
 * Une carte d'une liste **générée** (deck compétitif, idée de deck) au format
 * de l'export. Ces écrans ne stockent rien : chaque carte y vaut un exemplaire,
 * et seuls les terrains de base arrivent avec un compte.
 */
type GeneratedCard = {
  scryfall_id: string
  name: string
  name_fr?: string | null
  type_line?: string | null
  image_uri?: string | null
  image_downloaded?: boolean
}

export function generatedDeckCards(input: {
  commander?: GeneratedCard | null
  cards: GeneratedCard[]
  /** Terrains de base par nom français : un compte, pas des cartes. */
  basics?: Record<string, number>
}): DeckPdfCard[] {
  const cards: DeckPdfCard[] = []
  if (input.commander) cards.push({ ...input.commander, quantity: 1, is_commander: true })
  cards.push(...input.cards.map((card) => ({ ...card, quantity: 1 })))
  for (const [name, count] of Object.entries(input.basics ?? {})) {
    // Un basique n'a pas d'impression choisie : ni identifiant Scryfall ni
    // visuel. Il est listé comme les autres et laisse, en mode images, un cadre
    // à son nom — ce qui est exact : le site n'a pas choisi l'édition.
    cards.push({
      scryfall_id: `basic:${name}`,
      name,
      type_line: "Basic Land",
      quantity: count,
    })
  }
  return cards
}

const MARGIN = 14
const PAGE_WIDTH = 210
const PAGE_BOTTOM = 283
const LINE_HEIGHT = 4.6

/**
 * Visuels par ligne. Cinq tiennent une planche de 25 cartes par page — à 33 mm
 * de large, l'illustration reste reconnaissable (c'est à ça qu'elle sert ici,
 * le nom est en légende), là où quatre imposaient sept pages pour un deck.
 */
const IMAGE_COLUMNS = 5
const IMAGE_GAP = 4
/** Rapport d'une carte Magic (63 × 88 mm). */
const CARD_RATIO = 88 / 63

export async function downloadDeckPdf(
  deck: DeckPdfDeck,
  cards: DeckPdfCard[],
  mode: DeckPdfMode,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const doc = new jsPDF()
  const ordered = commanderFirst(cards)
  const total = ordered.reduce((sum, card) => sum + card.quantity, 0)

  const y = drawHeader(doc, deck, ordered, total, mode)

  if (mode === "images") await drawImages(doc, ordered, y, onProgress)
  else if (mode === "tournament") drawTournamentList(doc, ordered, y)
  else drawSections(doc, ordered, y)

  doc.save(`${slug(deck.name)}-${mode === "tournament" ? "tournoi" : mode === "images" ? "visuels" : "liste"}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/**
 * Le commandant d'abord, partout : c'est la carte qui identifie le deck, et
 * une feuille de tournoi la réclame à part.
 */
function commanderFirst(cards: DeckPdfCard[]): DeckPdfCard[] {
  return [...cards].sort((a, b) => Number(Boolean(b.is_commander)) - Number(Boolean(a.is_commander)))
}

function byName(a: DeckPdfCard, b: DeckPdfCard): number {
  return displayName(a).localeCompare(displayName(b), "fr")
}

function drawHeader(
  doc: jsPDF,
  deck: DeckPdfDeck,
  cards: DeckPdfCard[],
  total: number,
  mode: DeckPdfMode
): number {
  let y = MARGIN + 2
  const commander = cards.find((card) => card.is_commander)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(0)
  doc.text(deck.name, MARGIN, y)
  y += 6

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(
    `${deck.format === "duel" ? "Duel Commander" : "Commander (multijoueur)"} · ${total} carte(s) · ${new Date().toLocaleDateString("fr-FR")}`,
    MARGIN,
    y
  )
  y += 4.5

  if (commander) {
    doc.setTextColor(0)
    doc.text(`Commandant : ${displayName(commander)}`, MARGIN, y)
    y += 4.5
  }

  if (deck.note) {
    doc.setTextColor(110)
    doc.text(fit(doc, deck.note, PAGE_WIDTH - 2 * MARGIN), MARGIN, y)
    y += 4.5
  }

  if (mode === "tournament") {
    doc.setTextColor(110)
    doc.text(
      "Liste complète, par ordre alphabétique. L'astérisque signale le commandant.",
      MARGIN,
      y
    )
    y += 4.5
  }

  y += 3
  doc.setDrawColor(180)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  return y + 6
}

/** Deux colonnes de sections, remplies l'une après l'autre. */
function drawSections(doc: jsPDF, cards: DeckPdfCard[], startY: number): void {
  const columnWidth = (PAGE_WIDTH - 2 * MARGIN - 8) / 2
  const columns = [MARGIN, MARGIN + columnWidth + 8]
  let column = 0
  let y = startY

  const nextColumn = () => {
    column += 1
    if (column >= columns.length) {
      doc.addPage()
      column = 0
    }
    y = startY
  }

  // Le commandant a sa propre section, en tête : c'est ainsi qu'une decklist
  // s'écrit, et c'est la seule carte dont le rôle ne se lit pas dans son type.
  // Accessoirement, les écrans qui proposent un deck ne renvoient pas toujours
  // son `type_line` — il aurait fini dans « Autre ».
  const commander = cards.find((card) => card.is_commander)
  const sections = [
    ...(commander ? [{ key: "Commander", label: "Commandant", cards: [commander] }] : []),
    ...groupIntoSections(cards.filter((card) => !card.is_commander)),
  ]

  for (const section of sections) {
    const sorted = [...section.cards].sort(byName)
    const count = sorted.reduce((sum, card) => sum + card.quantity, 0)

    // Une section ne commence pas en bas de colonne pour trois lignes.
    if (y + 4 * LINE_HEIGHT > PAGE_BOTTOM) nextColumn()

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text(`${section.label} (${count})`, columns[column], y)
    y += LINE_HEIGHT + 1

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    for (const card of sorted) {
      if (y > PAGE_BOTTOM) nextColumn()
      doc.setTextColor(0)
      doc.text(`${card.quantity}`, columns[column], y)
      doc.text(fitCardName(doc, displayName(card), columnWidth - 8), columns[column] + 6, y)
      y += LINE_HEIGHT
    }
    y += 3
  }
}

/**
 * Trois colonnes de « quantité + nom », sans section ni prix : ce qu'une
 * feuille de tournoi demande, et rien de plus.
 */
function drawTournamentList(doc: jsPDF, cards: DeckPdfCard[], startY: number): void {
  const columnWidth = (PAGE_WIDTH - 2 * MARGIN - 12) / 3
  const columns = [0, 1, 2].map((index) => MARGIN + index * (columnWidth + 6))
  const sorted = [...cards].sort(byName)
  const maxRows = Math.max(1, Math.floor((PAGE_BOTTOM - startY) / LINE_HEIGHT))
  // Colonnes équilibrées plutôt que remplies à ras : une centaine de lignes
  // tient en trois colonnes courtes, et laisser la troisième vide donnerait une
  // feuille où l'on cherche la suite de la liste.
  const rowsPerColumn = Math.min(maxRows, Math.ceil(sorted.length / columns.length))

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(0)

  sorted.forEach((card, index) => {
    const slot = index % (rowsPerColumn * columns.length)
    if (index > 0 && slot === 0) doc.addPage()
    const x = columns[Math.floor(slot / rowsPerColumn)]
    const y = startY + (slot % rowsPerColumn) * LINE_HEIGHT
    doc.text(`${card.quantity}`, x, y)
    // La marque du commandant s'ajoute **après** l'ajustement : passée avant,
    // elle disparaîtrait avec le verso d'un commandant à deux faces.
    const marker = card.is_commander ? " *" : ""
    doc.text(
      fitCardName(doc, displayName(card), columnWidth - 8 - doc.getTextWidth(marker)) + marker,
      x + 6,
      y
    )
  })
}

/**
 * Les visuels en grille. Une carte en plusieurs exemplaires (les terrains de
 * base) n'est dessinée qu'une fois, sa quantité en légende : imprimer douze
 * Forêts n'apprendrait rien et coûterait douze images.
 */
async function drawImages(
  doc: jsPDF,
  cards: DeckPdfCard[],
  startY: number,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const width = (PAGE_WIDTH - 2 * MARGIN - (IMAGE_COLUMNS - 1) * IMAGE_GAP) / IMAGE_COLUMNS
  const height = width * CARD_RATIO
  const rowHeight = height + 6

  const images = await loadImages(cards, onProgress)

  let x = MARGIN
  let y = startY
  let column = 0

  for (const card of cards) {
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage()
      y = MARGIN
      x = MARGIN
      column = 0
    }

    const image = images.get(card.scryfall_id)
    if (image) {
      doc.addImage(image, "JPEG", x, y, width, height)
    } else {
      // Visuel indisponible : un cadre au nom de la carte, pour que la planche
      // reste complète et que le manque se voie.
      doc.setDrawColor(180)
      doc.roundedRect(x, y, width, height, 2, 2)
      doc.setFontSize(7)
      doc.setTextColor(110)
      doc.text(doc.splitTextToSize(displayName(card), width - 4), x + 2, y + height / 2)
    }

    doc.setFontSize(7)
    doc.setTextColor(0)
    const prefix = card.quantity > 1 ? `${card.quantity}× ` : ""
    doc.text(
      prefix + fitCardName(doc, displayName(card), width - doc.getTextWidth(prefix)),
      x,
      y + height + 3.5
    )

    column += 1
    if (column === IMAGE_COLUMNS) {
      column = 0
      x = MARGIN
      y += rowHeight
    } else {
      x += width + IMAGE_GAP
    }
  }
}

/** Six téléchargements en parallèle, comme le rapatriement côté back. */
const IMAGE_CONCURRENCY = 6

async function loadImages(
  cards: DeckPdfCard[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, string>> {
  const loaded = new Map<string, string>()
  let done = 0
  const queue = [...cards]

  async function worker() {
    for (let card = queue.shift(); card; card = queue.shift()) {
      const url = cardImageUrl({
        scryfall_id: card.scryfall_id,
        image_uri: card.image_uri ?? null,
        image_downloaded: card.image_downloaded ?? false,
      })
      const data = url ? await toDataUrl(url) : null
      if (data) loaded.set(card.scryfall_id, data)
      done += 1
      onProgress?.(done, cards.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONCURRENCY, cards.length) }, () => worker())
  )
  return loaded
}

/**
 * Le PDF a besoin des octets de l'image, pas d'une URL. Les deux sources
 * répondent avec les en-têtes CORS voulus (notre back par sa whitelist,
 * Scryfall en `*`) ; une image qui échoue quand même ne bloque rien, elle
 * laisse un cadre au nom de la carte.
 */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Le nom d'une carte dans la largeur disponible. Une carte à deux noms est
 * longue — « Canaliseuse de flammes // Incarnation des flammes » — et la couper
 * au milieu donne « Canaliseuse de flammes // Incarnati… », qui ne désigne rien
 * de plus que sa face avant. On retire donc **le verso** avant de tronquer : la
 * face avant identifie la carte à elle seule, c'est d'ailleurs ce qu'une
 * decklist écrit.
 */
function fitCardName(doc: jsPDF, name: string, maxWidth: number): string {
  if (doc.getTextWidth(name) <= maxWidth) return name
  const front = name.split(" // ")[0]
  return fit(doc, front, maxWidth)
}

/** Tronque au besoin : un nom trop long chevaucherait la colonne voisine. */
function fit(doc: jsPDF, value: string, maxWidth: number): string {
  if (doc.getTextWidth(value) <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "deck"
  )
}
