---
name: frontend-style
description: >
  Implement and review product UI so it looks intentional - token-first theming,
  typography, spacing, contrast, and a real light / dark / black-and-white theme.
  Use when restyling the app, adding a theme, fixing visual polish, working on
  globals.css or shared chrome, or when the user runs /frontend-style.
---

# Frontend style

Restyle through the token layer. Do not sprinkle one-off hex or `teal-700` in
new code. Do not change behavior, copy, or layout structure unless the current
structure is what makes it look broken.

## Tokens (single source)

Own every color in `src/app/globals.css` as CSS variables on `:root` /
`[data-theme]`:

| Token | Role |
|---|---|
| `--background` / `--foreground` | Page paper and ink |
| `--surface` | Cards, header, sidebar, sheets |
| `--muted` | Secondary text |
| `--line` | Hairline borders |
| `--brand` / `--brand-fg` | Primary actions and selected nav |
| `--brand-soft` | Selected / live wash |
| `--danger` | Destructive only |

Wire them into Tailwind `@theme inline` as `--color-background`, `--color-foreground`,
`--color-surface`, `--color-muted`, `--color-line`, `--color-brand`, `--color-brand-fg`,
`--color-brand-soft`, `--color-danger`.

Components use those names (`bg-brand`, `text-muted`, `border-line`). Never
`teal-*` for chrome. Functional status colors (live, conflict) may stay, except
under Black & white.

## Themes

`data-theme` on `<html>` is `system` | `light` | `dark` | `mono`.

- `light` / `dark` - the product look (paper/ink + brand).
- `system` - light or dark from `prefers-color-scheme`.
- `mono` (label **Black & white**) - no hue on chrome. Brand is ink. Type-color
  washes become gray. Keep `--danger` readable (dark gray or black), not red,
  unless contrast would fail.

Resolve `.dark` from the preference so existing `dark:` utilities follow the
chosen theme, not only the OS:

- `dark` preference -> `class="dark"`
- `mono` -> `class="dark"` only when the OS is dark
- `system` -> `class="dark"` when the OS is dark

Apply the preference from the `user-theme` cookie in the root layout (SSR) plus
a tiny blocking script so `system` does not flash the wrong scheme.

## Type and space

- Body font is the loaded Geist sans (`var(--font-geist-sans)`), never Arial.
- Headings: tracking-tight, one size step, not a new font.
- Default control height ~40px. Radius: keep Tailwind `rounded-xl` unless the
  whole system shifts together (override `--radius-xl` in CSS, do not mix).

## Chrome

Header, sidebar, footer, buttons, inputs, cards share surface + line. Active
nav uses `bg-brand-soft text-brand` (in mono that is ink on a gray wash).
Primary buttons are `bg-brand text-brand-fg`. Ghost / secondary is `border-line`.

## Loop

After any visual change:

1. Desktop 1440 and mobile 390 of every surface you touched (at least sign-in,
   dashboard, settings, map editor, schedule if it exists).
2. Cycle **Light**, **Dark**, **Black & white**.
3. Hunt contrast, clipped type, overlapping chrome, leftover teal, and
   `dark:` rules that ignore `data-theme`.
4. Fix and repeat until those screens look like one product.

Do not call it done on a single happy-path screenshot.
