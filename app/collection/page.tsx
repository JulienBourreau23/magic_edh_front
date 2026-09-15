"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CardSearch } from "@/components/CardSearch"
import {
  collectionApi,
  displayName,
  type CollectionEntry,
  type CollectionImportResult,
  type CollectionStats,
} from "@/lib/api"

export default function CollectionPage() {
  const [entries, setEntries] = useState<CollectionEntry[]>([])
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [search, setSearch] = useState("")
  const [bulk, setBulk] = useState("")
  const [importing, setImporting] = useState(false)
  const [lastImport, setLastImport] = useState<CollectionImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    (term: string) =>
      collectionApi
        .list(term || undefined)
        .then((data) => {
          setEntries(data.cards)
          setStats(data.stats)
          setError(null)
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue")),
    []
  )

  useEffect(() => {
    const timer = setTimeout(() => refresh(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [refresh, search])

  async function runImport() {
    setImporting(true)
    try {
      setLastImport(await collectionApi.importBulk(bulk))
      setBulk("")
      await refresh(search.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setImporting(false)
    }
  }

  async function changeQuantity(entry: CollectionEntry, delta: number) {
    // Le back renvoie désormais un 404 explicite si la carte a disparu entre
    // l'affichage et le clic : sans ce catch, l'erreur serait avalée.
    try {
      await collectionApi.setQuantity(entry.oracle_id, entry.quantity + delta)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue")
    }
    await refresh(search.trim())
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ma collection</h1>
        <p className="text-sm text-muted-foreground">
          Les terrains de base ne sont pas suivis : ils sont considérés comme disponibles sans
          limite et ne génèrent jamais d&apos;achat. Un exemplaire ne peut servir qu&apos;à un deck
          à la fois — c&apos;est ce qui rend le calcul des achats fiable.
        </p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{stats.distinct_cards} cartes différentes</Badge>
          <Badge variant="secondary">{stats.total_cards} exemplaires</Badge>
          <Badge variant="outline">{stats.total_value_eur.toFixed(2)} € de valeur</Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saisie en masse</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            rows={6}
            className="font-mono text-sm"
            placeholder={"2 Sol Ring\n1 Cultivate (C21) 205\nSwords to Plowshares"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runImport} disabled={importing || !bulk.trim()}>
              {importing ? "Import en cours..." : "Ajouter à la collection"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Même format que les decklists : avec ou sans quantité, suffixes d&apos;édition tolérés.
              Les quantités s&apos;additionnent à l&apos;existant.
            </span>
          </div>

          {lastImport && (
            <div className="text-sm text-muted-foreground">
              {lastImport.added_distinct} carte(s) ajoutée(s) ({lastImport.added_total} exemplaires)
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une carte à l&apos;unité</CardTitle>
        </CardHeader>
        <CardContent>
          <CardSearch
            onSelect={async (card) => {
              await collectionApi.add(card.scryfall_id)
              await refresh(search.trim())
            }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer la collection..."
          className="max-w-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? "Aucune carte ne correspond." : "Collection vide — commence par la saisie en masse."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Carte</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Prix unité</th>
                  <th className="py-2 text-right font-medium">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.oracle_id} className="border-b last:border-0">
                    <td className="py-1.5 pr-4">{displayName(entry)}</td>
                    <td className="py-1.5 pr-4 text-xs text-muted-foreground">
                      {entry.type_line?.split("—")[0]?.trim()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {entry.price_eur != null ? `${entry.price_eur.toFixed(2)} €` : "—"}
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => changeQuantity(entry, -1)}>
                          −
                        </Button>
                        <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
                        <Button size="sm" variant="ghost" onClick={() => changeQuantity(entry, 1)}>
                          +
                        </Button>
                      </div>
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
