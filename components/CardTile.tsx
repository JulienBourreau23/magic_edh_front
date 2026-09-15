import { cardImageUrl, displayName, type Card } from "@/lib/api"

type TileCard = Pick<Card, "scryfall_id" | "name" | "image_uri" | "image_downloaded"> &
  Partial<Pick<Card, "name_fr">> &
  Partial<Pick<Card, "price_eur" | "quantity">>

export function CardTile({ card, caption }: { card: TileCard; caption?: string }) {
  const imageUrl = cardImageUrl({
    scryfall_id: card.scryfall_id,
    image_uri: card.image_uri,
    image_downloaded: card.image_downloaded,
  })

  return (
    <figure className="flex flex-col gap-1">
      <div className="aspect-[5/7] overflow-hidden rounded-lg border bg-muted">
        {imageUrl ? (
          // Images externes (repli Scryfall) : next/image imposerait une
          // configuration de domaines pour un gain nul ici.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={displayName(card)} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
            {displayName(card)}
          </div>
        )}
      </div>
      <figcaption className="truncate text-xs text-muted-foreground">
        {card.quantity && card.quantity > 1 ? `${card.quantity}x ` : ""}
        {caption ?? displayName(card)}
      </figcaption>
    </figure>
  )
}
