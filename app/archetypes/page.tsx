"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { archetypesApi, type ArchetypeSummary, type CompetitiveFormat } from "@/lib/api"

const FORMATS: { value: CompetitiveFormat; label: string }[] = [
  { value: "commander", label: "Multijoueur" },
  { value: "duel", label: "Duel Commander" },
]

/**
 * La recherche est **côté navigateur** : le catalogue tient en une réponse, et
 * le refaire calculer à chaque frappe serait du gaspillage. Elle regarde aussi
 * les alias, sans quoi « superfriends » ne trouverait rien — EDHREC range cet
 * archétype sous « Planeswalkers ».
 */
function matches(entry: ArchetypeSummary, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    entry.label.toLowerCase().includes(needle) ||
    entry.slug.includes(needle) ||
    entry.aliases.some((alias) => alias.toLowerCase().includes(needle))
  )
}

export default function ArchetypesPage() {
  const [format, setFormat] = useState<CompetitiveFormat>("commander")
  const [archetypes, setArchetypes] = useState<ArchetypeSummary[]>([])
  const [documented, setDocumented] = useState(0)
  const [query, setQuery] = useState("")
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyDocumented, setOnlyDocumented] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // `setLoading` vit dans le gestionnaire de clic et non ici : la règle
  // `react-hooks/set-state-in-effect` de Next 16 refuse un `setState`
  // synchrone dans un effet.
  useEffect(() => {
    archetypesApi
      .list(format)
      .then((data) => {
        setArchetypes(data.archetypes)
        setDocumented(data.documented)
        setError(data.error)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
      .finally(() => setLoading(false))
  }, [format])

  const shown = useMemo(
    () =>
      archetypes.filter(
        (entry) =>
          matches(entry, query) &&
          (!onlyMine || entry.owned_commanders > 0) &&
          (!onlyDocumented || entry.principle !== null)
      ),
    [archetypes, query, onlyMine, onlyDocumented]
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Archétypes</h1>
        <p className="text-sm text-muted-foreground">
          Ce que le format joue, stratégie par stratégie : le principe, les commandants qui la
          pilotent, et les cartes qui la caractérisent. C&apos;est la seule page du site qui parle
          aussi de ce que tu ne possèdes pas — ailleurs, tout part de la collection.{" "}
          <strong>Les chiffres sont mesurés</strong> (decks recensés par EDHREC, cartes possédées,
          prix), <strong>les textes sont écrits à la main</strong> : aucune source ne publie « ce
          que fait un deck aristocrats », et le projet préfère ne rien dire à inventer une mesure.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((entry) => (
          <Button
            key={entry.value}
            size="sm"
            variant={format === entry.value ? "default" : "outline"}
            onClick={() => {
              setLoading(true)
              setFormat(entry.value)
            }}
          >
            {entry.label}
          </Button>
        ))}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher (« superfriends », « jetons », « combo »...)"
          className="w-72"
        />
        <Button
          size="sm"
          variant={onlyMine ? "default" : "outline"}
          onClick={() => setOnlyMine((value) => !value)}
        >
          J&apos;ai un commandant
        </Button>
        <Button
          size="sm"
          variant={onlyDocumented ? "default" : "outline"}
          onClick={() => setOnlyDocumented((value) => !value)}
        >
          Expliqués
        </Button>
        <span className="text-xs text-muted-foreground">
          {shown.length} / {archetypes.length} archétypes · {documented} expliqués
        </span>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Lecture du catalogue...</p>}

      <div className="flex flex-col gap-2">
        {shown.map((entry) => (
          <Link key={entry.slug} href={`/archetypes/${entry.slug}?format=${format}`}>
            <Card className="transition hover:bg-muted">
              <CardContent className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                <span className="text-base font-medium">{entry.label}</span>
                {entry.owned_commanders > 0 ? (
                  <Badge variant="secondary">
                    {entry.owned_commanders} commandant
                    {entry.owned_commanders > 1 ? "s" : ""} en collection
                  </Badge>
                ) : (
                  <Badge variant="outline">aucun commandant en collection</Badge>
                )}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {entry.deck_count.toLocaleString("fr-FR")} decks recensés
                </span>
                <p className="w-full text-sm text-muted-foreground">
                  {entry.principle ?? (
                    <span className="italic">
                      Pas encore expliqué — la fiche montre quand même ses commandants et ses
                      cartes.
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && shown.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Rien ne correspond à cette recherche.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Le catalogue vient des pages <em>tags</em>{" "}d&apos;EDHREC, rafraîchies une fois par mois —
        un archétype du format agrège des centaines de milliers de decks, il ne bouge pas d&apos;une
        semaine à l&apos;autre. Les archétypes joués par moins de 500 decks sont écartés : leur taux
        d&apos;inclusion serait calculé sur une poignée de listes.
      </p>
    </div>
  )
}
