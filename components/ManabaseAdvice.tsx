/**
 * Ce que la manabase ne soutient pas, et le seul correctif gratuit : déplacer
 * des terrains de base.
 *
 * Deux chiffres distincts cohabitent ici, ne pas les confondre :
 *
 * - **sources / cible** par couleur : la cible vient de la demande de CETTE
 *   couleur prise seule (un {U}{U} au tour 3 exige plus qu'un {U} au tour 5).
 *   Elle dit si la couleur est servie, pas quoi faire.
 * - **cartes bloquées** : combien de cartes restent en main faute des bonnes
 *   couleurs, toutes couleurs confondues. C'est elle qu'on minimise, parce
 *   qu'elle compte des cartes — les cibles, elles, ne se comparent pas entre
 *   couleurs et peuvent réclamer ensemble plus de sources que le deck n'a de
 *   terrains.
 *
 * D'où un cas normal et non contradictoire : une couleur reste signalée
 * sous-alimentée alors que la répartition conseillée ne la renforce pas. Cela
 * veut dire que le problème ne se règle pas avec des basiques — il faut des
 * terrains, ou moins de cartes exigeantes dans cette couleur.
 */
import { basicSwapWorthwhile, type BasicLandAdvice, type StrainedCard } from "@/lib/api"

// Accordés au féminin pluriel : ils qualifient des « sources ».
/**
 * Une décimale : le conseil n'est proposé qu'au-delà d'un demi-point de gain,
 * un arrondi à l'entier afficherait « 6 % contre 6 % » et donnerait l'air de
 * ne rien changer.
 */
function percent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(".", ",")} %`
}

const MANA_LABEL: Record<string, string> = {
  W: "blanches", U: "bleues", B: "noires", R: "rouges", G: "vertes",
}

export function ManabaseAdvice({
  stuckCards,
  measuredStuckRate,
  strained,
  strainedTotal,
  basicLands,
}: {
  stuckCards: number
  measuredStuckRate: number | null
  strained: StrainedCard[]
  strainedTotal: number
  basicLands: BasicLandAdvice | null
}) {
  // Le conseil n'est montré que si la simulation le confirme : elle voit les
  // sources partagées que l'estimation rapide compte deux fois. La règle vit
  // dans `lib/api.ts` parce que la fiche PDF la rejoue à l'identique.
  const worthwhile = basicSwapWorthwhile(basicLands)

  return (
    <div className="flex flex-col gap-3 text-sm">
      {measuredStuckRate !== null ? (
        <p className="text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {(measuredStuckRate * 100).toFixed(0)} %
          </span>{" "}
          des sorts que tu pourrais payer restent en main faute des bonnes couleurs.
        </p>
      ) : (
        <p className="text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{stuckCards.toFixed(1)}</span>{" "}
          carte(s) restent en main, en moyenne, faute des bonnes couleurs.
        </p>
      )}

      {strainedTotal > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">
            Cartes que la manabase ne soutient pas
            {strainedTotal > strained.length && (
              <span className="font-normal text-muted-foreground"> ({strainedTotal} au total)</span>
            )}
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {strained.map((card) => (
              <li key={`${card.name}-${card.color}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="whitespace-nowrap">
                  <span className="text-foreground">{card.name}</span>
                  {card.mana_cost && <span className="ml-1.5 font-mono">{card.mana_cost}</span>}
                </span>
                <span className="whitespace-nowrap">
                  {card.needed} sources {MANA_LABEL[card.color] ?? card.color} conseillées, {card.sources}{" "}
                  disponibles
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {worthwhile ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">Terrains de base à échanger</p>
          <ul className="flex flex-col gap-0.5 text-xs">
            {basicLands.moves.map((move) => (
              <li key={move.land} className="flex items-center gap-2">
                <span
                  className={
                    move.delta > 0
                      ? "tabular-nums font-semibold text-emerald-700 dark:text-emerald-500"
                      : "tabular-nums font-semibold text-amber-600 dark:text-amber-500"
                  }
                >
                  {move.delta > 0 ? `+${move.delta}` : move.delta}
                </span>
                <span>
                  {move.land} : {move.from} → {move.to}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {`Même nombre de terrains (${basicLands.total} basiques) : c'est un échange, pas un achat.`}{" "}
            {basicLands.measured_before !== undefined && basicLands.measured_after !== undefined
              ? `Mesuré par simulation : ${percent(basicLands.measured_before)} de sorts bloqués contre ` +
                `${percent(basicLands.measured_after)} après l'échange.`
              : `Ferait passer les cartes bloquées de ${basicLands.stuck_before.toFixed(1)} à ` +
                `${basicLands.stuck_after.toFixed(1)}.`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Aucun échange de terrains de base n&apos;améliorerait la stabilité de façon mesurable.
        </p>
      )}
    </div>
  )
}
