"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { WishlistButton } from "@/components/WishlistButton"
import {
  budgetLandsApi,
  decksApi,
  displayName,
  videosApi,
  type BudgetLands,
  type DeckSummary,
  type LandCycle,
  type VideoSource,
} from "@/lib/api"
import { COLORS } from "@/lib/mtg-labels"

export default function TerrainsBudgetPage() {
  const [identity, setIdentity] = useState<string[]>(["B", "G"])
  const [maxPrice, setMaxPrice] = useState(2)
  const [data, setData] = useState<BudgetLands | null>(null)
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [videos, setVideos] = useState<VideoSource[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    decksApi.list().then(setDecks).catch(() => setDecks([]))
    videosApi.list().then((response) => setVideos(response.videos)).catch(() => setVideos([]))
  }, [])

  useEffect(() => {
    if (identity.length < 2) return
    budgetLandsApi
      .byIdentity(identity, maxPrice)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [identity, maxPrice])

  function toggle(color: string) {
    setIdentity((current) =>
      current.includes(color) ? current.filter((c) => c !== color) : [...current, color]
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Terrains budget</h1>
        <p className="text-sm text-muted-foreground">
          Une manabase ne s&apos;achète pas carte par carte mais par <strong>cycles</strong> :
          checklands, tango, filtres, painlands… Chaque cycle ne compte qu&apos;une carte par paire
          de couleurs, donc « qu&apos;est-ce qu&apos;il me manque » a une réponse courte et exacte.
          Les cycles sont <strong>constatés dans le texte des cartes</strong>, pas saisis à la main :
          ils suivent les sorties de sets tout seuls.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Identité de couleur</span>
          <div className="flex gap-1.5">
            {COLORS.map((color) => (
              <Button
                key={color.value}
                size="sm"
                variant={identity.includes(color.value) ? "secondary" : "outline"}
                onClick={() => toggle(color.value)}
                aria-label={color.label}
              >
                {color.letter}
              </Button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Prix max (€)</span>
          <Input
            type="number"
            min={0.1}
            step={0.5}
            className="w-24"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Math.max(0.1, Number(e.target.value) || 0.1))}
          />
        </label>

        {decks.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Ou l&apos;identité d&apos;un de mes decks
            </span>
            <div className="flex flex-wrap gap-1">
              {decks.map((deck) => (
                <Button
                  key={deck.id}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    budgetLandsApi
                      .byDeck(deck.id, maxPrice)
                      .then((result) => {
                        setIdentity(result.identity)
                        setData(result)
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Erreur inattendue")
                      )
                  }
                >
                  {deck.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {identity.length < 2 && (
        <p className="text-sm text-muted-foreground">
          Choisis au moins deux couleurs : un terrain dual n&apos;a de sens que pour une paire.
        </p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {data.totals.owned}/{data.totals.cards} possédés
            </Badge>
            <Badge variant={data.totals.missing_cost_eur > 0 ? "outline" : "secondary"}>
              {data.totals.missing_cost_eur.toFixed(2)} € pour tout compléter
            </Badge>
            <Badge variant="outline">
              {data.other_count} terrains hors cycle (utilitaires, arc-en-ciel)
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.cycles.map((cycle) => (
              <CycleCard key={cycle.key} cycle={cycle} onError={setError} />
            ))}
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">D&apos;où viennent les conseils vidéo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          {videos.length === 0 ? (
            <p>
              Aucune vidéo dépouillée pour l&apos;instant. L&apos;outil local{" "}
              <code className="rounded bg-muted px-1">youtube_cards.py</code> verse ici ce
              qu&apos;une vidéo conseille : <strong>des identifiants de cartes et de cycles</strong>,
              jamais le texte de la retranscription.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {videos.map((video) => (
                <li key={video.video_id}>
                  <a href={video.url} target="_blank" rel="noreferrer"
                     className="underline underline-offset-2">
                    {video.title}
                  </a>{" "}
                  <span className="text-xs">
                    {video.channel} — {video.cycles} cycle(s), {video.cards} carte(s)
                    {video.auto_generated && " · sous-titres automatiques"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs">
            Les sous-titres automatiques écorchent les noms propres : l&apos;extraction de cartes y
            est forcément incomplète. Les <strong>cycles</strong>, eux, viennent du chapitrage — du
            texte écrit par l&apos;auteur — et sont donc fiables.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function CycleCard({ cycle, onError }: { cycle: LandCycle; onError: (message: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
          {cycle.label}
          <span className="text-sm font-normal text-muted-foreground">
            {cycle.owned}/{cycle.cards.length} possédé(s)
          </span>
          {cycle.missing_cost_eur > 0 && (
            <Badge variant="outline">{cycle.missing_cost_eur.toFixed(2)} €</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{cycle.condition}</p>

        <ul className="flex flex-col gap-1 text-sm">
          {cycle.cards.map((card) => (
            <li key={card.oracle_id} className="flex flex-wrap items-center gap-2">
              <span className={card.owned_quantity ? "text-muted-foreground" : ""}>
                {displayName(card)}
              </span>
              {card.owned_quantity > 0 ? (
                <Badge variant="secondary">
                  possédé{card.owned_quantity > 1 ? ` ×${card.owned_quantity}` : ""}
                  {card.decks > 0 && `, joué dans ${card.decks}`}
                </Badge>
              ) : (
                <>
                  <span className="tabular-nums text-muted-foreground">
                    {card.price_eur?.toFixed(2)} €
                  </span>
                  <WishlistButton
                    card={card}
                    wanted={card.wanted_quantity}
                    note={`${cycle.label} — manabase budget`}
                    onError={onError}
                  />
                </>
              )}
            </li>
          ))}
        </ul>

        {cycle.videos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span>Conseillé en vidéo :</span>
            {cycle.videos.map((video) => (
              <a
                key={video.video_id}
                href={`${video.url}${video.first_seconds ? `&t=${video.first_seconds}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
                title={video.title}
              >
                {video.channel || video.title}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
