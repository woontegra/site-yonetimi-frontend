/**
 * Semantic pastel card tones — use via SurfaceCard / SectionCard / StatCard.
 * Colors come from CSS variables in globals.css (not hard-coded hex here).
 */

export type CardTone =
  | "neutral"
  | "teal"
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "rose"
  | "cyan";

export type CardToneClasses = {
  surface: string;
  header: string;
  icon: string;
  metric: string;
  empty: string;
  hover: string;
  link: string;
};

function toneSurface(name: string, withAccent: boolean): string {
  const accent = withAccent
    ? ` border-l-[3px] border-l-[color:var(--tone-${name}-accent)]`
    : "";
  return `border border-[color:var(--tone-${name}-border)] bg-[color:var(--tone-${name}-bg)] shadow-panel${accent}`;
}

function buildTone(name: CardTone, withAccent: boolean): CardToneClasses {
  return {
    surface: toneSurface(name, withAccent),
    header: `border-[color:var(--tone-${name}-border)] bg-[color:var(--tone-${name}-header)]`,
    icon: `bg-[color:var(--tone-${name}-icon-bg)] text-[color:var(--tone-${name}-icon)]`,
    metric: `border border-[color:var(--tone-${name}-border)] bg-[color:var(--tone-${name}-metric)]`,
    empty: `border border-dashed border-[color:var(--tone-${name}-border)] bg-[color:var(--tone-${name}-empty)]`,
    hover: `hover:bg-[color:var(--tone-${name}-hover)]`,
    link:
      name === "neutral"
        ? "text-accent hover:text-accent-hover"
        : `text-[color:var(--tone-${name}-icon)] hover:opacity-85`,
  };
}

export const CARD_TONES: Record<CardTone, CardToneClasses> = {
  neutral: buildTone("neutral", false),
  teal: buildTone("teal", true),
  blue: buildTone("blue", true),
  green: buildTone("green", true),
  amber: buildTone("amber", true),
  violet: buildTone("violet", true),
  rose: buildTone("rose", true),
  cyan: buildTone("cyan", true),
};

/** Domain → default card tone mapping for list/catalog pages. */
export const DOMAIN_CARD_TONE = {
  sites: "teal",
  buildings: "cyan",
  apartments: "blue",
  persons: "violet",
  dues: "blue",
  debts: "rose",
  payments: "green",
  expenses: "amber",
  bank: "cyan",
  assets: "amber",
  visitors: "violet",
  staff: "blue",
  suppliers: "cyan",
  announcements: "violet",
  feedback: "blue",
  whatsapp: "green",
  settings: "neutral",
} as const satisfies Record<string, CardTone>;

export function cardTone(tone: CardTone = "neutral"): CardToneClasses {
  return CARD_TONES[tone];
}
