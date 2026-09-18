"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { decksApi, displayName, type DeckSummary } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function ArchivesPage() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () => decksApi.list(true).then(setDecks).catch(() => setDecks([])),
    []
  )

  useEffect(() => {
    load()
  }, [load])

  async function restore(deck: DeckSummary) {
    setBusy(deck.id)
    try {
      await decksApi.archive(deck.id, false)
      await load()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Archives</h1>
          <p className="text-sm text-muted-foreground">
            Les decks rangés. <strong>Rien n&apos;est supprimé</strong> et la collection ne bouge
            pas : un deck archivé sort seulement des écrans qui parlent de ce qu&apos;on joue — la
            liste des decks, l&apos;équilibrage, la comparaison et le panel du classement.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/decks">Retour aux decks</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {decks === null && <p className="text-muted-foreground">Chargement...</p>}
      {decks?.length === 0 && (
        <p className="text-muted-foreground">
          Aucun deck archivé. Le bouton « Archiver » est sur chaque deck de la liste.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map((deck) => (
          <Card key={deck.id} className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>
                <Link href={`/decks/${deck.id}`} className="hover:underline">
                  {deck.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
              <span>
                {deck.commander_name
                  ? displayName({ name: deck.commander_name, name_fr: deck.commander_name_fr })
                  : "Commandant non déterminé"}
              </span>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{deck.card_count} cartes</Badge>
                <Badge variant="outline">{deck.format}</Badge>
                {deck.archived_at && (
                  <Badge variant="outline">
                    rangé le {new Date(deck.archived_at).toLocaleDateString("fr-FR")}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-auto self-start"
                disabled={busy === deck.id}
                onClick={() => restore(deck)}
              >
                {busy === deck.id ? "…" : "Remettre en service"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
