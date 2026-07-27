# TBMQ removal inventory

TBMQ moved to tbmq.io. The first pass (see
`docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md`) repointed four
entry points: the Products menu, the Docs menu, the docs left-panel product
selector, and the Try it now TBMQ panel. Everything below is still live on
thingsboard.io and still awaiting a decision.

Counts measured 2026-07-27 on branch `tbmq-migration`.

## Still live, awaiting a go-ahead

Each of these is independently approvable — none blocks the others:

| | What | Where in this document |
|---|---|---|
| A | The `/docs/mqtt-broker/*` cutover redirect | § Redirects |
| B | Pricing page TBMQ toggle | § Pricing |
| C | Homepage + `/products/` ecosystem cards | § Marketing ecosystem cards |
| D | Delete the TBMQ docs, marketing pages, blog posts and assets | § Docs content, § Marketing, § Blog |

**A and D are ordered:** the redirect must deploy _before_ the deletion, so no
request ever lands on a page that is already gone. **B and C are independent** of
both and can ship at any time.

## Order of operations for the full sweep (A + D)

1. Add the redirects (§ Redirects) — including the chain prune, which is not
   optional; skip it and `pnpm lint:redirects` fails.
2. Delete content (§ Docs content, § Marketing, § Blog).
3. Remove the plumbing (§ Sidebar, § Product plumbing) — this is what makes
   `pnpm check` fail if a reference was missed.
4. Delete the data files (§ Pricing, § Try it now).
5. `pnpm generate:redirects`, then `pnpm check && pnpm lint:eslint && pnpm lint:slugcheck && pnpm lint:redirects && pnpm lint:linkcheck`.

## Docs content

- `src/content/docs/docs/mqtt-broker/**` — 84 CE stubs
- `src/content/docs/docs/mqtt-broker/pe/**` — 90 PE stubs
- `src/content/_includes/docs/mqtt-broker/**` — 88 shared include files

219 files under `src/content/` reference `docs/mqtt-broker`; the splat redirects
cover every link, so none of them needs a content edit before deletion.

## Sidebar — `astro.sidebar.ts`

- `tbmqSidebar` (L3803) and `tbmqPeSidebar` (L3855)
- helpers `tbmqGuideItems` (L3568), `tbmqInstallItems` (L3683), `tbmqReferenceItems` (L3735)
- `tbmqSidebarTabLinks` (L4339), `tbmqPeSidebarTabLinks` (L4346)
- registrations: L4390, L4391 (tab-link map) and L4414, L4415 (sidebar spread)

## Product plumbing

- `src/models/site.models.ts` — `Products.TBMQ` (L14), `Products.TBMQ_PE` (L15) and their `productDocsPrefix` entries (L32–33)
- `src/util/path-utils.ts` — `productVersions` entries (L42, L47) plus the `mqtt-broker/` prefix branches (L115–116, L144–145, L202–203)
- `src/routeData.ts` — the TBMQ / TBMQ_PE path branches (L202–203)
- `src/util/ogContext.ts` — `'mqtt-broker/pe/'` and `'mqtt-broker/'` in `MARKETING_ALLOWLIST` (L23)
- `src/components/DocLink.astro` — the `TBMQ` / `TBMQ_PE` entries in the `tbBase` map (L21–22)
- `src/components/VersionSwitcher.astro` — the `Products.TBMQ` family (drop the whole entry; `externalUrl` alone is no longer enough once local editions are gone)
- `scripts/lint-linkcheck.ts` — the `/docs/mqtt-broker/` → `/docs/mqtt-broker/pe/` `consolidationPatterns` entry (L111)

## Marketing

- `src/pages/products/mqtt-broker/index.astro`, `privacy-policy.astro`, `terms-of-use.astro`
- `src/pages/open-graph/_shared/marketing-meta.ts` — 3 entries (L34–36: `/products/mqtt-broker/`, `…/privacy-policy/`, `…/terms-of-use/`)
- `src/data/tbmqNews.ts`
- `src/assets/images/landings/mqtt-broker/` — 37 files, ~2.0 MB

## Blog

All 8 TBMQ posts are already published on tbmq.io, so they are deleted here and
redirected there:

