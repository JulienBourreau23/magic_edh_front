"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError, decksApi, type DeckFormat } from "@/lib/api"

export default function ImportDeckPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [decklist, setDecklist] = useState("")
  const [format, setFormat] = useState<DeckFormat>("commander")
  const [addToCollection, setAddToCollection] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await decksApi.import(
        name.trim() || "Deck sans nom",
        decklist,
        format,
        addToCollection,
      )
      router.push(`/decks/${result.deck_id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur inattendue lors de l'import")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Importer une decklist</h1>

      <Card>
        <CardHeader>
          <CardTitle>Coller la liste</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="deck-name" className="text-sm font-medium">
                Nom du deck
              </label>
              <Input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Krenko Goblins"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Format</span>
              <div className="flex gap-1.5">
                {(["commander", "duel"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={format === value ? "secondary" : "outline"}
                    onClick={() => setFormat(value)}
                  >
                    {value === "commander" ? "Commander (multi)" : "Duel Commander"}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Le Duel Commander a sa propre banlist : Sol Ring et Ancient Tomb y sont interdits.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="decklist" className="text-sm font-medium">
                Decklist (export Moxfield / Archidekt / EDHREC, une carte par ligne)
              </label>
              <p className="text-xs text-muted-foreground">
                Les noms français sont acceptés (« Anneau solaire », « Krenko le caïd »). Les fiches
                restent affichées en anglais, qui est le nom de référence. Environ 12 % des cartes
                n&apos;ont jamais été imprimées en français : pour celles-là, il faut le nom anglais.
              </p>
              <Textarea
                id="decklist"
                value={decklist}
                onChange={(e) => setDecklist(e.target.value)}
                placeholder={"Commander\n1 Krenko le caïd\n\nDeck\n1 Anneau solaire\n1 Foudre\n..."}
                rows={16}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="add-to-collection" className="flex items-start gap-2 text-sm font-medium">
                <input
                  id="add-to-collection"
                  type="checkbox"
                  checked={addToCollection}
                  onChange={(e) => setAddToCollection(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>Ce deck est déjà monté : ajouter ses cartes à ma collection</span>
              </label>
              <p className="text-xs text-muted-foreground">
                À cocher uniquement si tu possèdes physiquement ces cartes. Les quantités
                s&apos;additionnent, donc deux decks montés contenant chacun un Anneau solaire
                donnent bien deux exemplaires — et aucun achat conseillé. Les terrains de base sont
                ignorés (supposés illimités) : une liste de 100 cartes n&apos;en ajoute qu&apos;une
                soixantaine.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Import en cours..." : "Importer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
