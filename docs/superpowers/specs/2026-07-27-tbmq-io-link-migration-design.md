# TBMQ → tbmq.io link migration (phase 1)

**Date:** 2026-07-27
**Branch:** `tbmq-migration`
**Status:** approved

## Problem

TBMQ is moving off thingsboard.io onto its own site, `tbmq.io` (local clone at
`../tbmq.io`). Every thingsboard.io surface that points at a TBMQ product page,
TBMQ docs page or TBMQ pricing must send visitors to tbmq.io instead.

The TBMQ docs and marketing pages currently hosted on thingsboard.io will be
deleted in a later phase. Before that deletion, we need a written index of
everything that has to go, so the removal is a mechanical sweep rather than a
rediscovery exercise.

## Constraints and findings

**tbmq.io mirrors the docs tree 1:1.** `tbmq.io/docs/mqtt-broker/**` has the
same shape as thingsboard.io's. tbmq.io also 301s its own `/docs/` →
`/docs/mqtt-broker/` and `/products/mqtt-broker/` → `/`. Every deep doc link
therefore maps by prefix substitution — no per-page mapping table is needed,
now or at deletion time.

**No hardcoded URLs.** The repo's established pattern for a value that must not
be spelled twice is a single exported constant consumed everywhere:
`PROD_ORIGIN` in `src/consts.ts`, `src/data/versions.ts` for version strings,
`src/data/redirects.ts` as the redirect single source of truth. Absolute
external redirect targets already exist (`'/support-ukraine/':
'https://u24.gov.ua/'`), so nothing new is needed at the redirect layer.

**Entry points funnel through few files.** The Products and Docs mega-menu
items both render through `SubMenuLink.astro`; the docs product selector is one
entry in the `FAMILIES` array in `VersionSwitcher.astro`; the pricing toggle is
`ProductTabs.astro` plus an inline script in `pricing/index.astro`.

**The link checker ignores other hosts.** `scripts/lint-linkcheck.ts` treats
non-local hosts as external and does not fetch them, so absolute `tbmq.io` URLs
keep `pnpm lint:linkcheck` green.

## Phase split

Phase 1 (this spec) changes **entry points only**. TBMQ docs stay live and
reachable on thingsboard.io; deep links between doc pages keep resolving
locally. Phase 2 (later, separate change) deletes the TBMQ content and adds the
cross-site edge redirects.

Rationale: a cutover redirect shipped now would make the still-present TBMQ docs
unreachable in production, because Cloudflare Pages applies redirect rules
regardless of whether an asset exists at the path.

## Design

### A. Central URL module

New file `src/data/external-sites.ts` — the only place a tbmq.io URL is spelled.

```ts
export const TBMQ_ORIGIN = import.meta.env.PUBLIC_TBMQ_SITE_URL || 'https://tbmq.io';

export function tbmqUrl(path = '/'): string;      // tbmqUrl('/product/')
export function tbmqDocsUrl(slug = ''): string;   // tbmqDocsUrl('pe/installation/')

export const TBMQ_URLS = {
  product:       tbmqUrl('/product/'),
  docs:          tbmqUrl('/docs/'),
  pricing:       tbmqUrl('/pricing/'),
  installations: tbmqUrl('/installations/'),
  liveDemo:      'https://demo.tbmq.io/signup',
} as const;
```

`tbmqDocsUrl('installation/')` resolves to
`https://tbmq.io/docs/mqtt-broker/installation/`. Call sites express intent
(`tbmqDocsUrl('pe/installation/')`), never a URL string. The
`PUBLIC_TBMQ_SITE_URL` override follows the repo's existing `PUBLIC_SITE_URL`
convention so a staging build can target a preview deploy.

Both helpers normalise slashes so callers may pass a slug with or without
leading/trailing `/`. `TBMQ_ORIGIN` never carries a trailing slash.

The bare docs entry uses `/docs/` rather than `/docs/mqtt-broker/`. tbmq.io
301s it on their side, and `/docs/` is the URL that survives a future
restructure of their docs tree. Switching to the no-hop target is a one-line
change in this file.

### B. Entry-point changes

| Item | File | Change |
|---|---|---|
| 1 | `src/data/navigation.ts` (~L101) | Products submenu TBMQ item: `href: TBMQ_URLS.product`, `external: true` |
| 2 | `src/data/navigation.ts` (~L406) | Docs submenu TBMQ item: `href: TBMQ_URLS.docs`, `external: true` |
| 1, 2 | `src/data/navigation.ts` `SubMenuItem` | add optional `external?: boolean` |
| 1, 2 | `src/components/Landing/SubMenuLink.astro` | emit `target="_blank" rel="noopener noreferrer"` when `item.external` |
| 3 | `src/data/installations.ts` (TBMQ block, ~L611–760) | 18 URLs through the helpers: 2 in the HTML description, 2 of 3 buttons (Live Demo already external), 6 feature links, 8 deploy cards. The TBMQ panel itself stays on thingsboard.io |
| 4 | `src/components/VersionSwitcher.astro` | add `externalUrl?: string` to the `Family` interface; the MQTT Broker family gets `externalUrl: TBMQ_URLS.docs`; the product popover row uses it with `target`/`rel` and an outbound affordance |
| 7 | `src/components/Pricing/ProductTabs.astro` | tab entries gain an optional `href`; a tab with `href` renders an `<a>` instead of a `<button>`. TBMQ → `TBMQ_URLS.pricing` |
| 7 | `src/pages/pricing/index.astro` | drop the `data-product-content="tbmq"` block, `tbmqSubTabs`, the three TBMQ calculator mounts, the now-unused imports, and `?product=tbmq` activation from the inline controller |

