# Frontend Design Skill

When designing or updating UI for Crypts of Sui, follow these principles:

## Visual Identity
- **Theme**: Dark medieval dungeon crawler — stone textures, torch glow, blood red accents
- **Color palette**: Use the custom CSS variables defined in globals.css:
  - `--color-stone-*` for backgrounds and text
  - `--color-gold` / `--color-gold-bright` for highlights, borders, legendary items
  - `--color-blood` for damage, death, danger
  - `--color-torch` for warmth, glow effects, fire
  - `--color-ice` for rare items, cold effects
  - `--color-mana` for magic, epic items
  - `--color-heal` for healing, health restoration
  - `--color-parchment` for readable text on dark backgrounds
- **Fonts**: Cinzel (headings/display), Cormorant Garamond (body), JetBrains Mono (stats/code)

## Component Patterns
- Use the `.card` class for panels and containers (glass-morphism with gold border glow)
- Use `.cta-btn` for primary actions
- Use `.rune-divider` for section breaks
- Animations should feel atmospheric: slow pulses, fades, subtle floats
- Use Unicode symbols for flavor: ☠ ♦ ★ ⚔ 🛡 ❤ — keep it text-based roguelike aesthetic

## Layout Rules
- Mobile-first responsive design
- Game UI should be a single-screen layout (no scrolling during gameplay)
- Use CSS Grid for dungeon maps, Flexbox for panels
- Keep game HUD visible at all times (hero stats, inventory quick-access)

## Accessibility
- Ensure sufficient contrast on dark backgrounds
- Use semantic HTML elements
- Support keyboard navigation for game actions

## Tech Stack
- Tailwind v4 with custom theme (no tailwind.config — use CSS variables in globals.css)
- React 19 with Next.js 16 App Router
- Avoid heavy animation libraries — use CSS animations and transitions
- No external UI component libraries — hand-crafted components
