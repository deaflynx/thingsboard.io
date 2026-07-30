# TBMQ removal inventory

TBMQ moved to tbmq.io. The first pass (see
`docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md`) repointed four
entry points: the Products menu, the Docs menu, the docs left-panel product
selector, and the Try it now TBMQ panel.

The second pass **landed the edge cutover** — every `/docs/mqtt-broker/*` and
`/products/mqtt-broker/` request now 301s to tbmq.io, so inbound Google results and
links from other sites resolve without a per-link source edit. Deployment order is
tbmq.io first, then thingsboard.io, so nothing lands on a missing page.

Counts measured 2026-07-27 on branch `tbmq-migration`.

## Status

| | What | State | Where in this document |
|---|---|---|---|
| A | The `/docs/mqtt-broker/*` cutover redirect | **done** | § Redirects |
| B | Pricing page TBMQ toggle | awaiting go-ahead | § Pricing |
| C | Homepage + `/products/` ecosystem cards | awaiting go-ahead | § Marketing ecosystem cards |
| D | Delete the TBMQ docs, marketing pages, blog posts and assets | awaiting go-ahead | § Docs content, § Marketing, § Blog |

With A in place, **D is unblocked** — the redirects already cover every URL the
deletion would remove. **B and C are independent** of both and can ship at any time.

## Order of operations for the remaining sweep (D)

1. ~~Add the redirects~~ — done, see § Redirects.
2. Delete content (§ Docs content, § Marketing, § Blog).
3. Remove the plumbing (§ Sidebar, § Product plumbing) — this is what makes
   `pnpm check` fail if a reference was missed.
4. Delete the data files (§ Pricing, § Try it now).
5. `pnpm generate:redirects`, then `pnpm check && pnpm lint:eslint && pnpm lint:slugcheck && pnpm lint:redirects && pnpm lint:linkcheck`.

**Live gap until D lands:** the TBMQ pages are still built and still in the sitemap,
so crawlers are pointed at URLs that now 301 cross-domain. Either accept it for the
gap, or give those pages a cross-site `<link rel="canonical">` — the sitemap
integration only includes self-canonical pages, so a cross-site canonical drops them
automatically.

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

Only the panel's **three CTA buttons** were repointed at tbmq.io in the first pass.
**16 links in this block are still local** and still resolve on thingsboard.io: the
two in the `description` string (`/products/mqtt-broker/`, `/docs/mqtt-broker/`),
the six feature links, and the eight deploy-card links. They were deliberately left
alone until TBMQ docs actually come down — repointing them is part of item A/D, not
a separate decision.

- the `mqtt-broker` product block in `src/data/installations.ts` (L609–756) and the
  `mqttBroker()` image-path helper it uses (L56)
- `productTabs` (L759) needs no entry removed — it is derived from `products` — but
  its label ternary ends in `: 'TBMQ'` (L772) as the catch-all branch, so that
  fallback has to be re-pointed at whichever product should own it
- the TBMQ hero images it references under `src/assets/images/landings/mqtt-broker/`

## Redirects — item A, landed

tbmq.io mirrors the docs tree slug-for-slug, but **without the `mqtt-broker/`
product segment** — that site is TBMQ-only, so `/docs/mqtt-broker/<slug>` here is
`/docs/<slug>` there. The cutover is therefore pure prefix substitution.

All of the below is in `src/data/redirects.ts` and regenerated into
`public/_redirects` + `public/redirects.json`. The origin and docs root are not
spelled here — `redirects.ts` imports `TBMQ_DOCS_BASE`, `TBMQ_URLS` and
`tbmqDocsUrl` from `src/data/external-sites.ts`, so a tbmq.io restructure is still
a one-file edit.

### The cutover splats

Five entries in the `TBMQ_CUTOVER` group of `DYNAMIC_REDIRECTS`. Cloudflare takes
the **first match**, so the `install/` → `installation/` Jekyll renames precede the
generic splats:

