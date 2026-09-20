"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { cardImageUrl, displayName, type Card } from "@/lib/api"

export type PreviewCard = Pick<Card, "scryfall_id" | "name" | "image_uri" | "image_downloaded"> &
  Partial<Pick<Card, "name_fr">>

/** La carte survolée et l'endroit d'où l'aperçu doit s'écarter. */
export type HoveredCard = { card: PreviewCard; x: number; y: number }

/** Largeur de l'aperçu, en pixels. Une carte Magic est au rapport 5/7. */
const WIDTH = 230
const HEIGHT = Math.round((WIDTH * 7) / 5)
/** Écart au curseur : assez pour ne pas passer sous la flèche. */
const OFFSET = 22
const EDGE = 8

/**
 * Un délai court avant d'afficher, et avant d'effacer.
 *
 * Sans lui, descendre une liste de deux cents cartes déclencherait deux cents
 * téléchargements d'illustration pour des lignes qu'on n'a fait que traverser.
 * Le même délai au retrait évite le clignotement quand la souris passe d'une
 * ligne à sa voisine.
 */
const DELAY_MS = 120

/**
 * L'illustration de la carte survolée, en grand, à côté du curseur.
 *
 * Une liste de deck ne montre que des noms, et beaucoup de cartes ne se
 * reconnaissent qu'à leur image — surtout quand on construit avec une
 * collection qu'on ne connaît pas par cœur. L'aperçu répond à « qu'est-ce que
 * je suis en train de poser », sans quitter la liste ni cliquer.
 *
 * **Il ne suit pas la souris** : il se pose là où le curseur est entré dans la
 * ligne et n'y bouge plus. Suivre le pointeur obligerait à réagir à chaque
 * `mousemove`, donc à re-rendre la page en continu, pour un confort qui n'en
 * est pas un : une image qui glisse sous l'œil se lit moins bien qu'une image
 * posée.
 */
export function CardHoverPreview({ hovered }: { hovered: HoveredCard | null }) {
  const [shown, setShown] = useState<HoveredCard | null>(null)

  useEffect(() => {
    // Le changement passe par un minuteur, jamais directement : un `setState`
    // synchrone dans un effet est refusé par le lint de Next 16, et c'est de
    // toute façon ce délai qui fait tout l'intérêt (voir DELAY_MS).
    const timer = setTimeout(() => setShown(hovered), DELAY_MS)
    return () => clearTimeout(timer)
  }, [hovered])

  if (!shown) return null

  const imageUrl = cardImageUrl({
    scryfall_id: shown.card.scryfall_id,
    image_uri: shown.card.image_uri,
    image_downloaded: shown.card.image_downloaded,
  })

  // À droite du curseur, sauf quand la fenêtre n'y suffit plus ; verticalement
  // centré puis ramené dans l'écran. Sans ce rattrapage, les dernières lignes
  // d'une liste longue afficheraient leur aperçu hors cadre.
  const right = shown.x + OFFSET + WIDTH > window.innerWidth
  const left = right ? Math.max(EDGE, shown.x - OFFSET - WIDTH) : shown.x + OFFSET
  const top = Math.min(
    Math.max(EDGE, shown.y - HEIGHT / 2),
    Math.max(EDGE, window.innerHeight - HEIGHT - EDGE)
  )

  return createPortal(
    <div
      // Décoratif : le nom de la carte est déjà lisible dans la liste, et
      // l'aperçu ne doit intercepter aucun clic.
      aria-hidden
      className="pointer-events-none fixed z-50 overflow-hidden rounded-xl border bg-card shadow-lg"
      style={{ left, top, width: WIDTH, height: HEIGHT }}
    >
      {imageUrl ? (
        // Images externes (repli Scryfall) : next/image imposerait une
        // configuration de domaines pour un gain nul ici.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
          {displayName(shown.card)}
          <br />
          (pas de visuel)
        </div>
      )}
    </div>,
    document.body
  )
}

/**
 * Les gestionnaires à poser sur une ligne de liste.
 *
 * Le clavier est servi comme la souris : une ligne est un bouton, donc elle se
 * reçoit au `Tab`, et l'aperçu se place alors contre son bord droit — il n'y a
 * pas de curseur d'où partir.
 */
export function hoverHandlers(
  card: PreviewCard,
  onChange: (hovered: HoveredCard | null) => void
) {
  return {
    onMouseEnter: (event: { clientX: number; clientY: number }) =>
      onChange({ card, x: event.clientX, y: event.clientY }),
    onMouseLeave: () => onChange(null),
    onFocus: (event: { currentTarget: HTMLElement }) => {
      const box = event.currentTarget.getBoundingClientRect()
      onChange({ card, x: box.right, y: box.top + box.height / 2 })
    },
    onBlur: () => onChange(null),
  }
}
