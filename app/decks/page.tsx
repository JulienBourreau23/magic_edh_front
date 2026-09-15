"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { decksApi, displayName, type DeckSummary } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)

  // Composant client et non serveur : le jeton vit dans le navigateur, un
  // rendu serveur n'y aurait pas accès et se ferait renvoyer un 401.
  useEffect(() => {
    decksApi
      .list()
      .then(setDecks)
      .catch(() => setDecks([]))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mes decks</h1>
        <Button asChild>
          <Link href="/decks/import">Importer une decklist</Link>
        </Button>
      </div>

      {decks === null && <p className="text-muted-foreground">Chargement...</p>}

      {decks?.length === 0 && (
        <p className="text-muted-foreground">
          Aucun deck importé pour l&apos;instant.{" "}
          <Link href="/decks/import" className="underline">
            Colle ta première decklist
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map((deck) => (
          <Link key={deck.id} href={`/decks/${deck.id}`}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle>{deck.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>
                  {deck.commander_name
                    ? displayName({ name: deck.commander_name, name_fr: deck.commander_name_fr })
                    : "Commandant non déterminé"}
                </span>
                <div className="flex gap-2">
                  <Badge variant="secondary">{deck.card_count} cartes</Badge>
                  <Badge variant="outline">{deck.format}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
