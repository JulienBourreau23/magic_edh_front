"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CardSearch } from "@/components/CardSearch"
import { decksApi, type ImportIssue } from "@/lib/api"

/**
 * Lignes de decklist non résolues. Sans ce panneau, l'import signalait des
 * problèmes qu'on ne pouvait pas corriger depuis l'appli.
 */
export function ImportIssuesPanel({
  deckId,
  issues,
  onResolved,
}: {
  deckId: number
  issues: ImportIssue[]
  /** Recharge la fiche : sans ça, la ligne corrigée resterait affichée. */
  onResolved: () => Promise<unknown> | void
}) {
  const [openLine, setOpenLine] = useState<string | null>(null)

  if (issues.length === 0) return null

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">
          {issues.length} ligne{issues.length > 1 ? "s" : ""} non résolue{issues.length > 1 ? "s" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {issues.map((issue) => (
          <div key={issue.raw_line} className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                <span className="font-mono text-foreground">{issue.raw_line}</span> — {issue.reason}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenLine(openLine === issue.raw_line ? null : issue.raw_line)}
              >
                {openLine === issue.raw_line ? "Annuler" : "Corriger"}
              </Button>
            </div>
            {openLine === issue.raw_line && (
              <CardSearch
                placeholder="Quelle carte correspond ?"
                onSelect={async (card) => {
                  await decksApi.addCard(deckId, {
                    scryfall_id: card.scryfall_id,
                    resolves_raw_line: issue.raw_line,
                  })
                  setOpenLine(null)
                  await onResolved()
                }}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
