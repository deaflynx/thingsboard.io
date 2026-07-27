# TBMQ → tbmq.io link migration — pass 1 (entry points)

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

## Scope

**Revised 2026-07-27**, after the user narrowed the first pass to four surfaces
and deferred the rest. This pass ships:

1. Products mega-menu → TBMQ
2. Docs mega-menu → TBMQ
3. Docs left-panel product selector → MQTT Broker
4. Try it now TBMQ panel (18 links)

TBMQ docs stay live and fully reachable on thingsboard.io. Deep links between doc
pages keep resolving locally.

**Deferred, each awaiting its own go-ahead:**

| Deferred | Notes |
|---|---|
| Pricing page TBMQ toggle | Left for a later decision. The page keeps its local TBMQ sections, sub-tabs, calculators and FAQ, and all 16 `?section=tbmq-options` deep links keep working. Design retained in § F. |
| Homepage + `/products/` ecosystem cards | Not among the four requested surfaces. Design retained in § F. |
| `/docs/mqtt-broker/*` cutover redirect | Design in § D. |
| Deleting TBMQ docs, marketing pages, blog posts, assets | Inventory in § E. |

Rationale for holding the redirect: it would make the still-present TBMQ docs
unreachable in production the moment it deploys, because Cloudflare Pages applies
redirect rules regardless of whether an asset exists at the path. It also drags 27
chaining `SINGLE_REDIRECTS` and 4 `CATCH_ALL_REDIRECTS` groups with it (§ D).

## Design

### A. Central URL module

New file `src/data/external-sites.ts` — the only place a tbmq.io URL is spelled.

```ts
export const TBMQ_ORIGIN = normalizeOrigin(import.meta.env.TBMQ_SITE_URL ?? 'https://tbmq.io');

export function tbmqUrl(path = '/'): string;      // tbmqUrl('/product/')
export function tbmqDocsUrl(slug = ''): string;   // tbmqDocsUrl('pe/installation/')

export const TBMQ_URLS = {
  product:  tbmqUrl('/product/'),
  docs:     tbmqUrl('/docs/'),
  liveDemo: 'https://demo.tbmq.io/signup',
} as const;
```

`tbmqDocsUrl('installation/')` resolves to
`https://tbmq.io/docs/mqtt-broker/installation/`. Call sites express intent
(`tbmqDocsUrl('pe/installation/')`), never a URL string.

The `TBMQ_SITE_URL` override follows the `IOT_HUB_API_URL` precedent in
`src/models/iot-hub.ts` — build-time `import.meta.env` with a literal fallback, no
`PUBLIC_` prefix, because every URL this module produces is baked into HTML at
build time. A future client-side consumer (the pricing bounce in § F) receives its
value through Astro `define:vars` rather than needing a public env var.

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

**VersionSwitcher constraint:** the TBMQ family's `editions` array must stay
intact. `currentFamily` is derived by finding the family whose editions contain
the product parsed from the URL; with TBMQ docs still present, emptying that array
would leave `currentFamily` undefined and break every TBMQ docs page. Only the
popover link is overridden.

**`TBMQ_URLS` carries only what is consumed** — `product`, `docs`, `liveDemo`.
`pricing` and `installations` are added when the surfaces that need them are
approved.

### C. Content links are not edited

**Blog posts and docs content are deliberately excluded.** Zero non-TBMQ docs
pages link to `/docs/mqtt-broker/` — verified. All 212 in-content link sources sit
inside the TBMQ trees themselves (168 doc stubs, 44 `_includes`), plus 7 blog
posts, and all 8 TBMQ blog posts are already duplicated on tbmq.io. So every one
of them is content scheduled for deletion; editing their links is wasted work.

Worse, markdown link destinations cannot call a helper, so repointing the blog
posts would mean 34 hardcoded `https://tbmq.io/...` strings in content — precisely
what § A exists to prevent. The § D splats cover them for free.

### D. The docs cutover redirect (deferred)

Links *inside* the TBMQ docs tree (219 files reference `/docs/mqtt-broker`) are
not edited. They are covered wholesale by three edge rules:

