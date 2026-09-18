"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { displayName, wishlistApi } from "@/lib/api"

/**
 * « Ajouter à la liste de recherche », partagé par tous les écrans qui
 * conseillent des cartes.
 *
 * Il n'existe qu'une fois pour une raison précise : **les quantités de la liste
 * de recherche s'additionnent**. Un bouton toujours actif transforme donc un
 * second clic — ou un retour sur la page — en second exemplaire demandé, sans
 * rien dire. Tant qu'une carte y est déjà, le bouton le dit et ne fait rien.
 *
 * L'ajout n'est **pas** rejoué côté serveur : la carte est retenue localement.
 * Recharger toute une page de conseils pour un bouton coûterait des dizaines de
 * requêtes SQL, et l'information tient en un booléen.
 */
export function WishlistButton({
  card,
  wanted,
  note,
  className = "h-6 px-2 text-xs",
  onError,
}: {
  card: { scryfall_id: string; name: string; name_fr?: string | null }
  /** Exemplaires déjà cherchés, tels que le serveur les a renvoyés. */
  wanted: number
  /** Pourquoi on la cherche : « Conseillée pour l'Atraxa ». */
  note: string
  className?: string
  onError?: (message: string) => void
}) {
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)

  const alreadyWanted = wanted > 0 || added

  async function add() {
    setBusy(true)
    try {
      await wishlistApi.add(card.scryfall_id, 1, note)
      setAdded(true)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Ajout impossible")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant={alreadyWanted ? "ghost" : "outline"}
      className={className}
      disabled={alreadyWanted || busy}
      onClick={add}
      aria-label={
        alreadyWanted
          ? `${displayName(card)} est déjà dans la liste de recherche`
          : `Ajouter ${displayName(card)} à la liste de recherche`
      }
    >
      {alreadyWanted ? "déjà cherchée" : "+ recherche"}
    </Button>
  )
}
