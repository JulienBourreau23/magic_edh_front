"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  EMPTY_FILTERS,
  MAX_MANA_VALUE,
  isFiltered,
  type CollectionFilterState,
} from "@/lib/collection-filters"
import { CARD_TYPES, COLORS, keywordLabel, roleLabel } from "@/lib/mtg-labels"

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-7 px-2.5 text-xs"
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function CollectionFilters({
  filters,
  onChange,
  keywords,
  roles,
  resultCount,
  totalCount,
}: {
  filters: CollectionFilterState
  onChange: (filters: CollectionFilterState) => void
  keywords: string[]
  roles: string[]
  resultCount: number
  totalCount: number
}) {
  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Nom de carte, en français ou en anglais..."
          className="max-w-xs"
        />
        <Badge variant="secondary">
          {resultCount} / {totalCount}
        </Badge>
        {isFiltered(filters) && (
          <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            Réinitialiser
          </Button>
        )}
      </div>

      <Row label="Type">
        {CARD_TYPES.map((type) => (
          <Chip
            key={type.value}
            active={filters.types.includes(type.value)}
            onClick={() => onChange({ ...filters, types: toggle(filters.types, type.value) })}
          >
            {type.label}
          </Chip>
        ))}
        <Chip
          active={filters.legendaryOnly}
          onClick={() => onChange({ ...filters, legendaryOnly: !filters.legendaryOnly })}
        >
          légendaire
        </Chip>
        <Chip
          active={filters.gameChangersOnly}
          onClick={() => onChange({ ...filters, gameChangersOnly: !filters.gameChangersOnly })}
          title="Liste officielle du Commander Format Panel"
        >
          Game Changer
        </Chip>
      </Row>

      <Row label="Jouable en">
        {COLORS.map((color) => (
          <Chip
            key={color.value}
            active={filters.colors.includes(color.value)}
            onClick={() => onChange({ ...filters, colors: toggle(filters.colors, color.value) })}
            title={`identité ${color.label}`}
          >
            {/* La lettre accompagne toujours la teinte : rouge et vert restent
                difficiles à distinguer sous protanopie. */}
            <span
              className="mr-1 inline-block size-2.5 rounded-full"
              style={{ backgroundColor: `var(--mana-${color.value.toLowerCase()})` }}
              aria-hidden
            />
            {color.letter}
          </Chip>
        ))}
        {filters.colors.length > 0 && (
          <span className="self-center text-xs text-muted-foreground">
            cartes jouables dans ces couleurs (identité incluse), incolores comprises
          </span>
        )}
      </Row>

      <Row label="Coût de mana">
        {Array.from({ length: MAX_MANA_VALUE + 1 }, (_, value) => (
          <Chip
            key={value}
            active={filters.manaValues.includes(value)}
            onClick={() =>
              onChange({ ...filters, manaValues: toggle(filters.manaValues, value) })
            }
          >
            {value === MAX_MANA_VALUE ? `${value}+` : value}
          </Chip>
        ))}
      </Row>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">Mot-clé</span>
        <select
          value={filters.keyword ?? ""}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value || null })}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">tous</option>
          {keywords.map((keyword) => (
            <option key={keyword} value={keyword}>
              {keywordLabel(keyword)}
            </option>
          ))}
        </select>

        <span className="ml-2 text-xs font-medium text-muted-foreground">Rôle</span>
        <select
          value={filters.role ?? ""}
          onChange={(e) => onChange({ ...filters, role: e.target.value || null })}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">tous</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
