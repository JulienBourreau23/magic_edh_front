"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { downloadDeckPdf, type DeckPdfCard, type DeckPdfDeck, type DeckPdfMode } from "@/lib/deck-pdf"

const LABELS: Record<DeckPdfMode, string> = {
  names: "PDF — liste par type",
  images: "PDF — visuels",
  tournament: "PDF — feuille de tournoi",
}

const ALL_MODES: DeckPdfMode[] = ["names", "images", "tournament"]

/**
 * Les sorties PDF d'une decklist, partagées par la fiche de deck et les écrans
 * qui en construisent une. Le mode `images` télécharge une centaine de visuels :
 * il annonce sa progression plutôt que de laisser croire à un bouton mort, et
 * les boutons sont bloqués pendant l'export pour qu'un second clic n'en lance
 * pas deux en concurrence.
 *
 * `modes` existe parce que **toutes les listes ne valent pas une feuille de
 * tournoi** : celle de `/deck-ideas` n'a pas de manabase, l'exporter comme une
 * decklist officielle serait un piège.
 */
export function DeckExport({
  deck,
  cards,
  modes = ALL_MODES,
  hint,
}: {
  deck: DeckPdfDeck
  cards: DeckPdfCard[]
  modes?: DeckPdfMode[]
  /** Remplace l'explication par défaut quand la liste n'est pas une fiche. */
  hint?: ReactNode
}) {
  const [busy, setBusy] = useState<DeckPdfMode | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(mode: DeckPdfMode) {
    setBusy(mode)
    setError(null)
    setProgress(null)
    try {
      await downloadDeckPdf(deck, cards, mode, (done, total) =>
        setProgress(`${done}/${total} visuels`)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export impossible")
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {modes.map((mode) => (
          <Button
            key={mode}
            variant="outline"
            size="sm"
            disabled={busy !== null || cards.length === 0}
            onClick={() => run(mode)}
          >
            {busy === mode ? (progress ?? "Export…") : LABELS[mode]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {hint ?? (
          <>
            La feuille de tournoi liste <strong>les cent cartes</strong>, quantité et nom seulement,
            par ordre alphabétique — c&apos;est ce qu&apos;un arbitre vérifie, le reste
            l&apos;encombrerait. Les noms sont ceux affichés ici : français quand la carte a été
            traduite, anglais sinon.
          </>
        )}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