```
/docs/mqtt-broker/*    → https://tbmq.io/docs/mqtt-broker/:splat 301
/docs/pe/mqtt-broker/* → https://tbmq.io/docs/mqtt-broker/pe/:splat 301
/products/mqtt-broker/ → https://tbmq.io/product/ 301
```

The two `/docs/` splats belong in `DYNAMIC_REDIRECTS` in `src/data/redirects.ts`
(46 of the 100-rule Cloudflare dynamic budget currently used, so this lands at
48); `/products/mqtt-broker/` is static and goes in `NON_DOCS_REDIRECTS`. The
splats must **not** go in `NON_DOCS_REDIRECTS`, which `astro.redirects.ts` feeds
to Astro's `redirects:` config — a splat there collides with the real content
routes. Keeping them out of the Astro config also leaves `pnpm dev`,
`pnpm preview` and `pnpm lint:linkcheck` seeing the real TBMQ pages.

**The chain prune is part of this, not optional.** `src/data/redirects.ts` already
holds 27 `SINGLE_REDIRECTS` whose targets sit under `/docs/mqtt-broker/`, plus 4
`CATCH_ALL_REDIRECTS` groups (`mqtt-broker/install`, `mqtt-broker/pe/install`,
`pe/mqtt-broker/install`, `pe/mqtt-broker`). Add the splats without touching them
and every one becomes a redirect chain: `pnpm lint:redirects` fails and visitors
pay two round-trips. All 31 get deleted — safe because tbmq.io carries the
identical legacy redirect table (verified: `/docs/mqtt-broker/api/ →
/docs/mqtt-broker/rest-api/` is in their `public/_redirects` too), so the splat
forwards the legacy shape across and tbmq.io resolves it.

Deleting the singles also drops them from `public/redirects.json`, which *is*
spread into `astro.redirects.ts`, so those Jekyll-era URLs stop resolving in dev
and preview. Nothing in the repo links to them; confirm with `pnpm lint:linkcheck`
rather than assuming.

The 8 TBMQ blog posts get one static rule each, in `NON_DOCS_REDIRECTS`:

```
/blog/<slug>/ → https://tbmq.io/blog/<slug>/ 301
```

for `1-million-reasons-to-choose-tbmq-as-high-performance-mqtt-broker`,
`introducing-tbmq-professional-edition-the-mqtt-broker-for-enterprise-needs`,
`new-thingsboard-tbmq-pricing-modular-add-ons-top-ups-and-total-cost-clarity`,
`tbmq-1-3-0-release-websocket-client-advanced-mqtt-5-features-and-more`,
`tbmq-2-0-migration-to-redis-mqtt-5-0-support-and-more`,
`tbmq-2-1-new-chapter-in-mqtt-messaging-with-embedded-integrations`,
`tbmq-2-2-strengthening-mqtt-security-with-jwt-and-client-blocking`,
`tbmq-2-3-external-authentication-bulk-provisioning-and-enterprise-audit-trails`.

### E. Removal inventory

New file `docs/tbmq-migration/removal-inventory.md`, hand-written, grouped by
area with counts and line references:

- **Docs content** — 84 CE + 90 PE stubs under `src/content/docs/docs/mqtt-broker/**`; 88 files under `src/content/_includes/docs/mqtt-broker/**`
- **Sidebar** — `astro.sidebar.ts`: `tbmqSidebar` (L3803), `tbmqPeSidebar` (L3855), helpers `tbmqGuideItems` / `tbmqInstallItems` / `tbmqReferenceItems` (L3568 / L3683 / L3735), tab links (L4339 / L4346), registrations (L4390 / L4391 / L4414 / L4415)
- **Product plumbing** — `Products.TBMQ` / `TBMQ_PE` in `src/models/site.models.ts`; `src/util/path-utils.ts` (5 sites); `src/routeData.ts`; `src/util/ogContext.ts`; the `tbBase` map in `src/components/DocLink.astro`; the `VersionSwitcher` family; the `/docs/mqtt-broker/` entry in the link checker's `consolidationPatterns`
- **Marketing** — `src/pages/products/mqtt-broker/{index,privacy-policy,terms-of-use}.astro`; 3 entries in `src/pages/open-graph/_shared/marketing-meta.ts`; `src/data/tbmqNews.ts`; 37 assets (2.0 MB) in `src/assets/images/landings/mqtt-broker/`
- **Pricing** — 3 data files, 4 FAQ files, 3 calculator components, 3 calculator scripts, the TBMQ sections and `tbmqSubTabs` in `src/pages/pricing/index.astro`, and the `tbmq` tab in `ProductTabs.astro` — all still live
- **Try it now** — the `mqtt-broker` product block in `src/data/installations.ts`
- **Blog** — 8 TBMQ posts under `src/content/blog/`, all already live on tbmq.io (slugs listed in § D)
- **Redirects** — the 31 chaining entries to prune, the 5 `mqtt-broker` entries in `devFallbackRedirects` in `astro.redirects.ts`, plus every rule from § D verbatim

