"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { downloadDeckPdf, type DeckPdfCard, type DeckPdfDeck, type DeckPdfMode } from "@/lib/deck-pdf"
import { hasAnalysis, type DeckPdfAnalysis } from "@/lib/deck-sheet"

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
 *
 * **L'analyse arrive de deux façons**, et la distinction n'est pas cosmétique :
 * `analysis` pour un écran qui l'a déjà sous la main (la fiche de deck),
 * `loadAnalysis` pour un écran où elle se calcule — l'atelier, dont le
 * brouillon change à chaque clic, et le deck compétitif, qui n'est pas
 * enregistré. La payer au chargement de ces pages serait payer une évaluation
 * que personne n'a demandée ; la lire depuis un état déjà affiché la rendrait
 * périmée dès la carte suivante.
 */
export function DeckExport({
  deck,
  cards,
  modes = ALL_MODES,
  hint,
  analysis,
  loadAnalysis,
}: {
  deck: DeckPdfDeck
  cards: DeckPdfCard[]
  modes?: DeckPdfMode[]
  /** Remplace l'explication par défaut quand la liste n'est pas une fiche. */
  hint?: ReactNode
  /** L'analyse déjà chargée par l'écran. */
  analysis?: DeckPdfAnalysis | null
  /** L'analyse à demander au moment de l'export, quand elle se calcule. */
  loadAnalysis?: () => Promise<DeckPdfAnalysis | null>
}) {
  const [busy, setBusy] = useState<DeckPdfMode | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Le libellé dit ce que le bouton produit : une fiche porte l'analyse, une
  // liste ne porte que des cartes. Un écran sans analyse garde l'ancien nom.
  const analysable = hasAnalysis(analysis) || Boolean(loadAnalysis)
  const labels: Record<DeckPdfMode, string> = {
    names: analysable ? "PDF — fiche du deck" : "PDF — liste par type",
    images: "PDF — visuels",
    tournament: "PDF — feuille de tournoi",
  }

  async function run(mode: DeckPdfMode) {
    setBusy(mode)
    setError(null)
    setWarning(null)
    setProgress(null)
    try {
      // La feuille de tournoi n'a que faire de l'analyse : ne pas la calculer
      // évite un appel réseau pour un document qui l'ignorerait.
      let sheet = analysis ?? null
      if (loadAnalysis && mode !== "tournament") {
        setProgress("Analyse…")
        try {
          sheet = await loadAnalysis()
        } catch {
          // Une analyse indisponible ne doit pas emporter la decklist : on sort
          // la liste seule et on le dit, plutôt que de ne rien rendre.
          setWarning("Analyse indisponible : le PDF ne contient que la liste.")
          sheet = null
        }
      }
      setProgress(null)
      await downloadDeckPdf({ ...deck, analysis: sheet }, cards, mode, (done, total) =>
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
            {busy === mode ? (progress ?? "Export…") : labels[mode]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {hint ?? (
          <>
            {analysable && (
              <>
                La fiche reprend la liste <strong>et ce que cette page dit du deck</strong> —
                bracket, manabase, rôles, combos, synergies.{" "}
              </>
            )}
            La feuille de tournoi liste <strong>les cent cartes</strong>, quantité et nom seulement,
            par ordre alphabétique — c&apos;est ce qu&apos;un arbitre vérifie, le reste
            l&apos;encombrerait. Les noms sont ceux affichés ici : français quand la carte a été
            traduite, anglais sinon.
          </>
        )}
      </p>
      {warning && <p className="text-xs text-amber-600 dark:text-amber-500">{warning}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
