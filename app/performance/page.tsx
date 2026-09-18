"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import {
  displayName,
  performanceApi,
  type PerformanceCommander,
  type PerformanceRanking,
  type PerformanceRow,
} from "@/lib/api"

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceRanking | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    performanceApi
      .ranking(10)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inattendue"))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Les commandants qui gagnent</h1>
        <p className="text-sm text-muted-foreground">
          Chaque commandant que tu possèdes monte son meilleur deck{" "}
          <strong>avec ta collection</strong>, puis affronte le même panel : tes decks
          enregistrés. Le taux affiché est celui de ces parties-là, jouées coup par coup.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {data && data.commanders.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucun classement calculé</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              Le calcul dure plusieurs minutes — des milliers de parties — et vit donc en ligne de
              commande, comme les synchronisations EDHREC :
            </p>
            <code className="rounded bg-muted px-2 py-1 text-xs">
              python scripts/rank_commanders.py
            </code>
            <p>
              Il lui faut au moins un deck enregistré : c&apos;est lui qui sert d&apos;adversaire.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.commanders.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">panel : {data.panel}</Badge>
            <Badge variant="outline">{data.games} parties par commandant</Badge>
            {data.computed_at && (
              <Badge variant="outline">
                calculé le {new Date(data.computed_at).toLocaleDateString("fr-FR")}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {data.commanders.map((commander, rang) => (
              <CommanderRow key={commander.commander_oracle_id} rang={rang + 1} commander={commander} />
            ))}
          </div>

          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="text-base">Ce que ce taux n&apos;est pas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                <strong>Aucune source ne publie de taux de victoire en Commander</strong> : EDHREC
                compte des decks, pas des parties. Ce chiffre est donc mesuré ici, par le même duel
                simulé que la page de comparaison — et il en hérite le biais, décrit sur cette
                page : le modèle est plus à l&apos;aise avec les decks qui gagnent au combat ou par
                un combo identifié qu&apos;avec ceux qui accumulent de petits avantages.
              </p>
              <p>
                <strong>Un score ne se compare qu&apos;à panel égal.</strong> Ajoute ou retire un
                deck enregistré, et tous les taux changent : c&apos;est « qui bat ce que je joue
                déjà », pas une force absolue.
              </p>
              <p>
                Un <strong>noyau incomplet</strong> explique un mauvais score sans rien dire du
                commandant : c&apos;est ta collection qui manque de cartes dans son identité de
                couleur, pas lui qui est faible.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function CommanderRow({ rang, commander }: { rang: number; commander: PerformanceCommander }) {
  const meilleur = commander.themes[0]

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
        <div className="flex items-start gap-3">
          <span className="w-6 shrink-0 text-lg font-semibold tabular-nums text-muted-foreground">
            {rang}
          </span>
          <div className="w-24 shrink-0">
            <CardTile card={commander} caption="" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-semibold">{displayName(commander)}</h2>
            <span className="text-lg font-semibold tabular-nums">
              {Math.round(commander.win_rate * 100)} %
            </span>
            <span className="text-xs text-muted-foreground">
              de victoires sur {commander.games} parties
            </span>
            {commander.existing_deck_id && (
              <Link
                href={`/decks/${commander.existing_deck_id}`}
                className="text-xs underline decoration-dotted"
              >
                deck existant
              </Link>
            )}
          </div>

          <WinBar rate={commander.win_rate} />

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className={commander.core_size < 63 ? "text-amber-600 dark:text-amber-500" : ""}>
              noyau {commander.core_size}/63
            </span>
            {commander.bracket && <span>bracket {commander.bracket}</span>}
            <span>{Math.round(commander.unfinished_rate * 100)} % de parties non conclues</span>
            {commander.avg_turns && <span>{commander.avg_turns} tours en moyenne</span>}
          </div>

          {commander.themes.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Archétypes mesurés — meilleur : <strong>{meilleur.theme_label}</strong>{" "}
                ({Math.round(meilleur.win_rate * 100)} %)
              </span>
              {/* Tous les archétypes restent affichés : savoir que l'infect
                  gagne ne dit rien de ce que valent les autres, et c'est
                  justement la question qu'on se pose devant un commandant. */}
              <p className="text-xs text-muted-foreground">
                Un archétype sous le taux du commandant n&apos;est pas une erreur : la ligne du
                haut est le meilleur deck <em>toutes stratégies confondues</em>, bâti sur les
                quotas de rôle, alors qu&apos;un archétype vise la forme des decks réels qui le
                jouent. L&apos;écart mesure ce que la stratégie coûte <em>avec ta collection</em>.
              </p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {commander.themes.map((theme) => (
                  <ThemeLine key={theme.theme_slug} theme={theme} best={meilleur.win_rate} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucun archétype mesuré : soit ce commandant sort du haut du classement — seuls les
              vingt premiers le sont, le calcul coûtant une minute par poignée d&apos;archétypes —
              soit EDHREC n&apos;en publie aucun pour lui.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Barre de victoire : 50 % est marqué, c'est le seul repère qui compte en duel. */
function WinBar({ rate }: { rate: number }) {
  return (
    <div className="relative h-2 w-full max-w-md overflow-hidden rounded-full"
         style={{ background: "var(--grid-line)" }}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${rate * 100}%` }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
    </div>
  )
}

function ThemeLine({ theme, best }: { theme: PerformanceRow; best: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-40 shrink-0 truncate">{theme.theme_label}</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--grid-line)" }}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${theme.win_rate * 100}%` }} />
      </div>
      <span className="tabular-nums text-muted-foreground">
        {Math.round(theme.win_rate * 100)} %
      </span>
      {theme.win_rate === best && <Badge variant="secondary">le meilleur</Badge>}
    </li>
  )
}
