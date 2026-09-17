"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cardImageUrl, cardsApi, displayName, type Card } from "@/lib/api"

/** Recherche de carte avec anti-rebond, utilisée pour ajouter ou corriger une carte. */
export function CardSearch({
  placeholder = "Chercher une carte...",
  onSelect,
}: {
  placeholder?: string
  onSelect: (card: Card) => void | Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  // Carte survolée : son visuel en grand permet de lire le texte avant de
  // valider. La vignette de 28 px suffit à distinguer deux illustrations, pas
  // à vérifier qu'on prend la bonne version d'une carte.
  const [preview, setPreview] = useState<Card | null>(null)

  // La liste affichée est dérivée de la requête courante : inutile de vider
  // l'état à chaque frappe, il suffit de ne pas montrer un résultat périmé.
  const tooShort = query.trim().length < 2
  const visibleResults = tooShort ? [] : results

  useEffect(() => {
    if (tooShort) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await cardsApi.search(query.trim()))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, tooShort])

  return (
    <div className="flex flex-col gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {loading && <p className="text-xs text-muted-foreground">Recherche...</p>}
      {visibleResults.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-1">
          {visibleResults.map((card) => (
            <li key={card.scryfall_id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between gap-2 px-2 py-1 text-left"
                // `onFocus` autant que `onMouseEnter` : sans lui, la
                // vérification ne marcherait qu'à la souris, alors que la
                // liste se parcourt aussi au clavier.
                onMouseEnter={() => setPreview(card)}
                onFocus={() => setPreview(card)}
                onMouseLeave={() => setPreview((current) => (current === card ? null : current))}
                onBlur={() => setPreview((current) => (current === card ? null : current))}
                onClick={async () => {
                  await onSelect(card)
                  setQuery("")
                  setResults([])
                  setPreview(null)
                }}
              >
                {/* La vignette évite la confusion entre deux cartes au nom
                    proche — « Nissa, voyante de Vastebois » et « Nissa, sage
                    animiste » ne se distinguent pas autrement. */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-10 w-7 shrink-0 overflow-hidden rounded border bg-muted">
                    {cardImageUrl(card) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cardImageUrl(card)!}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{displayName(card)}</span>
                    {displayName(card) !== card.name && (
                      <span className="truncate text-xs text-muted-foreground">{card.name}</span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {card.type_line?.split("—")[0]?.trim()}
                  {card.price_eur != null ? ` · ${card.price_eur.toFixed(2)} €` : ""}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Panneau fixe plutôt qu'infobulle collée à la ligne : la liste défile
        en `overflow-y-auto`, donc un agrandissement placé à l'intérieur y
        serait rogné, et placé à côté il déborderait de l'écran sur une
        fenêtre étroite. `pointer-events-none` le rend inoffensif même quand
        il recouvre du contenu — on continue de cliquer au travers.
        Masqué sous `lg` : sans survol au doigt, il ne servirait à rien sur
        mobile, où il masquerait la moitié de l'écran.
      */}
      {preview && cardImageUrl(preview) && (
        <div // Les visuels stockés sont en taille « normal » de Scryfall (488 px de
          // large) : au-delà, on agrandirait du flou. 384 px, puis 448 px sur
          // les écrans larges, restent en deçà — le texte reste net.
          className="pointer-events-none fixed right-6 top-1/2 z-50 hidden w-96 -translate-y-1/2 lg:block 2xl:w-[28rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardImageUrl(preview)!}
            alt={displayName(preview)}
            className="w-full rounded-xl border bg-card shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
