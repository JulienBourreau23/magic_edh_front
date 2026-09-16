"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { CardSearch } from "@/components/CardSearch"
import { CardTile } from "@/components/CardTile"
import {
  displayName,
  wishlistApi,
  type Card as MtgCard,
  type CollectionImportResult,
  type WishlistEntry,
  type WishlistStats,
} from "@/lib/api"

export default function WishlistPage() {
  const [entries, setEntries] = useState<WishlistEntry[]>([])
  const [stats, setStats] = useState<WishlistStats | null>(null)
  const [bulk, setBulk] = useState("")
  const [importing, setImporting] = useState(false)
  const [lastImport, setLastImport] = useState<CollectionImportResult | null>(null)
  const [view, setView] = useState<"liste" | "visuels">("liste")
  // Confirmation visuelle du dernier ajout : deux cartes au nom proche ne se
  // distinguent que par l'image, et une erreur ici se solde par un achat.
  const [lastAdded, setLastAdded] = useState<MtgCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    () =>
      wishlistApi
        .list()
        .then((data) => {
          setEntries(data.cards)
          setStats(data.stats)
          setError(null)
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue")),
    []
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  async function run(action: Promise<unknown>) {
    try {
      await action
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    }
    await refresh()
  }

  async function runImport() {
    setImporting(true)
    try {
      setLastImport(await wishlistApi.importBulk(bulk))
      setBulk("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Liste de recherche</h1>
        <p className="text-sm text-muted-foreground">
          Ce que tu envisages d&apos;acheter. Une fois la carte achetée, le bouton
          « C&apos;est acheté » la fait passer en collection — les deux écritures se font
          ensemble, pour que la carte ne puisse jamais se retrouver ni des deux côtés ni d&apos;aucun.
          Les terrains de base n&apos;y entrent pas : ils sont supposés disponibles sans limite.
        </p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{stats.distinct_cards} cartes différentes</Badge>
          <Badge variant="secondary">{stats.total_cards} exemplaires</Badge>
          <Badge variant="outline">{stats.total_price_eur.toFixed(2)} € au total</Badge>
          {stats.unknown_price > 0 && (
            <Badge variant="destructive">
              {stats.unknown_price} au prix inconnu, hors total
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chercher une carte</CardTitle>
          </CardHeader>
          <CardContent>
            <CardSearch
              onSelect={async (card) => {
                await run(wishlistApi.add(card.scryfall_id))
                setLastAdded(card)
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              La recherche porte sur toute la base, pas seulement sur ta collection.
            </p>
            {lastAdded && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border p-2">
                <div className="w-16 shrink-0">
                  <CardTile card={lastAdded} caption="" />
                </div>
                <div className="flex flex-col text-sm">
                  <span className="font-medium">{displayName(lastAdded)}</span>
                  <span className="text-xs text-muted-foreground">
                    ajoutée à la liste de recherche
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-6 w-fit px-2 text-xs"
                    onClick={async () => {
                      // On retire l'exemplaire ajouté, pas la ligne : la carte
                      // pouvait déjà être cherchée en plusieurs exemplaires.
                      const ligne = entries.find((e) => e.oracle_id === lastAdded.oracle_id)
                      await run(
                        wishlistApi.setQuantity(lastAdded.oracle_id, (ligne?.quantity ?? 1) - 1)
                      )
                      setLastAdded(null)
                    }}
                  >
                    Annuler l&apos;ajout
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saisie en masse</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={4}
              className="font-mono text-sm"
              placeholder={"1 Rhystic Study\n2 Fetchland\nSol Ring"}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <Button onClick={runImport} disabled={importing || !bulk.trim()}>
              {importing ? "Ajout en cours..." : "Ajouter à la liste"}
            </Button>
            {lastImport && (
              <div className="text-sm text-muted-foreground">
                {lastImport.added_distinct} carte(s) ajoutée(s)
                {lastImport.skipped_basic_lands > 0 &&
                  ` · ${lastImport.skipped_basic_lands} terrain(s) de base ignoré(s)`}
                {lastImport.issues.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-destructive">
                    {lastImport.issues.map((issue) => (
                      <li key={issue.raw_line}>
                        <span className="font-mono">{issue.raw_line}</span> — {issue.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-medium">À acheter</h2>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === "liste" ? "default" : "outline"}
              onClick={() => setView("liste")}
            >
              Liste
            </Button>
            <Button
              size="sm"
              variant={view === "visuels" ? "default" : "outline"}
              onClick={() => setView("visuels")}
            >
              Visuels
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Liste vide. Ajoute une carte ci-dessus, ou depuis les listes d&apos;achats des pages
            d&apos;équilibrage et de deck compétitif.
          </p>
        ) : view === "visuels" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {entries.map((entry) => (
              <div key={entry.oracle_id} className="flex flex-col gap-1">
                <CardTile card={entry} caption={displayName(entry)} />
                <Button size="sm" onClick={() => run(wishlistApi.acquire(entry.oracle_id, 1))}>
                  C&apos;est acheté
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Carte</th>
                  <th className="py-2 font-medium">Pourquoi</th>
                  <th className="py-2 text-right font-medium">Prix unité</th>
                  <th className="py-2 text-right font-medium">Cherchée</th>
                  <th className="py-2 text-right font-medium">Achat</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.oracle_id} className="border-b last:border-0">
                    <td className="py-1.5 pr-4">
                      {displayName(entry)}
                      {entry.owned_quantity > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({entry.owned_quantity} déjà en collection)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-xs text-muted-foreground">
                      {entry.note ?? "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {entry.price_eur != null ? `${entry.price_eur.toFixed(2)} €` : "inconnu"}
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run(wishlistApi.setQuantity(entry.oracle_id, entry.quantity - 1))
                          }
                        >
                          −
                        </Button>
                        <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run(wishlistApi.setQuantity(entry.oracle_id, entry.quantity + 1))
                          }
                        >
                          +
                        </Button>
                      </div>
                    </td>
                    <td className="py-1.5 text-right">
                      <Button
                        size="sm"
                        onClick={() => run(wishlistApi.acquire(entry.oracle_id, 1))}
                        title="Fait passer un exemplaire en collection"
                      >
                        C&apos;est acheté
                      </Button>
                      {entry.quantity > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1"
                          onClick={() => run(wishlistApi.acquire(entry.oracle_id))}
                          title="Fait passer tous les exemplaires cherchés en collection"
                        >
                          les {entry.quantity}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