**VersionSwitcher constraint:** the TBMQ family's `editions` array must stay
intact. `currentFamily` is derived by finding the family whose editions contain
the product parsed from the URL; with TBMQ docs still present in phase 1,
emptying that array would leave `currentFamily` undefined and break every TBMQ
docs page. Only the popover link is overridden.

**Pricing markup removal:** the TBMQ pricing sections are removed from the
render rather than left behind `display:none`. Left in, they keep roughly 18
crawlable links to local TBMQ docs in the DOM that have to die in phase 2
anyway. The underlying files — `src/data/pricing/tbmq-{ce,self-managed,private-cloud}.ts`,
`src/data/pricing/faq/tbmq-*.ts`, `src/components/Pricing/Tbmq*Calculator.astro`,
`src/scripts/pricing/calc-tbmq-*.ts` — stay on disk for the phase-2 sweep and
are listed in the removal inventory.

### C. Remaining non-docs references (phase 1)

These are ThingsBoard-branded surfaces pointing at TBMQ. Included so the header
does not leave the site while other surfaces stay local:

- `src/data/homeEcosystem.ts` (~L25) — homepage ecosystem card → `TBMQ_URLS.product`
- `src/pages/products/index.astro` (~L87) — products-ecosystem card → `TBMQ_URLS.product`
- 7 posts under `src/content/blog/` linking `/docs/mqtt-broker/*` or
  `/products/mqtt-broker/*` → absolute tbmq.io URLs

### D. Deferred to phase 2

Links *inside* the TBMQ docs tree (219 files reference `/docs/mqtt-broker`) are
not edited. They are covered wholesale by three edge rules added at deletion
time:

```
/docs/mqtt-broker/*    → https://tbmq.io/docs/mqtt-broker/:splat 301
/docs/pe/mqtt-broker/* → https://tbmq.io/docs/mqtt-broker/pe/:splat 301
/products/mqtt-broker/ → https://tbmq.io/product/ 301
```

These belong in `DYNAMIC_REDIRECTS` in `src/data/redirects.ts` (46 of the
100-rule Cloudflare dynamic budget currently used). They must **not** go in
`NON_DOCS_REDIRECTS`, which `astro.redirects.ts` feeds to Astro's `redirects:`
config — a splat there collides with the real content routes.

### E. Removal inventory

New file `docs/tbmq-migration/removal-inventory.md`, hand-written, grouped by
area with counts and line references:

- **Docs content** — 84 CE + 90 PE stubs under `src/content/docs/docs/mqtt-broker/**`; 88 files under `src/content/_includes/docs/mqtt-broker/**`
- **Sidebar** — `astro.sidebar.ts`: `tbmqSidebar` (L3803), `tbmqPeSidebar` (L3855), helpers `tbmqGuideItems` / `tbmqInstallItems` / `tbmqReferenceItems` (L3568 / L3683 / L3735), tab links (L4339 / L4346), registrations (L4390 / L4391 / L4414 / L4415)
- **Product plumbing** — `Products.TBMQ` / `TBMQ_PE` in `src/models/site.models.ts`; `src/util/path-utils.ts` (5 sites); `src/routeData.ts`; `src/util/ogContext.ts`; the `tbBase` map in `src/components/DocLink.astro`; the `VersionSwitcher` family; the `/docs/mqtt-broker/` entry in the link checker's `consolidationPatterns`
- **Marketing** — `src/pages/products/mqtt-broker/{index,privacy-policy,terms-of-use}.astro`; 3 entries in `src/pages/open-graph/_shared/marketing-meta.ts`; `src/data/tbmqNews.ts`; 37 assets (2.0 MB) in `src/assets/images/landings/mqtt-broker/`
- **Pricing** — 3 data files, 4 FAQ files, 3 calculator components, 3 calculator scripts, plus the TBMQ sections in `src/pages/pricing/index.astro`
- **Try it now** — the `mqtt-broker` product block in `src/data/installations.ts`
- **Redirects** — existing TBMQ entries in `src/data/redirects.ts` (`SINGLE_REDIRECTS`, `CATCH_ALL_REDIRECTS`, `devFallbackRedirects` in `astro.redirects.ts`) to prune, plus the three phase-2 rules from § D verbatim

## Error handling

External links carry `rel="noopener noreferrer"` alongside `target="_blank"`,
matching the convention already used throughout `installations.ts` and
`Banner.astro`.

If `PUBLIC_TBMQ_SITE_URL` is set to a value with a trailing slash, the helpers
normalise it; they never emit `//` between origin and path.

Nothing in phase 1 can 404: every tbmq.io target in this spec was verified
present in the `../tbmq.io` build output (`dist/product/`, `dist/pricing/`,
`dist/installations/`, `dist/docs/`).

## Verification

- `pnpm check` — Astro/TypeScript
- `pnpm lint:eslint`
- `pnpm lint:slugcheck`
- `pnpm lint:linkcheck` — confirms no internal link broke; tbmq.io URLs are
  skipped as external
- Manual: Products menu, Docs menu, docs product selector, `/installations/?product=mqtt-broker`,
  `/pricing/` TBMQ tab — each opens the correct tbmq.io page in a new tab

Ask before running any build, per the project build policy in `CLAUDE.md`.

## Out of scope

- Deleting TBMQ docs, marketing pages, pricing data or assets (phase 2)
- Adding the cross-site edge redirects (phase 2)
- Rewriting links *within* the TBMQ docs tree (phase 2, covered by the splats)
- The `/mqtt/*` MQTT glossary pages — they exist only on tbmq.io, not here
- `demo.tbmq.io` links, which are already external and correct