- `1-million-reasons-to-choose-tbmq-as-high-performance-mqtt-broker.mdx`
- `introducing-tbmq-professional-edition-the-mqtt-broker-for-enterprise-needs.mdx`
- `new-thingsboard-tbmq-pricing-modular-add-ons-top-ups-and-total-cost-clarity.mdx`
- `tbmq-1-3-0-release-websocket-client-advanced-mqtt-5-features-and-more.mdx`
- `tbmq-2-0-migration-to-redis-mqtt-5-0-support-and-more.mdx`
- `tbmq-2-1-new-chapter-in-mqtt-messaging-with-embedded-integrations.mdx`
- `tbmq-2-2-strengthening-mqtt-security-with-jwt-and-client-blocking.mdx`
- `tbmq-2-3-external-authentication-bulk-provisioning-and-enterprise-audit-trails.mdx`

## Pricing — item B, fully live, no decision made

Nothing here has been touched. `/pricing/` still renders its TBMQ tab, its three
sub-tabs (`tbmq-ce`, `tbmq-pe`, `tbmq-private-cloud`), all three calculators and
the TBMQ FAQ set, and every `?section=tbmq-options` deep link still resolves
locally.

Files in play when the decision comes:

- `src/pages/pricing/index.astro` — the `data-product-content="tbmq"` block (L336), `tbmqSubTabs` (L157), the three data imports (L32–34), the `'tbmq-options'` entry in `sectionMap` inside the pre-paint `is:inline` resolver (L432), and the `updateUrl()` branch that writes the param back (L1306–1307)
- `src/components/Pricing/ProductTabs.astro` — the `tbmq` tab entry (L7) and the `tbmq-icon.svg` import (L3)
- `src/data/pricing/tbmq-ce.ts`, `tbmq-self-managed.ts`, `tbmq-private-cloud.ts`
- `src/data/pricing/faq/tbmq-ce.ts`, `tbmq-self-managed-payg.ts`, `tbmq-self-managed-perp.ts`, `tbmq-private-cloud.ts` (and their registration in `src/data/pricing/faq/index.ts`, L7–10 and L23–26)
- `src/components/Pricing/TbmqPaygCalculator.astro`, `TbmqPerpetualCalculator.astro`, `TbmqPrivateCloudCalculator.astro`
- `src/scripts/pricing/calc-tbmq-payg.ts`, `calc-tbmq-pc.ts`, `calc-tbmq-perp.ts`
- `src/assets/pricing/tbmq-icon.svg`
- 16 local `/docs/mqtt-broker/…` links inside the pricing data files — `tbmq-ce.ts` (1), `faq/tbmq-ce.ts` (7), `faq/tbmq-self-managed-payg.ts` (3), `faq/tbmq-self-managed-perp.ts` (4), `faq/tbmq-private-cloud.ts` (1)

**Two things to know before deciding.**

First, **every inbound `?section=tbmq-options` link in this repo lives in TBMQ-owned
content that items A and D would remove anyway.** All 20 occurrences sit in 14
files: 10 in TBMQ docs `_includes` (which would 301 away under item A), 6 across 3
TBMQ blog posts, and 4 in `src/pages/products/mqtt-broker/index.astro` (both
deleted and redirected under item D). Nothing on a surviving page links to the
TBMQ pricing tab. So once A and D land, the in-repo half of this question answers
itself and no link edits are needed.

Second, that leaves only *external* inbound traffic — bookmarks, search results,
links from tbmq.io — and `?section=tbmq-options` **cannot be redirected at the
edge**: Cloudflare Pages `_redirects` does not match query strings. Whenever the
local TBMQ pricing content goes, those remaining hits need an in-page bounce
instead: read the param in the existing pre-paint `is:inline` resolver in
`pricing/index.astro` (L416) and `location.replace()` to tbmq.io, with the URL
injected via `define:vars={{ tbmqPricingUrl: … }}` — the pattern already used by
`Tabs.astro`, `DemoRequestForm.astro` and `IotHubRuntimeConfig.astro`. Pre-paint
placement is what keeps the ThingsBoard tab from flashing first.

## Marketing ecosystem cards — item C, fully live

Two cards still point at the local `/products/mqtt-broker/` page:

- `src/data/homeEcosystem.ts` (L25) — the homepage ecosystem card
- `src/pages/products/index.astro` (L87) — the products-ecosystem card

Both are one-line changes to `TBMQ_URLS.product`. Neither card component supports
`target`/`rel`, so these would open in the same tab — acceptable for a body card,
and not worth threading the plumbing through two more components.

## Try it now

- the `mqtt-broker` product block in `src/data/installations.ts` (L609–756) and the
  `mqttBroker()` image-path helper it uses (L56)
- `productTabs` (L759) needs no entry removed — it is derived from `products` — but
  its label ternary ends in `: 'TBMQ'` (L772) as the catch-all branch, so that
  fallback has to be re-pointed at whichever product should own it
