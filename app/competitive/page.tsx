"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { CompetitiveDeck } from "@/components/CompetitiveDeck"
import {
  competitiveApi,
  displayName,
  type CompetitiveBuild,
  type CompetitiveCommander,
  type CompetitiveFormat,
  type CompetitiveTheme,
} from "@/lib/api"

const FORMATS: { value: CompetitiveFormat; label: string; hint: string }[] = [
  { value: "commander", label: "Multijoueur", hint: "Sol Ring et Ancient Tomb légaux" },
  { value: "duel", label: "Duel Commander", hint: "banlist plus stricte, 30 points de vie" },
]

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function CompetitivePage() {
  const [commanders, setCommanders] = useState<CompetitiveCommander[]>([])
  const [commander, setCommander] = useState<CompetitiveCommander | null>(null)
  const [format, setFormat] = useState<CompetitiveFormat | null>(null)
  const [themes, setThemes] = useState<CompetitiveTheme[]>([])
  const [themesError, setThemesError] = useState<string | null>(null)
  const [build, setBuild] = useState<CompetitiveBuild | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    competitiveApi
      .commanders()
      .then((data) => setCommanders(data.commanders))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [])

  const loadThemes = useCallback((oracleId: string, chosenFormat: CompetitiveFormat) => {
    setLoading(true)
    competitiveApi
      .themes(oracleId, chosenFormat)
      .then((data) => {
        setThemes(data.themes)
        setThemesError(data.error ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
      .finally(() => setLoading(false))
  }, [])

  function chooseCommander(next: CompetitiveCommander) {
    setCommander(next)
    setFormat(null)
    setThemes([])
    setBuild(null)
  }

  function chooseFormat(next: CompetitiveFormat) {
    setFormat(next)
    setBuild(null)
    if (commander) loadThemes(commander.oracle_id, next)
  }

  function chooseTheme(theme: CompetitiveTheme) {
    if (!commander || !format) return
    setLoading(true)
    setBuild(null)
    competitiveApi
      .build(commander.oracle_id, theme.slug, format)
      .then(setBuild)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Deck compétitif</h1>
        <p className="text-sm text-muted-foreground">
          Le deck est construit avec ta collection entière — pas avec tes listes existantes, puisque
          en compétition un seul deck part avec toi. La cible n&apos;est pas inventée : le nombre de
          terrains, la répartition par type et la courbe de mana sont ceux des decks réels de
          l&apos;archétype, et les cartes sont classées par ce que jouent ces decks-là. La banlist du
          format est appliquée avant tout le reste.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Step n={1} title="Le commandant — classé par ce que ta collection permet d'en tirer">
        {commanders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun commandant en collection. Importe un deck monté ou ajoute-le à la main.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Ce n&apos;est pas un classement de puissance : c&apos;est celui de ce que tu peux
              monter <em>maintenant</em>. Un commandant très fort dont tu ne possèdes aucune pièce
              n&apos;aidera pas ce soir. Le pourcentage est la part de son meilleur archétype déjà
              présente en collection.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {commanders.map((entry) => (
                <button
                  key={entry.oracle_id}
                  type="button"
                  onClick={() => chooseCommander(entry)}
                  className={`rounded-lg p-1 text-left transition ${
                    commander?.oracle_id === entry.oracle_id
                      ? "ring-2 ring-primary"
                      : "hover:bg-muted"
                  }`}
                  aria-pressed={commander?.oracle_id === entry.oracle_id}
                >
                  <CardTile card={entry} caption={displayName(entry)} />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {entry.best_theme ? (
                      <>
                        {entry.best_theme.label} —{" "}
                        <span className="tabular-nums">
                          {Math.round(entry.best_theme.coverage * 100)}%
                        </span>{" "}
                        en collection
                      </>
                    ) : (
                      "archétypes inconnus — lance la synchro EDHREC"
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </Step>

      {commander && (
        <Step n={2} title="Le format, donc la banlist">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((entry) => (
              <Button
                key={entry.value}
                variant={format === entry.value ? "default" : "outline"}
                onClick={() => chooseFormat(entry.value)}
              >
                {entry.label}
                <span className="ml-2 text-xs opacity-70">{entry.hint}</span>
              </Button>
            ))}
          </div>
        </Step>
      )}

      {commander && format && (
        <Step n={3} title="La stratégie, classée par ce que couvre ta collection">
          {themesError && <p className="text-sm text-destructive">{themesError}</p>}
          {loading && themes.length === 0 && (
            <p className="text-sm text-muted-foreground">Lecture des archétypes...</p>
          )}
          <div className="flex flex-col gap-2">
            {themes.map((theme) => (
              <button
                key={theme.slug}
                type="button"
                onClick={() => chooseTheme(theme)}
                className={`flex flex-wrap items-center gap-3 rounded-lg border p-2 text-left transition hover:bg-muted ${
                  build?.theme.slug === theme.slug ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className="min-w-32 font-medium">{theme.label}</span>
                <span className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.round(theme.coverage * 100)}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {theme.cards_owned} / {theme.cards_legal} cartes de l&apos;archétype en collection
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {theme.deck_count.toLocaleString("fr-FR")} decks recensés
                </Badge>
              </button>
            ))}
          </div>
        </Step>
      )}

      {loading && build === null && themes.length > 0 && (
        <p className="text-sm text-muted-foreground">Construction du deck...</p>
      )}

      {build && (
        <Step n={4} title={`Le deck — ${build.theme.label}`}>
          <CompetitiveDeck build={build} />
        </Step>
      )}
    </div>
  )
}
