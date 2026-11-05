# AURALIS brand

## Name

**AURALIS**: from *aural* (of hearing) and *aura*. Always written in capitals in the wordmark; "Auralis" is fine in running text.

## Logo

The mark is an **"A" whose crossbar is a sound wave**, held inside an open **aura ring** with a single emitted particle.

- **The A:** the platform and its community lifting music up.
- **The wave crossbar:** sound holds the structure together.
- **The open ring and particle:** sound radiating outward, open to the community.

| Asset | File |
|---|---|
| App icon / favicon (SVG) | `src/app/icon.svg` |
| Apple touch icon | `src/app/apple-icon.png` |
| PWA icons | `public/brand/icon-192.png`, `icon-512.png` |
| Standalone mark | `public/brand/auralis-mark.svg` |
| React components | `src/components/brand/Logo.tsx` (`LogoMark`, `Wordmark`, `Logo`) |

`LogoMark` draws its colors from the active theme (`--au-primary` → `--au-accent`), so the logo follows user themes. The app icon always uses the default palette on the Deep Black tile. The `animated` variant (rotating ring, breathing wave) is reserved for loading and splash screens and respects reduced-motion settings.

**Usage**
- Keep clear space of at least ¼ of the mark's width.
- Don't rotate, stretch, recolor outside the palette, or add effects.
- Minimum size: 16 px (favicon) and 24 px in UI.

## Color

| Token | Default | Use |
|---|---|---|
| Primary: Azure Blue | `#008CFF` | actions, progress, focus, active states |
| Accent: Electric Cyan | `#3DF2FF` | highlights, gradients, visualizers |
| Background: Deep Black | `#080B10` | app background |
| Surface: Dark Charcoal | `#111720` | cards, panels, player |
| Text | `#FFFFFF` | primary text |
| Muted | `#9AA6B8` | secondary text |

The signature gradient runs from Azure Blue to Electric Cyan, bottom-left to top-right.

## Typography

- **Sora**: display type (headings, wordmark). Tight tracking for headings; the wordmark uses wide tracking (0.28em).
- **Inter**: interface and body text.

Both are open-source (SIL OFL 1.1) and self-hosted via `next/font`.

## Voice

Warm, direct and musician-first. Celebrate creators, never gatekeep, and always be clear about rights and privacy.
