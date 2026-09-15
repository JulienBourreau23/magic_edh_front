"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardSearch } from "@/components/CardSearch"
import { decksApi, type DeckFormat } from "@/lib/api"

/**
 * Renommage, bascule de format et suppression. Le format n'est pas cosmétique :
 * il change la banlist appliquée (Sol Ring est banni en Duel Commander).
 */
export function DeckToolbar({
  deckId,
  name,
  format,
  hasCommander,
  onChanged,
}: {
  deckId: number
  name: string
  format: DeckFormat
  hasCommander: boolean
  /** Recharge la fiche. La page est un composant client : c'est elle qui
   *  refait l'appel, `router.refresh()` ne rejouerait pas son effet. */
  onChanged: () => Promise<unknown> | void
}) {
  const router = useRouter()
  const [draftName, setDraftName] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>, after: "refresh" | "decks" = "refresh") {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (after === "decks") router.push("/decks")
      else await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="max-w-xs"
          aria-label="Nom du deck"
        />
        <Button
          variant="secondary"
          disabled={busy || draftName.trim() === name || !draftName.trim()}
          onClick={() => run(() => decksApi.update(deckId, { name: draftName.trim() }))}
        >
          Renommer
        </Button>

        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(() => decksApi.update(deckId, { format: format === "duel" ? "commander" : "duel" }))}
        >
          Basculer en {format === "duel" ? "multi" : "duel"}
        </Button>

        <Button
          variant="destructive"
          className="ml-auto"
          disabled={busy}
          onClick={() => {
            if (confirm(`Supprimer définitivement « ${name} » ?`)) {
              run(() => decksApi.remove(deckId), "decks")
            }
          }}
        >
          Supprimer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Ajouter une carte</span>
          <CardSearch
            onSelect={(card) => run(() => decksApi.addCard(deckId, { scryfall_id: card.scryfall_id }))}
          />
        </div>
        {!hasCommander && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Définir le commandant (non détecté à l&apos;import)
            </span>
            <CardSearch
              placeholder="Chercher le commandant..."
              onSelect={(card) =>
                run(() => decksApi.update(deckId, { commander_scryfall_id: card.scryfall_id }))
              }
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
