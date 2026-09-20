import type { jsPDF } from "jspdf"

/**
 * Les primitives de mise en page des PDF de deck, partagées par la liste
 * (`lib/deck-pdf.ts`) et la fiche d'analyse (`lib/deck-sheet.ts`).
 *
 * Elles existent pour une raison simple : jsPDF ne connaît que des
 * coordonnées. Chaque bloc de texte doit donc décider lui-même s'il tient
 * encore sur la page, et une section d'analyse en compte des dizaines. Sans
 * ce curseur, un saut de page oublié quelque part fait écrire par-dessus le
 * bas de page — et cela ne se voit qu'à l'impression.
 */

export const MARGIN = 14
export const PAGE_WIDTH = 210
export const PAGE_BOTTOM = 283
export const LINE_HEIGHT = 4.6
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Niveaux de gris. Un PDF s'imprime, souvent en noir et blanc : tout ce qui
 * distingue un texte d'un autre ici est une valeur de gris et une graisse,
 * jamais une teinte.
 */
export const INK = {
  title: 0,
  body: 35,
  muted: 110,
  rule: 185,
} as const

/** Tronque à la largeur disponible, suffixe compris. */
export function fit(doc: jsPDF, value: string, maxWidth: number): string {
  if (doc.getTextWidth(value) <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

export type TextOptions = {
  size?: number
  style?: "normal" | "bold" | "italic"
  color?: number
  /** Décalage horizontal depuis la marge, en mm. */
  indent?: number
}

/**
 * Un curseur vertical qui sait passer à la page suivante.
 *
 * `need()` est la seule règle à retenir : on réserve la hauteur **avant**
 * d'écrire, jamais après. Un titre de section réserve donc la place de ses
 * deux premières lignes, sans quoi il resterait seul en bas de page.
 */
export class PageFlow {
  private doc: jsPDF
  private top: number
  y: number

  constructor(doc: jsPDF, startY: number, top = MARGIN + 6) {
    this.doc = doc
    this.top = top
    this.y = startY
  }

  /** Réserve `height` mm ; saute à la page suivante s'ils ne tiennent pas. */
  need(height: number): void {
    if (this.y + height > PAGE_BOTTOM) {
      this.doc.addPage()
      this.y = this.top
    }
  }

  gap(height = 3): void {
    this.y += height
  }

  newPage(): void {
    this.doc.addPage()
    this.y = this.top
  }

  /**
   * Titre de section : un filet, le titre, et la place du début du corps.
   *
   * `bodyLines` n'est pas décoratif : un titre suivi d'un tableau doit
   * réserver aussi l'en-tête de celui-ci et sa première ligne, sinon la
   * section s'annonce en bas d'une page et son contenu commence à la
   * suivante — constaté sur « Équilibre des rôles ».
   */
  heading(label: string, bodyLines = 1): void {
    this.need((2 + bodyLines) * LINE_HEIGHT)
    this.doc.setDrawColor(INK.rule)
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
    this.y += 5
    this.doc.setFont("helvetica", "bold")
    this.doc.setFontSize(11)
    this.doc.setTextColor(INK.title)
    this.doc.text(label, MARGIN, this.y)
    this.y += LINE_HEIGHT + 1.5
  }

  /** Une ligne, tronquée à la largeur utile. */
  line(value: string, options: TextOptions = {}): void {
    const { size = 9, style = "normal", color = INK.body, indent = 0 } = options
    this.need(LINE_HEIGHT)
    this.doc.setFont("helvetica", style)
    this.doc.setFontSize(size)
    this.doc.setTextColor(color)
    this.doc.text(fit(this.doc, value, CONTENT_WIDTH - indent), MARGIN + indent, this.y)
    this.y += LINE_HEIGHT
  }

  /** Un paragraphe, coupé aux mots. */
  paragraph(value: string, options: TextOptions = {}): void {
    const { size = 9, style = "normal", color = INK.body, indent = 0 } = options
    this.doc.setFont("helvetica", style)
    this.doc.setFontSize(size)
    this.doc.setTextColor(color)
    for (const row of this.doc.splitTextToSize(value, CONTENT_WIDTH - indent) as string[]) {
      this.need(LINE_HEIGHT)
      this.doc.text(row, MARGIN + indent, this.y)
      this.y += LINE_HEIGHT
    }
  }

  /** Une puce : le tiret reste aligné, le texte s'indente sous lui-même. */
  bullet(value: string, options: TextOptions = {}): void {
    const indent = (options.indent ?? 0) + 4
    this.doc.setFont("helvetica", options.style ?? "normal")
    this.doc.setFontSize(options.size ?? 9)
    this.doc.setTextColor(options.color ?? INK.body)
    const rows = this.doc.splitTextToSize(value, CONTENT_WIDTH - indent) as string[]
    rows.forEach((row, index) => {
      this.need(LINE_HEIGHT)
      if (index === 0) this.doc.text("—", MARGIN + (options.indent ?? 0), this.y)
      this.doc.text(row, MARGIN + indent, this.y)
      this.y += LINE_HEIGHT
    })
  }

  /**
   * Un tableau sans bordures : l'en-tête en gris, les colonnes alignées.
   * Les largeurs sont en mm et données par l'appelant — une colonne de noms de
   * cartes n'a pas la même exigence qu'une colonne de comptes.
   */
  table(columns: { label: string; width: number; align?: "left" | "right" }[],
        rows: string[][]): void {
    const offsets: number[] = []
    columns.reduce((x, column) => {
      offsets.push(x)
      return x + column.width
    }, 0)

    const write = (values: string[], style: "normal" | "bold", color: number) => {
      this.doc.setFont("helvetica", style)
      this.doc.setFontSize(8.5)
      this.doc.setTextColor(color)
      values.forEach((value, index) => {
        const column = columns[index]
        if (!column) return
        const text = fit(this.doc, value, column.width - 2)
        const x = MARGIN + offsets[index] + (column.align === "right" ? column.width - 2 : 0)
        this.doc.text(text, x, this.y, column.align === "right" ? { align: "right" } : undefined)
      })
      this.y += LINE_HEIGHT
    }

    const header = () => write(columns.map((column) => column.label), "bold", INK.muted)

    // L'en-tête ne part jamais seul : il est écrit avec la place de sa
    // première ligne, et **réécrit** en haut de la page suivante — un tableau
    // de rôles dont les colonnes ne sont plus nommées ne se lit plus.
    this.need(2 * LINE_HEIGHT)
    header()
    for (const row of rows) {
      if (this.y + LINE_HEIGHT > PAGE_BOTTOM) {
        this.newPage()
        header()
      }
      write(row, "normal", INK.body)
    }
  }
}