### F. Deferred designs, retained

These were designed in full before being deferred. The inventory carries them so
the reasoning is not re-derived when the go-ahead comes.

**Pricing toggle.** `ProductTabs.astro` tab entries gain an optional `href`; a tab
with one renders an `<a>` (no `product-tab` class, no `data-product` — both are
local-switch hooks) to `tbmq.io/pricing/`. `pricing/index.astro` drops the
`data-product-content="tbmq"` block, `tbmqSubTabs`, the three calculator mounts,
the now-unused imports and the `'tbmq-options'` entry in `sectionMap`.

The removal must be from the render, not `display:none` — left in, the block keeps
roughly 18 crawlable links to local TBMQ docs in the DOM.

`?section=tbmq-options` (optionally `&product=tbmq-*`) is linked from 16 places: 9
TBMQ docs `_includes`, 3 blog posts, 4 spots on the TBMQ product landing page.
Cloudflare Pages `_redirects` cannot match query strings, so the bounce goes in the
existing pre-paint `is:inline` resolver in `pricing/index.astro`:
`location.replace()` when the param matches, with the URL injected via
`define:vars={{ tbmqPricingUrl: … }}` — the pattern already used by `Tabs.astro`,
`DemoRequestForm.astro` and `IotHubRuntimeConfig.astro`. Pre-paint placement is
what keeps the ThingsBoard tab from flashing first.

If § D ships first, 9 of those 16 links become unreachable on their own — their
source pages 301 away — so this shrinks to 7.

**Ecosystem cards.** `src/data/homeEcosystem.ts` (~L25) and
`src/pages/products/index.astro` (~L87) → `TBMQ_URLS.product`, one line each.
Neither card component supports `target`/`rel`, so they would open in the same tab
— acceptable for a body card, and not worth threading that plumbing through two
more components.

## Error handling

External links carry `rel="noopener noreferrer"` alongside `target="_blank"`,
matching the convention already used throughout `installations.ts` and
`Banner.astro`.

If `TBMQ_SITE_URL` is set to a value with a trailing slash, `normalizeOrigin`
strips it; the helpers never emit `//` between origin and path.

Nothing in this pass can 404: every tbmq.io target it uses was verified present in
the `../tbmq.io` build output (`dist/product/`, `dist/docs/`).

## Verification

- `pnpm check` — Astro/TypeScript
- `pnpm lint:eslint`
- `pnpm lint:slugcheck`
- `pnpm lint:linkcheck` — confirms no internal link broke; tbmq.io URLs are
  skipped as external
- Manual: Products menu, Docs menu, docs left-panel product selector and
  `/installations/?product=mqtt-broker` each open the correct tbmq.io page in a new
  tab; TBMQ docs pages and `/pricing/` behave exactly as before

Ask before running any build, per the project build policy in `CLAUDE.md`.

## Out of scope

- Deleting TBMQ docs, marketing pages, pricing data or assets
- The cross-site edge redirects and their 31-entry chain prune (§ D)
- The pricing page and the two ecosystem cards (§ F)
- Rewriting links *within* the TBMQ docs tree or in blog posts (§ C)
- The `/mqtt/*` MQTT glossary pages — they exist only on tbmq.io, not here
- `demo.tbmq.io` links, which are already external and correct