```
/docs/mqtt-broker/pe/install/*  → https://tbmq.io/docs/pe/installation/:splat 301
/docs/pe/mqtt-broker/install/*  → https://tbmq.io/docs/pe/installation/:splat 301
/docs/mqtt-broker/install/*     → https://tbmq.io/docs/installation/:splat 301
/docs/pe/mqtt-broker/*          → https://tbmq.io/docs/pe/:splat 301
/docs/mqtt-broker/*             → https://tbmq.io/docs/:splat 301
```

The generic `/docs/mqtt-broker/*` rule covers PE too: `/docs/mqtt-broker/pe/x`
loses the segment and lands on `/docs/pe/x`, which is already correct. The separate
`/docs/pe/mqtt-broker/*` rule exists only for the legacy Jekyll ordering.

Dynamic-rule budget: **47 of Cloudflare's 100** (was 46; the five new rules replaced
four emitted by the deleted catch-all groups).

They **must** stay in `DYNAMIC_REDIRECTS`, not `NON_DOCS_REDIRECTS`:
`astro.redirects.ts` feeds `NON_DOCS_REDIRECTS` to Astro's `redirects:` config,
where a splat over `/docs/mqtt-broker/*` collides with the real content routes.
Keeping them out of the Astro config also means `pnpm dev`, `pnpm preview` and
`pnpm lint:linkcheck` still see the real TBMQ pages — the link checker stays
green and the docs remain browsable locally.

### The chain prune — done by rewriting, not deleting

`redirects.ts` held **27 `SINGLE_REDIRECTS` targeting `/docs/mqtt-broker/`** plus
**4 `CATCH_ALL_REDIRECTS` groups** (`mqtt-broker/install`, `mqtt-broker/pe/install`,
`pe/mqtt-broker/install`, `pe/mqtt-broker`). Left alone, every one would have become
a chain once the splats landed — `pnpm lint:redirects` fails and visitors pay two
round-trips.

Rather than deleting them and relying on tbmq.io to re-resolve the legacy shape on
their side, **the 27 singles were rewritten to their final tbmq.io URL** via
`tbmqDocsUrl(...)`:

```
/docs/mqtt-broker/api/  → https://tbmq.io/docs/rest-api/  (was → /docs/mqtt-broker/rest-api/)
/docs/mqtt-broker/faq/  → https://tbmq.io/docs/why-tbmq/
```

That resolves in **one hop to the right page** and depends on nothing in tbmq.io's
own redirect table — which is what the earlier draft of this document assumed, and
could not verify.

The 4 catch-all groups were **deleted** and replaced by the three `install/` splats
above, because `CatchAllRedirect` can only express a local `newPrefix` — it cannot
target another origin.

`pnpm lint:redirects` reports no chains across 1040 SINGLE + 52 NON_DOCS targets.

### Marketing

In `NON_DOCS_REDIRECTS`:

```
/products/mqtt-broker/ → https://tbmq.io/ 301
```

`/products/mqtt-broker/privacy-policy/` and `…/terms-of-use/` are **deliberately not
covered** — no splat here, so they keep serving locally until tbmq.io's equivalents
are confirmed.

### Still to add — blog

The 8 TBMQ blog posts (§ Blog) are **not redirected yet**. The rule shape is
`/blog/<slug>/ → https://tbmq.io/blog/<slug>/ 301`, but unlike the docs tree this is
not a mechanical prefix rule — each target slug has to be confirmed to exist on
tbmq.io first, or we trade 8 local pages for 8 cross-domain 404s.

### Dev-mode leftovers

`devFallbackRedirects` in `astro.redirects.ts` still has one mqtt-broker entry —
`'/docs/pe/mqtt-broker/search/': '/docs/mqtt-broker/pe/search/'` (L24). It is dev-only
(never emitted to `_redirects`) and still useful while the local docs exist; remove
it with item D.