- the TBMQ hero images it references under `src/assets/images/landings/mqtt-broker/`

## Redirects — item A, not yet added

tbmq.io mirrors the docs tree 1:1 (`tbmq.io/docs/mqtt-broker/**`), so the whole
cutover is prefix substitution. Nothing below exists in the repo yet.

### The two splats

Add to `DYNAMIC_REDIRECTS` in `src/data/redirects.ts`. The generated
`public/_redirects` currently emits **46 dynamic rules** (from 7 source entries —
several expand over category/page lists), against the Cloudflare Pages budget of
100, so this lands at 48:

```
/docs/mqtt-broker/*    → https://tbmq.io/docs/mqtt-broker/:splat 301
/docs/pe/mqtt-broker/* → https://tbmq.io/docs/mqtt-broker/pe/:splat 301
```

They **must** go in `DYNAMIC_REDIRECTS`, not `NON_DOCS_REDIRECTS`:
`astro.redirects.ts` feeds `NON_DOCS_REDIRECTS` to Astro's `redirects:` config,
where a splat over `/docs/mqtt-broker/*` collides with the real content routes.
Keeping them out of the Astro config also means `pnpm dev`, `pnpm preview` and
`pnpm lint:linkcheck` still see the real TBMQ pages — the link checker stays
green and the docs remain browsable locally.

### The chain prune — not optional

`src/data/redirects.ts` already holds **27 `SINGLE_REDIRECTS` whose targets sit
under `/docs/mqtt-broker/`** (`/docs/mqtt-broker/api/ → /docs/mqtt-broker/rest-api/`,
`…/faq/ → …/why-tbmq/`, and 25 more), plus **4 `CATCH_ALL_REDIRECTS` groups**:
`mqtt-broker/install`, `mqtt-broker/pe/install`, `pe/mqtt-broker/install`,
`pe/mqtt-broker`.

Add the splats without touching them and every one becomes a redirect chain:
`pnpm lint:redirects` fails, and real visitors pay two round-trips.

Delete all 31. This is safe **only if tbmq.io still carries the identical legacy
redirect table** — it did when the design pass checked on 2026-07-27
(`/docs/mqtt-broker/api/ → /docs/mqtt-broker/rest-api/` was present in their
`public/_redirects`), but re-confirm against their repo before deleting, because
the splat forwards the legacy shape across and tbmq.io has to resolve it on
their side.

Regenerate the counts before trusting these numbers:

```bash
node --experimental-transform-types -e "
import('./src/data/redirects.ts').then(m => {
  const t = s => (s ?? '').includes('mqtt-broker');
  console.log('singles targeting /docs/mqtt-broker/:',
    m.SINGLE_REDIRECTS.filter(e => e.target.startsWith('/docs/mqtt-broker/')).length);
  console.log('catch-all groups touching mqtt-broker:',
    m.CATCH_ALL_REDIRECTS.filter(g => t(g.oldPrefix) || t(g.newPrefix)).length);
});
"
```

Deleting the singles also drops them from `public/redirects.json`, which _is_
spread into `astro.redirects.ts` — so those legacy URLs stop resolving in
`pnpm dev` / `pnpm preview`. They are inbound-only Jekyll-era URLs and nothing in
the repo links to them, but confirm with `pnpm lint:linkcheck` rather than
assuming.

Also prune the one `/docs/*/search/` entry in `devFallbackRedirects` in
`astro.redirects.ts` that mentions `mqtt-broker` —
`'/docs/pe/mqtt-broker/search/': '/docs/mqtt-broker/pe/search/'` (L24). It is the
only one of the five entries in that map that touches TBMQ.

### Marketing and blog

Add to `NON_DOCS_REDIRECTS`:

```
/products/mqtt-broker/ → https://tbmq.io/product/ 301
/blog/<each of the 8 slugs above>/ → https://tbmq.io/blog/<slug>/ 301
```

### Sequencing

Cloudflare applies redirect rules regardless of whether a file exists at the
path, so the splats take effect the moment they deploy — TBMQ docs go dark on
thingsboard.io immediately, which is why they land _before_ the content deletion,
not after.

One loose end to decide at that point: the TBMQ pages are still built and still
in the sitemap, so crawlers get pointed at URLs that 301 cross-domain until the
deletion lands. Either accept it for the gap, or give those pages a cross-site
`<link rel="canonical">` — the sitemap integration only includes pages that are
self-canonical, so a cross-site canonical drops them automatically.
