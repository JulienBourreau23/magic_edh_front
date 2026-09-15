import { jsPDF } from "jspdf"
import { displayName, type ShoppingItem } from "@/lib/api"

const MARGIN = 14
const LINE_HEIGHT = 5.5
const PAGE_BOTTOM = 280

/** Colonnes : x de départ et alignement. Le nom prend la place restante. */
const COLUMNS = {
  quantity: 14,
  name: 24,
  unitPrice: 116,
  total: 140,
  decks: 160,
}

/**
 * Liste d'achats en PDF, générée côté navigateur (comme l'export de sw-coaching).
 * Volontairement sobre : c'est une feuille à emmener chez le vendeur, pas un
 * document de présentation.
 */
export function downloadShoppingListPdf(items: ShoppingItem[], deckNames: string[], totalEur: number) {
  const doc = new jsPDF()
  let y = MARGIN

  doc.setFontSize(16)
  doc.text("Liste d'achats — Magic EDH", MARGIN, y)
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(
    `${new Date().toLocaleDateString("fr-FR")} · decks : ${deckNames.join(", ")}`,
    MARGIN,
    y
  )
  y += 4
  doc.text(
    `${items.length} ligne(s) · ${items.reduce((sum, item) => sum + item.quantity, 0)} carte(s) · ${totalEur.toFixed(2)} €`,
    MARGIN,
    y
  )
  y += 8

  const header = () => {
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.text("Qté", COLUMNS.quantity, y)
    doc.text("Carte", COLUMNS.name, y)
    doc.text("P.U.", COLUMNS.unitPrice, y)
    doc.text("Total", COLUMNS.total, y)
    doc.text("Deck(s)", COLUMNS.decks, y)
    y += 2
    doc.setDrawColor(180)
    doc.line(MARGIN, y, 196, y)
    y += 4
  }
  header()

  doc.setFontSize(8)
  for (const item of items) {
    if (y > PAGE_BOTTOM) {
      doc.addPage()
      y = MARGIN
      header()
      doc.setFontSize(8)
    }

    doc.setTextColor(0)
    doc.text(String(item.quantity), COLUMNS.quantity, y)
    doc.text(truncate(displayName(item), 52), COLUMNS.name, y)
    doc.text(item.price_eur != null ? item.price_eur.toFixed(2) : "—", COLUMNS.unitPrice, y)
    doc.text(item.total_eur.toFixed(2), COLUMNS.total, y)
    doc.setTextColor(110)
    doc.text(truncate(item.decks.join(", "), 22), COLUMNS.decks, y)
    y += LINE_HEIGHT
  }

  y += 2
  doc.setDrawColor(180)
  doc.line(MARGIN, y, 196, y)
  y += 6
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(`Total : ${totalEur.toFixed(2)} €`, COLUMNS.name, y)

  doc.save(`achats-magic-edh-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
