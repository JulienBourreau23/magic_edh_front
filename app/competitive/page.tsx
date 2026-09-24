"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardTile } from "@/components/CardTile"
import { CombosAndSynergies } from "@/components/CombosAndSynergies"
import { CompetitiveDeck } from "@/components/CompetitiveDeck"
import {
  competitiveApi,
  displayName,
  type CompetitiveArchetype,
  type CompetitiveBuild,
  type CompetitiveCommander,
  type CompetitiveFormat,
  type CompetitiveTheme,
  type DuelMetaSummary,
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

/**
 * `useSearchParams` force le rendu client de ce qui est dessous : Next demande
 * une frontière `Suspense`, comme sur `/balance` et `/matchup`.
 */
export default function CompetitivePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement...</p>}>
      <Builder />
    </Suspense>
  )
}

function Builder() {
  // On arrive ici depuis un article d'archétype (« monter cet archétype »).
  // Le format voyage avec, sinon l'archétype demandé pourrait n'exister dans
  // aucun format affiché.
  const searchParams = useSearchParams()
  const askedArchetype = searchParams.get("archetype")
  const askedFormat = searchParams.get("format")

  const [commanders, setCommanders] = useState<CompetitiveCommander[]>([])
  const [commander, setCommander] = useState<CompetitiveCommander | null>(null)
  // Le format vient en premier parce que **la liste des commandants en
  // dépend** : Edgar Markov est légal en multi et banni en duel, Rofellos et
  // Griselbrand l'inverse. Le demander après aurait laissé choisir un
  // commandant injouable, découvert seulement à la construction.
  // Arriver avec un archétype en poche vaut choix du format : sans lui, la
  // page attendrait un clic pour une décision déjà prise.
  const [format, setFormat] = useState<CompetitiveFormat | null>(
    askedFormat === "duel" || askedFormat === "commander"
      ? askedFormat
      : askedArchetype
        ? "commander"
        : null
  )
  // L'archétype choisi *avant* le commandant — facultatif, et c'est tout son
  // intérêt : on arrive ici soit avec un commandant en tête, soit avec une
  // stratégie. Nul tant qu'on n'a rien demandé.
  const [archetype, setArchetype] = useState<CompetitiveArchetype | null>(null)
  const [archetypes, setArchetypes] = useState<CompetitiveArchetype[] | null>(null)
  const [pickingArchetype, setPickingArchetype] = useState(Boolean(askedArchetype))
  // L'archétype demandé par l'URL, tant qu'on ne l'a pas retrouvé dans le
  // catalogue de la collection.
  const [pendingArchetype, setPendingArchetype] = useState<string | null>(askedArchetype)
  const [unknownArchetype, setUnknownArchetype] = useState<string | null>(null)
  const [themes, setThemes] = useState<CompetitiveTheme[]>([])
  const [themesError, setThemesError] = useState<string | null>(null)
  const [build, setBuild] = useState<CompetitiveBuild | null>(null)
  // Sur quoi reposent les chiffres de duel : nul hors duel, ou tant que le
  // méta MTGTop8 n'est pas synchronisé — l'écran le dit alors.
  const [duelMeta, setDuelMeta] = useState<DuelMetaSummary | null>(null)
  const [loadingThemes, setLoadingThemes] = useState(false)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Erreur inattendue")
  }, [])

  // La grille des commandants dépend du format **et** de l'archétype demandé :
  // avec un archétype, elle se restreint à ceux qui le jouent et se classe sur
  // lui. Les deux vont ensemble, d'où un seul effet.
  useEffect(() => {
    if (!format) return
    competitiveApi
      .commanders(format, archetype?.slug)
      .then((data) => {
        setCommanders(data.commanders)
        setDuelMeta(data.duel_meta)
      })
      .catch(fail)
  }, [format, archetype, fail])

  // Un archétype réclamé par l'URL : on le retrouve dans le catalogue, ou on
  // le dit. Le laisser tomber en silence afficherait la grille complète comme
  // si rien n'avait été demandé.
  useEffect(() => {
    if (!format || !pendingArchetype) return
    competitiveApi
      .archetypes(format)
      .then((data) => {
        const found = data.archetypes.find((entry) => entry.slug === pendingArchetype) ?? null
        setArchetypes(data.archetypes)
        setArchetype(found)
        setUnknownArchetype(found ? null : pendingArchetype)
        setPendingArchetype(null)
      })
      .catch(fail)
  }, [format, pendingArchetype, fail])

  const loadThemes = useCallback((oracleId: string, chosenFormat: CompetitiveFormat) => {
    setLoadingThemes(true)
    competitiveApi
      .themes(oracleId, chosenFormat)
      .then((data) => {
        setThemes(data.themes)
        setThemesError(data.error ?? null)
      })
      .catch(fail)
      .finally(() => setLoadingThemes(false))
  }, [fail])

  const startBuild = useCallback(
    (chosen: CompetitiveCommander, themeSlug: string, chosenFormat: CompetitiveFormat) => {
      setBuilding(true)
      setBuild(null)
      competitiveApi
        .build(chosen.oracle_id, themeSlug, chosenFormat)
        .then(setBuild)
        .catch(fail)
        .finally(() => setBuilding(false))
    },
    [fail]
  )

  function chooseFormat(next: CompetitiveFormat) {
    setFormat(next)
    // Changer de format peut rendre le commandant choisi illégal : on repart
    // de zéro plutôt que de garder une sélection devenue fausse. L'archétype
    // aussi — la banlist change ce qu'on peut en monter.
    setCommander(null)
    setCommanders([])
    setArchetype(null)
    setArchetypes(null)
    setPickingArchetype(false)
    setUnknownArchetype(null)
    setThemes([])
    setBuild(null)
  }

  function openArchetypes() {
    setPickingArchetype(true)
    if (archetypes || !format) return
    competitiveApi.archetypes(format).then((data) => setArchetypes(data.archetypes)).catch(fail)
  }

  function chooseArchetype(next: CompetitiveArchetype | null) {
    setArchetype(next)
    setUnknownArchetype(null)
    // La grille se recharge : le commandant retenu pourrait ne pas jouer ce
    // qu'on vient de demander.
    setCommander(null)
    setThemes([])
    setBuild(null)
  }

  function chooseCommander(next: CompetitiveCommander) {
    setCommander(next)
    setThemes([])
    setBuild(null)
    if (!format) return
    loadThemes(next.oracle_id, format)
    // L'archétype a déjà été choisi : le redemander ne servirait à rien. La
    // liste reste affichée dessous pour en changer.
    if (archetype) startBuild(next, archetype.slug, format)
  }

  function chooseTheme(theme: CompetitiveTheme) {
    if (!commander || !format) return
    startBuild(commander, theme.slug, format)
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

      <Step n={1} title="Le format, donc la banlist — et la liste des commandants">
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
        <p className="mt-3 text-xs text-muted-foreground">
          Ce choix vient en premier parce que la liste des commandants en dépend, et{" "}
          <strong>dans les deux sens</strong> : le Duel Commander interdit des commandants que le
          multi autorise, mais en autorise aussi que le multi bannit. Les cartes interdites
          seulement comme commandant sont traitées comme bannies tout court — plus strict que la
          règle réelle, jamais plus laxiste.
        </p>
        {format === "duel" && <DuelSource meta={duelMeta} />}
      </Step>

      {format && (
        <Step n={2} title="La stratégie d'abord — facultatif">
          {unknownArchetype && (
            <p className="mb-2 text-sm text-destructive">
              Aucun de tes commandants ne monte «&nbsp;{unknownArchetype}&nbsp;» : la grille
              ci-dessous n&apos;est donc pas filtrée. Attention, ça ne veut pas dire que personne
              ne le joue derrière eux — cette page ne connaît que les{" "}
              <strong>huit archétypes les plus joués de chaque commandant</strong>, ce
              qu&apos;EDHREC publie sur leur fiche. La page Archétypes, elle, part du format
              entier : elle peut lister un commandant que tu possèdes sans que cet archétype
              figure dans son top&nbsp;8.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {archetype ? (
              <>
                <Badge>{archetype.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {archetype.commanders} commandant{archetype.commanders > 1 ? "s" : ""} de ta
                  collection le montent
                </span>
                <Button variant="ghost" size="sm" onClick={() => chooseArchetype(null)}>
                  Retirer ce filtre
                </Button>
              </>
            ) : pickingArchetype ? (
              <span className="text-xs text-muted-foreground">
                {archetypes === null
                  ? "Lecture des archétypes..."
                  : "Choisis une stratégie, ou passe cette étape."}
              </span>
            ) : (
              <>
                <Button variant="outline" onClick={openArchetypes}>
                  Partir d&apos;une stratégie
                </Button>
                <span className="text-xs text-muted-foreground">
                  ou passe directement au commandant, ci-dessous.
                </span>
              </>
            )}
          </div>

          {pickingArchetype && !archetype && archetypes !== null && (
            <div className="mt-3 flex flex-col gap-2">
              {archetypes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun archétype connu : lance la synchronisation EDHREC.
                </p>
              )}
              {archetypes.map((entry) => (
                <button
                  key={entry.slug}
                  type="button"
                  onClick={() => chooseArchetype(entry)}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-2 text-left transition hover:bg-muted"
                >
                  <span className="min-w-36 font-medium">{entry.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.commanders} commandant{entry.commanders > 1 ? "s" : ""} · meilleur :{" "}
                    {entry.best.name_fr ?? entry.best.name} · poids{" "}
                    <span className="tabular-nums">{entry.best.consensus.toFixed(1)}</span> ·{" "}
                    <span className="tabular-nums">{Math.round(entry.best.score * 100)}%</span>{" "}
                    de l&apos;optimum
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {entry.deck_count.toLocaleString("fr-FR")} decks recensés
                  </Badge>
                </button>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Cette étape se saute : sans elle, chaque commandant est jugé sur{" "}
            <em>son</em> meilleur archétype. Avec elle, la grille ne garde que les commandants qui
            jouent la stratégie demandée et les classe <strong>sur elle</strong>{" "}— le meilleur de
            ta collection en général n&apos;est pas forcément le meilleur ici. Les archétypes
            proposés sont ceux de tes commandants : ce sont les seuls dont on sache ce
            qu&apos;ils coûteraient. Le nombre de decks recensés est compté chez eux, pas dans le
            format entier.
            {format === "duel" && (
              <>
                {" "}
                <strong>En duel, ces stratégies viennent d&apos;EDHREC, donc du multijoueur</strong>{" "}
                : c&apos;est la seule source qui les nomme. Les tops de tournoi, eux, ne classent
                que par commandant.
              </>
            )}
          </p>
        </Step>
      )}

      {format && (
        <Step
          n={3}
          title={
            archetype
              ? `Le commandant — classé sur ${archetype.label}`
              : "Le commandant — classé par ce que ta collection permet d'en tirer"
          }
        >
          {commanders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {archetype
                ? "Aucun commandant de ta collection ne joue cet archétype."
                : "Aucun commandant en collection. Importe un deck monté ou ajoute-le à la main."}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Classé par ce que tu peux monter <em>maintenant</em>, pas par puissance brute : un
                commandant très fort dont tu ne possèdes aucune pièce n&apos;aide pas ce soir. Le{" "}
                <strong>poids</strong>{" "}est la somme des taux d&apos;inclusion de tes 63 meilleures
                cartes pour cet archétype — une pièce maîtresse jouée dans 80 % des decks y compte
                seize fois plus qu&apos;une carte de niche jouée dans 5 %. C&apos;est lui qui trie. Le
                pourcentage dit à quel point tu approches l&apos;optimum de cet archétype-là.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {commanders.map((entry) => {
                  const shown = entry.selected_theme ?? entry.best_theme
                  const better =
                    entry.selected_theme && entry.best_theme &&
                    entry.best_theme.slug !== entry.selected_theme.slug &&
                    // Deux sources, deux échelles : un poids de méta de duel
                    // et un poids EDHREC ne se comparent pas.
                    entry.best_theme.source === entry.selected_theme.source &&
                    entry.best_theme.consensus > entry.selected_theme.consensus
                      ? entry.best_theme
                      : null
                  return (
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
                        {shown ? (
                          <>
                            {shown.label} ·{" "}
                            <span className="tabular-nums">{shown.cards_usable}</span> cartes ·
                            poids{" "}
                            <span className="tabular-nums">{shown.consensus.toFixed(1)}</span> ·{" "}
                            <span className="tabular-nums">{Math.round(shown.score * 100)}%</span>{" "}
                            de l&apos;optimum
                          </>
                        ) : (
                          "archétypes inconnus — lance la synchro EDHREC"
                        )}
                      </span>
                      {better && (
                        <span className="mt-1 block text-xs text-muted-foreground/80">
                          monte mieux {better.label} (poids{" "}
                          <span className="tabular-nums">{better.consensus.toFixed(1)}</span>)
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Step>
      )}

      {commander && format && (
        <Step n={4} title="La stratégie, classée par ce que couvre ta collection">
          {themesError && <p className="text-sm text-destructive">{themesError}</p>}
          {loadingThemes && themes.length === 0 && (
            <p className="text-sm text-muted-foreground">Lecture des archétypes...</p>
          )}
          {format === "duel" && themes.some((theme) => theme.source === "mtgtop8") && (
            <p className="mb-3 text-xs text-muted-foreground">
              En duel, les références de tournoi passent en tête.{" "}
              <strong>Ses listes de tournoi</strong>{" "}n&apos;existent que pour un commandant assez
              joué en tops : c&apos;est la meilleure cible possible. <strong>Le méta du duel</strong>{" "}
              existe toujours : les cartes qui gagnent en face à face dans ses couleurs, départagées
              par ce qu&apos;EDHREC voit jouer avec lui — il ne connaît pas son plan de jeu, seulement
              ce qui marche en duel. Les archétypes EDHREC restent dessous, mesurés en multijoueur.
            </p>
          )}
          {archetype && (
            <p className="mb-3 text-xs text-muted-foreground">
              Le deck est déjà construit sur <strong>{archetype.label}</strong>, choisi à
              l&apos;étape 2. Cette liste dit ce que ce commandant sait faire d&apos;autre — en
              changer ne demande pas de repartir de zéro.
            </p>
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
                {format === "duel" && (
                  <Badge variant={theme.source === "mtgtop8" ? "default" : "outline"}>
                    {theme.source === "mtgtop8" ? "tops de duel" : "EDHREC · multi"}
                  </Badge>
                )}
                <span className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.round(theme.coverage * 100)}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {theme.cards_owned} / {theme.cards_legal}{" "}
                  {theme.source === "mtgtop8" ? "cartes jouées" : "cartes de l\u2019archétype"} en
                  collection
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {theme.deck_count.toLocaleString("fr-FR")}{" "}
                  {theme.source === "mtgtop8" ? "tops de tournoi" : "decks recensés"}
                </Badge>
              </button>
            ))}
          </div>
        </Step>
      )}

      {building && <p className="text-sm text-muted-foreground">Construction du deck...</p>}

      {build && (
        <Step n={5} title={`Le deck — ${build.theme.label}`}>
          <div className="flex flex-col gap-4">
            <CompetitiveDeck build={build} />
            <CombosAndSynergies
              combos={build.combos}
              synergies={build.synergies}
              subject={displayName(build.commander)}
              // Un thème de duel n'a pas d'équivalent EDHREC : la synergie se
              // mesure alors contre tous les decks du commandant.
              themeLabel={build.theme.source === "mtgtop8" ? undefined : build.theme.label}
            />
          </div>
        </Step>
      )}
    </div>
  )
}

/**
 * D'où viennent les chiffres de duel. Sans ce bandeau, rien ne distinguerait
 * un conseil tiré des tops de tournoi d'un conseil tiré du multijoueur.
 */
function DuelSource({ meta }: { meta: DuelMetaSummary | null }) {
  if (!meta) {
    return (
      <p className="mt-2 text-xs text-destructive">
        Le méta du duel n&apos;est pas synchronisé (<code>scripts/sync_mtgtop8.py</code>) : les
        références viennent d&apos;EDHREC, c&apos;est-à-dire du multijoueur, filtrées par la seule
        banlist du duel.
      </p>
    )
  }
  const since = meta.since ? meta.since.split("-").reverse().join("/") : null
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      En duel, les cartes sont classées par les <strong>tops de tournoi de Duel Commander</strong>{" "}
      relevés sur MTGTop8 — {meta.decks.toLocaleString("fr-FR")} decks,{" "}
      {meta.events.toLocaleString("fr-FR")} tournois{since && <> depuis le {since}</>} — et non
      par EDHREC, qui mesure le multijoueur.
    </p>
  )
}
