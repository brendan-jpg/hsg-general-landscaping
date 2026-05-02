# HSG Design System

This document defines the core visual principles and token values for all HSG digital products.

## Theme Overview

Light color mode. Bold, condensed headings paired with clean body text. Industrial-service aesthetic — strong blues, amber accents, dark navy.

---

## Typography

| Role     | Family             | Weight | Transform  |
|----------|--------------------|--------|------------|
| Headings | Barlow Condensed   | 800    | Uppercase  |
| Body     | Barlow             | 400    | None       |
| Labels   | Barlow             | 500–600| None       |

- **Heading line-height:** 1.05
- **Body line-height:** 1.6
- **Heading letter-spacing:** 0.01em

### Type Scale

| Token       | Value      |
|-------------|------------|
| `--h1`      | 3.5rem     |
| `--h2`      | 2.25rem    |
| `--h3`      | 1.75rem    |
| `--h4`      | 1.375rem   |
| `--h5`      | 1.125rem   |
| `--text-xl` | 1.25rem    |
| `--text-l`  | 1.125rem   |
| `--text-m`  | 1rem       |
| `--text-s`  | 0.875rem   |

---

## Color Palette

### Brand

| Token               | Value     | Usage                              |
|---------------------|-----------|------------------------------------|
| `--primary`         | `#3d8ec4` | Interactive elements, links, focus |
| `--primary-light`   | `#6aaed8` | Hover tints, icons                 |
| `--primary-dark`    | `#2a6a99` | Active states, pressed             |
| `--secondary`       | `#f5a31e` | CTAs, highlights, accents          |
| `--secondary-light` | `#fbbf5a` | Hover tints on amber               |
| `--secondary-dark`  | `#c47e0a` | Active state on amber              |

### Backgrounds

| Token        | Value     | Usage                     |
|--------------|-----------|---------------------------|
| `--bg-light` | `#f4f7fa` | Page background, surfaces |
| `--bg-dark`  | `#2c3e52` | Hero sections, nav        |

### Text

| Token         | Value     | Usage                    |
|---------------|-----------|--------------------------|
| `--text-dark` | `#1a2737` | Primary body text        |
| `--text-muted`| `#6b7f93` | Secondary / helper text  |
| `--text-light`| `#f4f7fa` | Text on dark backgrounds |

### Status (non-brand)

| Token                  | Value     |
|------------------------|-----------|
| `--color-success`      | `#16a34a` |
| `--color-success-light`| `#dcfce7` |
| `--color-warning`      | `#ca8a04` |
| `--color-warning-light`| `#fef9c3` |
| `--color-danger`       | `#dc2626` |
| `--color-danger-light` | `#fee2e2` |
| `--color-neutral`      | `#64748b` |
| `--color-neutral-light`| `#eef2f8` |

---

## Spacing

| Token       | Value  |
|-------------|--------|
| `--space-s` | 8px    |
| `--space-m` | 16px   |
| `--space-l` | 32px   |
| `--space-xl`| 64px   |

Extended numeric scale (`--space-1` through `--space-24`) maps to these base values via `tokens.css`.

---

## Shape

| Token          | Value | Usage               |
|----------------|-------|---------------------|
| `--radius-card`| 8px   | Cards, modals       |
| `--radius-btn` | 4px   | Buttons             |
| `--radius-form`| 4px   | Inputs, selects     |
| `--radius-img` | 6px   | Images              |
| `--radius-vid` | 6px   | Video embeds        |

---

## Shadows

| Token          | Value                                    |
|----------------|------------------------------------------|
| `--shadow-card`| `0 2px 16px rgba(0,0,0,0.10)`           |
| `--shadow-btn` | `0 2px 8px rgba(0,0,0,0.18)`            |
| `--shadow-form`| `0 1px 4px rgba(0,0,0,0.08)`            |
| `--shadow-img` | `0 2px 10px rgba(0,0,0,0.12)`           |

Extended scale (`--shadow-xs` through `--shadow-xl`) maps to these via `tokens.css`.

---

## Borders

- **Card border:** `1px solid #dce6ef`
- **Form border:** `1px solid #b0c4d6`
- **Subtle border:** `#eef2f7`

---

## Buttons

### Primary (Amber CTA)
- Background: `--secondary` (`#f5a31e`)
- Text: `--text-dark` (`#1a2737`)
- Border: `2px solid #f5a31e`
- Hover bg: `--secondary-dark` (`#c47e0a`), text white

### Secondary (Ghost)
- Background: transparent
- Text: `--text-light`
- Border: `2px solid #f4f7fa`
- Hover bg: `--primary`, text white

---

## App Shell

| Token                       | Value  |
|-----------------------------|--------|
| `--sidebar-width`           | 260px  |
| `--sidebar-collapsed-width` | 64px   |
| `--topbar-height`           | 56px   |

---

## Semantic Aliases

`tokens.css` also exports semantic aliases (`--color-primary`, `--font-sans`, `--space-4`, etc.) that map legacy variable names to HSG brand tokens. These ensure backward compatibility with existing component files without requiring mass rewrites.
