# TBMQ → tbmq.io Link Migration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point every thingsboard.io entry point that leads to TBMQ (product page, docs, pricing, Try it now, docs product selector) at tbmq.io, routed through a single URL module so no tbmq.io URL is ever spelled twice.

**Architecture:** One new module, `src/data/external-sites.ts`, owns the tbmq.io origin and two URL builders. Every call site imports from it. Five surfaces change: the two mega-menu items (through the shared `SubMenuLink.astro`), the docs product selector's `FAMILIES` array, the Try it now TBMQ panel's 18 links, and the pricing product toggle (which also grows a pre-paint bounce for the 16 existing `?section=tbmq-options` deep links). TBMQ docs stay live on thingsboard.io — deletion and the cross-site edge redirects are phase 2, captured in a removal inventory document.

**Tech Stack:** Astro 6 + Starlight, TypeScript, SCSS, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md`

## Global Constraints

- **No hardcoded tbmq.io URLs outside `src/data/external-sites.ts`.** Every other file imports `TBMQ_URLS`, `tbmqUrl` or `tbmqDocsUrl`. A literal `https://tbmq.io` anywhere else is a plan violation. `https://demo.tbmq.io/signup` is the one pre-existing exception and it moves *into* the module as `TBMQ_URLS.liveDemo`.
- **Path aliases only.** Use `@data/*`, `@components/*`, `@models/*`, `@util/*`, `@root/*` per `CLAUDE.md`. Never relative paths, never the legacy `~/*` for new code. (Existing `~/*` imports in a file you touch stay as they are — do not churn them.)
- **Tabs for indentation** in `.ts` / `.astro` files. Spaces in `.md`.
- **External links carry both attributes:** `target="_blank" rel="noopener noreferrer"`. Never `target="_blank"` alone.
- **Don't add narrating comments.** Comment only non-obvious *why* (a constraint, a gotcha), matching each file's existing comment density.
- **Format after editing:** run `pnpm exec prettier -w <files you changed>`. If a file was already non-format-clean in regions you didn't touch, leave those regions alone.
- **No TBMQ content deletion.** This plan deletes no `.mdx` doc, no asset, no pricing/installations data file. Everything removable is recorded in the inventory instead.
- **Never run `pnpm build` / `pnpm build:fast` without asking the user first** (project build policy in `CLAUDE.md`).

## Testing note — read before Task 1

**This repo has no unit-test runner.** There is no `test` script, no `tests/` directory, no vitest/jest dependency. Do not invent one, and do not add a test framework — that would be a scope change nobody asked for.

Verification per task is therefore:

1. `pnpm check` — Astro + TypeScript type checking (catches wrong prop types, missing interface fields, bad imports)
2. `pnpm lint:eslint` — lint, unused imports, unused vars
3. **Grep assertions on source** — prove the old literal is gone and the helper call is present
4. One end-to-end task at the end asserts against **built HTML** and runs the link checker

Steps below give you the exact commands and the exact expected output. A step that says "Expected: no output" means the grep must find nothing — `grep` exits 1, which is success for that step.

---

### Task 1: The URL module

**Files:**
- Create: `src/data/external-sites.ts`

**Interfaces:**
- Consumes: nothing.
- Produces — every later task depends on these exact names and signatures:
  - `TBMQ_ORIGIN: string` — e.g. `'https://tbmq.io'`, never a trailing slash
  - `tbmqUrl(path?: string): string` — absolute URL for a tbmq.io path
  - `tbmqDocsUrl(slug?: string): string` — absolute URL under tbmq.io's TBMQ docs root
  - `TBMQ_URLS` — readonly object with keys `product`, `docs`, `pricing`, `installations`, `liveDemo`, all `string`

- [ ] **Step 1: Write the module**

Create `src/data/external-sites.ts`:

```ts
/**
 * Sibling-site origins and URL builders.
 *
 * TBMQ moved to its own site (tbmq.io). Every thingsboard.io link that used to
 * point at a local TBMQ page resolves through the helpers here, so the origin
 * and the path shape live in exactly one place — when tbmq.io restructures,
 * this file is the only edit.
 *
 * `TBMQ_SITE_URL` mirrors the `IOT_HUB_API_URL` pattern in `src/models/iot-hub.ts`:
 * build-time `import.meta.env` with a literal fallback, no `PUBLIC_` prefix,
 * because every URL produced here is baked into HTML at build time. The one
 * client-side consumer (the pricing deep-link bounce) receives its value
 * through Astro `define:vars`.
 */

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, '');

export const TBMQ_ORIGIN = normalizeOrigin(import.meta.env.TBMQ_SITE_URL ?? 'https://tbmq.io');

/**
 * tbmq.io serves the TBMQ docs under the same tree thingsboard.io used, so a
 * slug maps across 1:1. Their `/docs/` 301s here, which is why `TBMQ_URLS.docs`
 * can stay on the shorter, restructure-proof entry point.
 */
const TBMQ_DOCS_ROOT = '/docs/mqtt-broker/';

/** Absolute tbmq.io URL for `path`. Leading and trailing slashes are normalized. */
export function tbmqUrl(path = '/'): string {
	const trimmed = path.replace(/^\/+/, '');
	const withSlash = trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
	return `${TBMQ_ORIGIN}/${withSlash}`;
}

/**
 * Absolute tbmq.io docs URL for a slug relative to the TBMQ docs root.
 *   tbmqDocsUrl('installation/')    → https://tbmq.io/docs/mqtt-broker/installation/
 *   tbmqDocsUrl('pe/installation/') → https://tbmq.io/docs/mqtt-broker/pe/installation/
 *
 * Query strings survive: a slug ending in `?installationType=helm` is not given
 * a trailing slash.
 */
export function tbmqDocsUrl(slug = ''): string {
	const trimmed = slug.replace(/^\/+/, '');
	if (trimmed === '') return tbmqUrl(TBMQ_DOCS_ROOT);
	const [pathPart, query] = trimmed.split('?');
	const path = pathPart!.endsWith('/') ? pathPart : `${pathPart}/`;
	return `${TBMQ_ORIGIN}${TBMQ_DOCS_ROOT}${path}${query ? `?${query}` : ''}`;
}

/** Named tbmq.io entry points. Prefer these over spelling a path at a call site. */
export const TBMQ_URLS = {
	product: tbmqUrl('/product/'),
	docs: tbmqUrl('/docs/'),
	pricing: tbmqUrl('/pricing/'),
	installations: tbmqUrl('/installations/'),
	liveDemo: 'https://demo.tbmq.io/signup',
} as const;
```

- [ ] **Step 2: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS. `pnpm check` reports 0 errors for `src/data/external-sites.ts`.

If `import.meta.env.TBMQ_SITE_URL` produces a TS error about an unknown env key, that is the signal to check whether the repo has an `env.d.ts` declaring `ImportMetaEnv`. `src/models/iot-hub.ts` reads `import.meta.env.IOT_HUB_API_URL` with no declaration and passes, so this should pass too — do not add a declaration file unless `pnpm check` actually demands one.

- [ ] **Step 3: Verify the produced values**

The module can't be imported by bare `node` (`import.meta.env` is Vite-injected). Assert on the source instead — the shapes are simple enough that the type checker plus these greps are the real coverage:

```bash
grep -n "TBMQ_ORIGIN\|TBMQ_DOCS_ROOT = \|product:\|docs:\|pricing:\|installations:\|liveDemo:" src/data/external-sites.ts
```

Expected: `TBMQ_ORIGIN` defined once from `import.meta.env.TBMQ_SITE_URL`, `TBMQ_DOCS_ROOT = '/docs/mqtt-broker/'`, and all five `TBMQ_URLS` keys present.

Task 12 asserts the actual resolved strings against built HTML.

- [ ] **Step 4: Format and commit**

```bash
pnpm exec prettier -w src/data/external-sites.ts
git add src/data/external-sites.ts
git commit -m "feat(tbmq): add central tbmq.io URL module"
```

---

### Task 2: Mega-menu external-link support

**Files:**
- Modify: `src/data/navigation.ts` — `SubMenuItem` interface (~L7–13)
- Modify: `src/components/Landing/SubMenuLink.astro`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `SubMenuItem.external?: boolean`, honored by `SubMenuLink.astro`. Task 3 sets it.

This is separated from Task 3 because it is a reusable capability with its own review surface: a reviewer could accept the mechanism and reject the specific links, or vice versa.

- [ ] **Step 1: Add the field to the interface**

In `src/data/navigation.ts`, the interface currently reads:

```ts
export interface SubMenuItem {
	href: string;
	icon?: string;
	heading: string;
	description?: string;
	linkClass?: string;
}
```

Add `external`:

```ts
export interface SubMenuItem {
	href: string;
	icon?: string;
	heading: string;
	description?: string;
	linkClass?: string;
	/** Opens in a new tab. Set for links that leave thingsboard.io. */
	external?: boolean;
}
```

- [ ] **Step 2: Honor it in the shared link component**

`src/components/Landing/SubMenuLink.astro` currently renders:

```astro
<a class={item.linkClass} href={item.href}>
```

Change that one line to:

```astro
<a
	class={item.linkClass}
	href={item.href}
	target={item.external ? '_blank' : undefined}
	rel={item.external ? 'noopener noreferrer' : undefined}
>
```

Leave the rest of the file untouched — the `NavIcon`, `.sub-text`, heading and description markup all stay exactly as they are.

- [ ] **Step 3: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS. No new errors.

- [ ] **Step 4: Verify nothing regressed for non-external items**

```bash
grep -c "external" src/components/Landing/SubMenuLink.astro
```

Expected: `2` (the `target` and `rel` conditionals). Every existing submenu item leaves `external` unset, so both attributes render as `undefined` and Astro omits them — internal links are byte-identical to before.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec prettier -w src/data/navigation.ts src/components/Landing/SubMenuLink.astro
git add src/data/navigation.ts src/components/Landing/SubMenuLink.astro
git commit -m "feat(nav): support external submenu links"
```

---

### Task 3: Products and Docs mega-menu TBMQ items (spec items 1 and 2)

**Files:**
- Modify: `src/data/navigation.ts` — products submenu TBMQ item (~L100–106), docs submenu TBMQ item (~L405–410)

**Interfaces:**
- Consumes: `TBMQ_URLS` from Task 1; `SubMenuItem.external` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Add the import**

At the top of `src/data/navigation.ts`, add:

```ts
import { TBMQ_URLS } from '@data/external-sites';
```

Place it with any other imports in the file. If the file currently has no imports, put it as the first line, followed by a blank line before the first `export interface`.

- [ ] **Step 2: Repoint the Products submenu item**

Find this entry in `productsSubmenu` (it is the item with `linkClass: 'mqtt-broker-lnk'` and `heading: 'TBMQ'`):

```ts
				{
					href: '/products/mqtt-broker/',
					icon: '/src/assets/images/landings/nav/tbmq-icon.svg',
					heading: 'TBMQ',
					description: 'Scalable MQTT broker',
					linkClass: 'mqtt-broker-lnk',
				},
```

Replace with:

```ts
				{
					href: TBMQ_URLS.product,
					icon: '/src/assets/images/landings/nav/tbmq-icon.svg',
					heading: 'TBMQ',
					description: 'Scalable MQTT broker',
					linkClass: 'mqtt-broker-lnk',
					external: true,
				},
```

- [ ] **Step 3: Repoint the Docs submenu item**

Find this entry in `docsSubmenu` (heading `TBMQ`, no `icon` key):

```ts
				{
					href: '/docs/mqtt-broker/',
					heading: 'TBMQ',
					description: 'Scalable MQTT broker',
					linkClass: 'mqtt-broker-lnk',
				},
```

Replace with:

```ts
				{
					href: TBMQ_URLS.docs,
					heading: 'TBMQ',
					description: 'Scalable MQTT broker',
					linkClass: 'mqtt-broker-lnk',
					external: true,
				},
```

- [ ] **Step 4: Verify both literals are gone**

```bash
grep -n "mqtt-broker" src/data/navigation.ts
```

Expected: only two lines, both `linkClass: 'mqtt-broker-lnk',`. No `href: '/products/mqtt-broker/'`, no `href: '/docs/mqtt-broker/'`.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS.

- [ ] **Step 6: Format and commit**

```bash
pnpm exec prettier -w src/data/navigation.ts
git add src/data/navigation.ts
git commit -m "feat(nav): point TBMQ menu items at tbmq.io"
```

---

### Task 4: Docs product selector (spec item 4)

**Files:**
- Modify: `src/components/VersionSwitcher.astro` — `Family` interface (~L31–43), TBMQ family entry (~L88–101), product popover `<a>` (~L250–283)

**Interfaces:**
- Consumes: `TBMQ_URLS` from Task 1.
- Produces: `Family.externalUrl?: string`.

**Critical constraint — do not remove the TBMQ `editions` array.** `currentFamily` is derived as `FAMILIES.find((f) => f.editions.some((e) => e.product === currentProduct))`. TBMQ docs are still present in phase 1, so a visitor can be *on* a TBMQ docs page; emptying `editions` makes `currentFamily` `undefined` and the non-null assertion on the following line throws at build time for all 174 TBMQ pages. Only the popover link is overridden.

- [ ] **Step 1: Add the import**

In the frontmatter of `src/components/VersionSwitcher.astro`, alongside the existing imports:

```ts
import { TBMQ_URLS } from '@data/external-sites';
```

- [ ] **Step 2: Add `externalUrl` to the `Family` interface**

The interface currently ends with:

```ts
	/** Edition to land on when this family is picked from the product dropdown.
	 * Defaults to `editions[editions.length - 1]` (Professional/Cloud first). */
	preferredEdition?: Products;
}
```

Add before the closing brace:

```ts
	/** When set, picking this family from the dropdown leaves thingsboard.io.
	 * `editions` still drives which pages belong to the family, so local docs
	 * for it keep resolving while they exist. */
	externalUrl?: string;
}
```

- [ ] **Step 3: Set it on the MQTT Broker family**

The entry currently reads:

```ts
	{
		id: Products.TBMQ,
		group: 'ecosystem',
		name: 'MQTT Broker',
		tagline: 'Reliable messaging for massive fleets',
		iconId: 'tbmq',
		editions: [
			{ product: Products.TBMQ, label: 'Community' },
			{ product: Products.TBMQ_PE, label: 'Professional' },
		],
		preferredEdition: Products.TBMQ_PE,
	},
```

Add one line — change nothing else:

```ts
	{
		id: Products.TBMQ,
		group: 'ecosystem',
		name: 'MQTT Broker',
		tagline: 'Reliable messaging for massive fleets',
		iconId: 'tbmq',
		editions: [
			{ product: Products.TBMQ, label: 'Community' },
			{ product: Products.TBMQ_PE, label: 'Professional' },
		],
		preferredEdition: Products.TBMQ_PE,
		externalUrl: TBMQ_URLS.docs,
	},
```

- [ ] **Step 4: Use it in the product popover**

The popover maps families to `<a>` elements. It currently opens:

```astro
					{FAMILIES.filter((f) => f.group === section.group).map((f) => (
						<a
							role="option"
							class:list={['ps-item', { 'is-active': f.id === currentFamily.id }]}
							href={href(preferredOf(f))}
							aria-selected={f.id === currentFamily.id}
						>
```

Change the `href` and add the two external attributes:

```astro
					{FAMILIES.filter((f) => f.group === section.group).map((f) => (
						<a
							role="option"
							class:list={['ps-item', { 'is-active': f.id === currentFamily.id }]}
							href={f.externalUrl ?? href(preferredOf(f))}
							target={f.externalUrl ? '_blank' : undefined}
							rel={f.externalUrl ? 'noopener noreferrer' : undefined}
							aria-selected={f.id === currentFamily.id}
						>
```

- [ ] **Step 5: Add the outbound affordance**

Inside the same `<a>`, the trailing check mark renders for the active family:

```astro
							{f.id === currentFamily.id && (
								<svg class="ps-check" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
									<path
										d="M4.5 10.5L8 14L15.5 6.5"
										stroke="currentColor"
										stroke-width="1.67"
										stroke-linecap="round"
										stroke-linejoin="round"
										fill="none"
									/>
								</svg>
							)}
```

Immediately **before** that block, add an outbound arrow for external families:

```astro
							{f.externalUrl && (
								<svg class="ps-external" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
									<path
										d="M6 3.5H12.5V10M12.5 3.5L4 12"
										stroke="currentColor"
										stroke-width="1.33"
										stroke-linecap="round"
										stroke-linejoin="round"
										fill="none"
									/>
								</svg>
							)}
```

Then add the style rule to the component's `<style>` block, next to the existing `.ps-check` rule. Find `.ps-check` and add after it:

```scss
	.ps-external {
		flex-shrink: 0;
		margin-left: auto;
		color: var(--color-text-secondary);
		opacity: 0.6;
	}
```

If the existing `.ps-check` rule already sets `margin-left: auto`, drop that property from `.ps-external` so the two don't fight — check before writing.

- [ ] **Step 6: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS. A `Property 'externalUrl' does not exist` error means Step 2 was skipped or landed in the wrong interface.

- [ ] **Step 7: Verify the guard rails**

```bash
grep -n "editions: \[" src/components/VersionSwitcher.astro | wc -l
```

Expected: `8` — one per family, unchanged. TBMQ's editions must still be there.

```bash
grep -n "externalUrl" src/components/VersionSwitcher.astro
```

Expected: 6 hits — the interface field, the TBMQ assignment, the `href` fallback, the `target` conditional, the `rel` conditional, and the `{f.externalUrl && (` affordance guard. Confirm the TBMQ family is the only one assigning it.

- [ ] **Step 8: Format and commit**

```bash
pnpm exec prettier -w src/components/VersionSwitcher.astro
git add src/components/VersionSwitcher.astro
git commit -m "feat(docs): point MQTT Broker product selector at tbmq.io"
```

---

### Task 5: Try it now TBMQ panel (spec item 3)

**Files:**
- Modify: `src/data/installations.ts` — the `mqtt-broker` product block (~L611–760)

**Interfaces:**
- Consumes: `TBMQ_URLS`, `tbmqDocsUrl` from Task 1.
- Produces: nothing new.

Per the spec the panel **stays on thingsboard.io**; only its 18 links leave. Do not delete the block, do not touch the other five product blocks, do not touch `heroImages` or `productTabs`.

- [ ] **Step 1: Add the import**

At the top of `src/data/installations.ts`:

```ts
import { TBMQ_URLS, tbmqDocsUrl } from '@data/external-sites';
```

- [ ] **Step 2: Repoint the two links in the description string**

The `description` field currently contains `href="/products/mqtt-broker/"` and `href="/docs/mqtt-broker/"`. Convert the string to a template literal and interpolate. The whole field becomes:

```ts
		description:
			`<b>TBMQ</b> is a highly scalable and durable <a href="${TBMQ_URLS.product}" target="_blank" rel="noopener noreferrer">MQTT message broker</a> built for real-time data processing across IoT ecosystems of any scale. It efficiently handles millions of concurrent client connections and processes millions of messages per second while maintaining low latency and reliable delivery. Designed for horizontal scalability, TBMQ seamlessly expands across cluster nodes to support massive deployments with millions of connected devices. <a href="${TBMQ_URLS.docs}" target="_blank" rel="noopener noreferrer">Read more<span class="sr-only"> about TBMQ MQTT Broker</span></a>.`,
```

Note the backticks. The copy is unchanged — only the two `href` values and the quote style.

- [ ] **Step 3: Repoint the three buttons**

```ts
		buttons: [
			{
				id: 'TryItNow_TBMQ_Demo',
				label: 'Live Demo',
				href: TBMQ_URLS.liveDemo,
				target: '_blank',
			},
			{
				id: 'TryItNow_TBMQ_Install_CE',
				label: 'Download CE',
				href: tbmqDocsUrl('installation/'),
				target: '_blank',
				secondary: true,
			},
			{
				id: 'TryItNow_TBMQ_Install_PE',
				label: 'Start PE Trial',
				href: tbmqDocsUrl('pe/installation/'),
				target: '_blank',
				secondary: true,
			},
		],
```

The Live Demo URL is unchanged in value — it moves from a literal to `TBMQ_URLS.liveDemo` so the module owns it.

- [ ] **Step 4: Repoint the six feature links**

Replace each `href` in the two `features` columns. Keep every `title` and `description` string byte-identical:

| Title | New href |
|---|---|
| Unlimited Horizontal Scaling | `tbmqDocsUrl('reference/100m-connections-performance-test/')` |
| Million-Message Throughput | `tbmqDocsUrl('reference/3m-throughput-single-node-performance-test/')` |
| Masterless High Availability | `tbmqDocsUrl('architecture/')` |
| Universal MQTT Support | `tbmqDocsUrl('getting-started/')` |
| Zero Data Loss Guarantee | `tbmqDocsUrl('architecture/')` |
| K8s & Cloud Agnostic | `tbmqDocsUrl('installation/')` |

- [ ] **Step 5: Repoint the eight deploy cards**

Replace each `href` in `deployGroups`. Keep every `logo`, `logoAlt` and `title` byte-identical:

| Title | New href |
|---|---|
| Docker (Linux or Mac OS) | `tbmqDocsUrl('installation/docker/')` |
| Docker (Windows) | `tbmqDocsUrl('installation/docker-windows/')` |
| Cluster with Docker Compose | `tbmqDocsUrl('installation/cluster/docker-compose-setup/')` |
| Cluster setup with Minikube | `tbmqDocsUrl('installation/cluster/minikube-cluster-setup/')` |
| Cluster setup on EKS | `tbmqDocsUrl('installation/cluster/aws-cluster-setup/')` |
| Cluster setup on AKS | `tbmqDocsUrl('installation/cluster/azure-cluster-setup/')` |
| Cluster setup on GCP | `tbmqDocsUrl('installation/cluster/gcp-cluster-setup/')` |
| Cluster setup using Helm | `tbmqDocsUrl('installation/?installationType=helm')` |

The Helm entry keeps its query string — `tbmqDocsUrl` splits on `?` and does not append a slash after it. That behavior is why the helper handles queries at all; if it regresses, the built URL becomes `installation/?installationType=helm/`.

- [ ] **Step 6: Verify every local TBMQ link is gone**

```bash
grep -n "'/docs/mqtt-broker\|\"/docs/mqtt-broker\|'/products/mqtt-broker\|\"/products/mqtt-broker" src/data/installations.ts
```

Expected: **no output.**

```bash
grep -c "tbmqDocsUrl(" src/data/installations.ts
```

Expected: `16` (2 buttons + 6 features + 8 deploy cards).

```bash
grep -c "TBMQ_URLS\." src/data/installations.ts
```

Expected: `3` — `.product` and `.docs` in the description, `.liveDemo` in the buttons. The import line has no dot after `TBMQ_URLS`, so it does not match.

- [ ] **Step 7: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS.

- [ ] **Step 8: Format and commit**

```bash
pnpm exec prettier -w src/data/installations.ts
git add src/data/installations.ts
git commit -m "feat(installations): point Try it now TBMQ links at tbmq.io"
```

---

### Task 6: Pricing product toggle becomes a link (spec item 7, part 1)

**Files:**
- Modify: `src/components/Pricing/ProductTabs.astro`

**Interfaces:**
- Consumes: `TBMQ_URLS` from Task 1.
- Produces: a `ProductTabs` tab entry may carry `href?: string`; when present the tab renders `<a>` rather than `<button>`. Task 7 relies on the TBMQ tab no longer being a `.product-tab` click target that switches local state.

- [ ] **Step 1: Add the import and the href**

The frontmatter currently reads:

```ts
import tbIconRaw from '../../assets/pricing/thingsboard-icon.svg?raw';
import tbmqIconRaw from '../../assets/pricing/tbmq-icon.svg?raw';

const tabs = [
	{ id: 'thingsboard', label: 'ThingsBoard', icon: tbIconRaw, gtmId: 'Pricing_PE' },
	{ id: 'tbmq', label: 'TBMQ', icon: tbmqIconRaw, gtmId: 'Pricing_TBMQ' },
];
```

Replace with:

```ts
import { TBMQ_URLS } from '@data/external-sites';
import tbIconRaw from '../../assets/pricing/thingsboard-icon.svg?raw';
import tbmqIconRaw from '../../assets/pricing/tbmq-icon.svg?raw';

const tabs: {
	id: string;
	label: string;
	icon: string;
	gtmId: string;
	/** Set for a product that lives on another site — renders an anchor, not a state toggle. */
	href?: string;
}[] = [
	{ id: 'thingsboard', label: 'ThingsBoard', icon: tbIconRaw, gtmId: 'Pricing_PE' },
	{ id: 'tbmq', label: 'TBMQ', icon: tbmqIconRaw, gtmId: 'Pricing_TBMQ', href: TBMQ_URLS.pricing },
];
```

The relative `../../assets/...` imports stay as they are — they are pre-existing and `@root/assets/...` churn is out of scope.

- [ ] **Step 2: Render an anchor for tabs with an href**

The markup currently reads:

```astro
<nav class="segment-tabs segment-tabs--product" aria-label="Product selection">
	{tabs.map((tab) => (
		<button
			type="button"
			id={tab.gtmId}
			class={`product-tab segment-tab gtm_button ${tab.id === 'thingsboard' ? 'active' : ''}`}
			data-product={tab.id}
		>
			<span class="segment-tab-icon segment-tab-icon--product" set:html={tab.icon} />
			{tab.label}
		</button>
	))}
</nav>
```

Replace with:

```astro
<nav class="segment-tabs segment-tabs--product" aria-label="Product selection">
	{tabs.map((tab) =>
		tab.href ? (
			<a
				id={tab.gtmId}
				class="segment-tab gtm_button"
				href={tab.href}
				target="_blank"
				rel="noopener noreferrer"
			>
				<span class="segment-tab-icon segment-tab-icon--product" set:html={tab.icon} />
				{tab.label}
			</a>
		) : (
			<button
				type="button"
				id={tab.gtmId}
				class={`product-tab segment-tab gtm_button ${tab.id === 'thingsboard' ? 'active' : ''}`}
				data-product={tab.id}
			>
				<span class="segment-tab-icon segment-tab-icon--product" set:html={tab.icon} />
				{tab.label}
			</button>
		)
	)}
</nav>
```

Two deliberate differences on the anchor: **no `product-tab` class** (that class is the click-delegation hook for local product switching — an outbound link must not match it) and **no `data-product`** (nothing local to activate).

- [ ] **Step 3: Style the anchor like a tab**

`.segment-tab` styling currently assumes a `<button>`. Anchors bring browser defaults a button doesn't have. In the `<style lang="scss" is:global>` block, find the `.segment-tab {` rule and add these three properties to it (the rule already sets `color`, so put them next to it):

```scss
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
		text-align: center;
```

`-webkit-tap-highlight-color` may already be present in that rule — check first and don't duplicate it.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS.

- [ ] **Step 5: Verify the anchor is not a local switch target**

```bash
grep -n "product-tab\|data-product=" src/components/Pricing/ProductTabs.astro
```

Expected: exactly one line carrying `product-tab` and one carrying `data-product=`, both inside the `<button>` branch. If either appears in the `<a>` branch, the outbound tab will also try to switch local state.

- [ ] **Step 6: Format and commit**

```bash
pnpm exec prettier -w src/components/Pricing/ProductTabs.astro
git add src/components/Pricing/ProductTabs.astro
git commit -m "feat(pricing): render TBMQ product tab as a link to tbmq.io"
```

---

### Task 7: Remove local TBMQ pricing sections and bounce deep links (spec item 7, part 2)

**Files:**
- Modify: `src/pages/pricing/index.astro`

**Interfaces:**
- Consumes: `TBMQ_URLS` from Task 1; the anchor tab from Task 6.
- Produces: nothing new.

**Do not delete any file.** `src/data/pricing/tbmq-*.ts`, `src/data/pricing/faq/tbmq-*.ts`, `src/components/Pricing/Tbmq*Calculator.astro` and `src/scripts/pricing/calc-tbmq-*.ts` all stay on disk — Task 10 records them for the phase-2 sweep. This task only stops the page from rendering and wiring them.

- [ ] **Step 1: Add the import**

In the frontmatter of `src/pages/pricing/index.astro`:

```ts
import { TBMQ_URLS } from '@data/external-sites';
```

- [ ] **Step 2: Delete the TBMQ product content block**

Remove the entire element that opens with:

```astro
		<!-- ═══ TBMQ product sections ═══ -->
		<div class="pricing-product-content" data-product-content="tbmq" style="display:none;">
```

through its matching `</div>`. That span covers `<ProductSubTabs product="tbmq" … />`, the `tbmq-ce` section, the `tbmq-pe` section (header row, `BillingToggle`, `TbmqPaygCalculator`, `TbmqPerpetualCalculator`, `PerpetualBenefits`, the perpetual bottom CTA) and the `tbmq-private-cloud` section (`TbmqPrivateCloudCalculator` plus the `See full details` CTA pointing at `/docs/mqtt-broker/pe/subscription/`).

Leave the ThingsBoard block (`data-product-content="thingsboard"`) and everything after the TBMQ block completely untouched.

- [ ] **Step 3: Delete `tbmqSubTabs`**

Remove the whole `const tbmqSubTabs = enrichTabs([...]);` declaration (the three entries `tbmq-ce`, `tbmq-pe`, `tbmq-private-cloud`). Keep `tbSubTabs` and `enrichTabs` themselves.

- [ ] **Step 4: Add the pre-paint bounce**

In the `<script is:inline>` block that defines `window.__resolvePricingState`, the opening tag becomes:

```astro
		<script is:inline define:vars={{ tbmqPricingUrl: TBMQ_URLS.pricing }}>
```

Inside `window.__resolvePricingState`, the `sectionMap` currently reads:

```js
					const sectionMap = {
						'thingsboard-pe-options': { product: 'thingsboard', subtab: 'thingsboard-pe' },
						'tbmq-options': { product: 'tbmq' },
					};
```

Replace it with the ThingsBoard-only map, and add the bounce immediately above it:

```js
					// TBMQ pricing lives on tbmq.io now. 16 pages still deep-link
					// `?section=tbmq-options` / `?product=tbmq-*` here; Cloudflare
					// `_redirects` can't match query strings, so bounce in-page. This
					// runs pre-paint, so the ThingsBoard tab never flashes first.
					if (sectionParam === 'tbmq-options' || (productParam && productParam.startsWith('tbmq'))) {
						window.location.replace(tbmqPricingUrl);
						return { activeProduct: 'thingsboard', activeSubTab: null, activeBilling: null };
					}
					const sectionMap = {
						'thingsboard-pe-options': { product: 'thingsboard', subtab: 'thingsboard-pe' },
					};
```

`sectionParam`, `productParam` and `solutionParam` are already read above this point in the function — do not re-declare them. The returned object must keep the same shape the rest of the resolver produces, because `initPricing()` calls the same function and destructures the result even though the navigation is already underway.

- [ ] **Step 5: Drop the TBMQ branch from `updateUrl()`**

The function currently reads:

```js
			const p = new URLSearchParams();
			if (activeProduct === 'tbmq') {
				p.set('section', 'tbmq-options');
			} else {
				p.set('section', 'thingsboard-pe-options');
			}
```

`activeProduct` can no longer become `'tbmq'` — the tab is an anchor and the resolver bounces. Simplify:

```js
			const p = new URLSearchParams();
			p.set('section', 'thingsboard-pe-options');
```

- [ ] **Step 6: Remove now-unused imports and references**

Delete these three imports:

```ts
import { tbmqCeData } from '@data/pricing/tbmq-ce.ts';
import { tbmqSelfManagedData } from '@data/pricing/tbmq-self-managed.ts';
import { tbmqPrivateCloudData } from '@data/pricing/tbmq-private-cloud.ts';
```

Also delete the imports of `TbmqPaygCalculator`, `TbmqPerpetualCalculator` and `TbmqPrivateCloudCalculator` — grep for them; they are in the same import block. Do **not** delete `ceIcon`, `smIcon`, `pcIcon`, `BillingToggle`, `CommunityEditionCard`, `PerpetualBenefits`, `NButton` or `ProductSubTabs`: the ThingsBoard sections still use every one of them. Verify each with a grep before removing anything.

Then search the rest of the file for `tbmq` and resolve each remaining hit:

```bash
grep -n "tbmq\|Tbmq\|TBMQ" src/pages/pricing/index.astro
```

Expected remaining hits after this task: only `TBMQ_URLS` (the import and the `define:vars`), plus any hit inside `faqContextMap` / `pricingFaqData` wiring. **Leave the FAQ wiring alone** — `pricingFaqData` is a single array covering both products, `faqAnswerMap` is built from all of it, and the TBMQ FAQ entries render in the shared FAQ section. Removing them is phase-2 work and would change the ThingsBoard FAQ output. If you find a `faqAnswerMap.get('tbmq-…')` call that was only used by the deleted `BillingToggle`, that call disappears with the markup — that is expected, not something to chase further.

- [ ] **Step 7: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS. Unused-import errors here are the point of Step 6 — fix them by removing the import, never by adding an eslint-disable.

- [ ] **Step 8: Verify the block is gone and the bounce is in**

```bash
grep -n "data-product-content" src/pages/pricing/index.astro
```

Expected: exactly two hits — the `thingsboard` div, and the `querySelector` in the controller. No `data-product-content="tbmq"`.

```bash
grep -n "tbmq-options\|tbmqPricingUrl" src/pages/pricing/index.astro
```

Expected: the bounce condition and `window.location.replace(tbmqPricingUrl)` and the `define:vars` — and **no** `sectionMap` entry, **no** `p.set('section', 'tbmq-options')`.

- [ ] **Step 9: Format and commit**

```bash
pnpm exec prettier -w src/pages/pricing/index.astro
git add src/pages/pricing/index.astro
git commit -m "feat(pricing): send TBMQ pricing traffic to tbmq.io"
```

---

### Task 8: Homepage and products-index ecosystem cards (spec § C)

**Files:**
- Modify: `src/data/homeEcosystem.ts` (~L20–26)
- Modify: `src/pages/products/index.astro` (~L86–94)

**Interfaces:**
- Consumes: `TBMQ_URLS` from Task 1.
- Produces: nothing new.

Both cards are marketing entry points to the TBMQ product page. Repointing them keeps the header and the page body consistent.

Neither card component supports `target`/`rel`, and adding that plumbing to two more components is out of proportion for this task — these links leave the site in the same tab, which is acceptable for a body card (unlike a menu item, where a new tab preserves the reader's place). Note it and move on.

- [ ] **Step 1: Repoint the homepage card**

In `src/data/homeEcosystem.ts`, add the import:

```ts
import { TBMQ_URLS } from '@data/external-sites';
```

Then change the MQTT Broker entry's `href: '/products/mqtt-broker/',` to:

```ts
		href: TBMQ_URLS.product,
```

Leave `name`, `description` and `icon` untouched.

- [ ] **Step 2: Repoint the products-index card**

In `src/pages/products/index.astro`, add to the frontmatter imports:

```ts
import { TBMQ_URLS } from '@data/external-sites';
```

Then change the TBMQ card's `href: '/products/mqtt-broker/',` to:

```ts
		href: TBMQ_URLS.product,
```

Leave `icon`, `alt`, `title`, `desc`, `cls` and `color` untouched.

- [ ] **Step 3: Verify**

```bash
grep -n "products/mqtt-broker" src/data/homeEcosystem.ts src/pages/products/index.astro
```

Expected: **no output.**

- [ ] **Step 4: Type-check and lint**

```bash
pnpm check && pnpm lint:eslint
```

Expected: both PASS.

- [ ] **Step 5: Format and commit**

```bash
pnpm exec prettier -w src/data/homeEcosystem.ts src/pages/products/index.astro
git add src/data/homeEcosystem.ts src/pages/products/index.astro
git commit -m "feat(marketing): point TBMQ ecosystem cards at tbmq.io"
```

---

### Task 9: Repo-wide hardcoded-URL audit

**Files:** none modified unless a violation is found.

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: a clean invariant that Task 12 re-checks against built output.

This is the Global Constraints check, run once while the changes are fresh.

- [ ] **Step 1: Assert no tbmq.io literal escaped the module**

```bash
grep -rn "tbmq\.io" src/ --include="*.ts" --include="*.astro" --include="*.tsx" | grep -v "^src/data/external-sites.ts" | grep -v "^src/content/"
```

Expected: **two hits, both pre-existing and both legitimate** — `src/components/LiveDemoCard.astro` uses `demo.tbmq.io` as display copy and as a reachability probe, which is a hostname shown to the reader rather than a link target. Leave it.

Any other hit is a Global Constraints violation: replace it with a helper call from `src/data/external-sites.ts`.

- [ ] **Step 2: Confirm the deliberately-untouched surfaces are still untouched**

```bash
git diff --stat main...HEAD -- src/content/ | tail -3
```

Expected: **no output** — phase 1 edits no content file. TBMQ docs, `_includes` and blog posts are all phase-2 work per the spec.

```bash
git diff --name-only main...HEAD | sort
```

Expected exactly:

```
docs/superpowers/plans/2026-07-27-tbmq-io-link-migration.md
docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md
src/components/Landing/SubMenuLink.astro
src/components/Pricing/ProductTabs.astro
src/components/VersionSwitcher.astro
src/data/external-sites.ts
src/data/homeEcosystem.ts
src/data/installations.ts
src/data/navigation.ts
src/pages/pricing/index.astro
src/pages/products/index.astro
```

If `main` is not the right base, use the branch point: `git merge-base HEAD main`.

- [ ] **Step 3: No commit**

Nothing changed. If Step 1 or 2 found a violation, fix it, then commit with `fix(tbmq): route <file> through the URL module` and re-run both steps.

---

### Task 10: Removal inventory document (spec item 5)

**Files:**
- Create: `docs/tbmq-migration/removal-inventory.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the phase-2 checklist.

Write it by hand from the counts below. Every count was measured on this branch — re-run each command and use the number you get, so the document is true at commit time rather than copied.

- [ ] **Step 1: Re-measure the counts**

```bash
find src/content/docs/docs/mqtt-broker -name "*.mdx" -not -path "*/pe/*" | wc -l   # expect 84
find src/content/docs/docs/mqtt-broker/pe -name "*.mdx" | wc -l                    # expect 90
find src/content/_includes/docs/mqtt-broker -name "*.mdx" | wc -l                  # expect 88
ls src/assets/images/landings/mqtt-broker/ | wc -l                                 # expect 37
du -sh src/assets/images/landings/mqtt-broker/                                     # expect ~2.0M
ls src/content/blog/ | grep -ci "tbmq"                                             # expect 8
grep -rl "docs/mqtt-broker" src/content/ | wc -l                                   # expect 219
```

- [ ] **Step 2: Write the document**

Create `docs/tbmq-migration/removal-inventory.md` with these sections. Use real paths and the line numbers you verify with `grep -n` at write time — do not copy a line number without checking it.

````markdown
# TBMQ removal inventory (phase 2)

TBMQ moved to tbmq.io. Phase 1 (see
`docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md`) repointed the
entry points. This is the checklist for phase 2: delete the TBMQ content that
still lives here and replace it with cross-site redirects.

Counts measured 2026-07-27 on branch `tbmq-migration`.

## Order of operations

1. Add the redirects (§ Redirects) — they must be live before the content goes,
   so no request ever lands on a deleted page.
2. Delete content (§ Docs content, § Marketing, § Blog).
3. Remove the plumbing (§ Sidebar, § Product plumbing) — this is what makes
   `pnpm check` fail if a reference was missed.
4. Delete the unreferenced data (§ Pricing, § Try it now).
5. `pnpm generate:redirects`, then `pnpm check && pnpm lint:eslint && pnpm lint:slugcheck && pnpm lint:linkcheck`.

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

- `src/models/site.models.ts` — `Products.TBMQ`, `Products.TBMQ_PE` and their `productDocsPrefix` entries
- `src/util/path-utils.ts` — `productVersions` entries plus the `mqtt-broker/` prefix branches (5 sites)
- `src/routeData.ts` — the TBMQ / TBMQ_PE path branches
- `src/util/ogContext.ts` — `'mqtt-broker/pe/'` and `'mqtt-broker/'` in `MARKETING_ALLOWLIST`
- `src/components/DocLink.astro` — the `TBMQ` / `TBMQ_PE` entries in the `tbBase` map
- `src/components/VersionSwitcher.astro` — the `Products.TBMQ` family (drop the whole entry; `externalUrl` alone is no longer enough once local editions are gone)
- `scripts/lint-linkcheck.ts` — the `/docs/mqtt-broker/` → `/docs/mqtt-broker/pe/` `consolidationPatterns` entry

## Marketing

- `src/pages/products/mqtt-broker/index.astro`, `privacy-policy.astro`, `terms-of-use.astro`
- `src/pages/open-graph/_shared/marketing-meta.ts` — 3 entries (`/products/mqtt-broker/`, `…/privacy-policy/`, `…/terms-of-use/`)
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

## Pricing

Unreferenced since phase 1 — the page stopped rendering them:

- `src/data/pricing/tbmq-ce.ts`, `tbmq-self-managed.ts`, `tbmq-private-cloud.ts`
- `src/data/pricing/faq/tbmq-ce.ts`, `tbmq-self-managed-payg.ts`, `tbmq-self-managed-perp.ts`, `tbmq-private-cloud.ts` (and their registration in `src/data/pricing/faq/index.ts`)
- `src/components/Pricing/TbmqPaygCalculator.astro`, `TbmqPerpetualCalculator.astro`, `TbmqPrivateCloudCalculator.astro`
- `src/scripts/pricing/calc-tbmq-payg.ts`, `calc-tbmq-pc.ts`, `calc-tbmq-perp.ts`
- `src/assets/pricing/tbmq-icon.svg` — still used by the outbound tab in `ProductTabs.astro`; keep it unless that tab is also removed
- the pre-paint bounce in `src/pages/pricing/index.astro` — keep it, it is what makes the 16 legacy deep links work

## Try it now

- the `mqtt-broker` product block in `src/data/installations.ts`, and its entry in `productTabs` at the bottom of that file
- the TBMQ hero images it references under `src/assets/images/landings/mqtt-broker/`

## Redirects

Add to `DYNAMIC_REDIRECTS` in `src/data/redirects.ts` (46 of the 100-rule
Cloudflare dynamic budget in use today):

```
/docs/mqtt-broker/*    → https://tbmq.io/docs/mqtt-broker/:splat 301
/docs/pe/mqtt-broker/* → https://tbmq.io/docs/mqtt-broker/pe/:splat 301
```

Add to `NON_DOCS_REDIRECTS`:

```
/products/mqtt-broker/ → https://tbmq.io/product/ 301
/blog/<each of the 8 slugs above>/ → https://tbmq.io/blog/<slug>/ 301
```

Then prune the now-superseded TBMQ entries already in `src/data/redirects.ts`
(`SINGLE_REDIRECTS`, `CATCH_ALL_REDIRECTS` — the `mqtt-broker/install`,
`mqtt-broker/pe/install`, `pe/mqtt-broker/install` and `pe/mqtt-broker` groups)
and the five `/docs/*/search/` entries in `devFallbackRedirects` in
`astro.redirects.ts` that mention `mqtt-broker`.

The splats **must** go in `DYNAMIC_REDIRECTS`, not `NON_DOCS_REDIRECTS`:
`astro.redirects.ts` feeds `NON_DOCS_REDIRECTS` to Astro's `redirects:` config,
where a splat over `/docs/mqtt-broker/*` collides with the real content routes.

Cloudflare applies redirect rules regardless of whether a file exists at the
path, so the splats take effect the moment they deploy — which is why they land
before the content deletion, not after.
````

- [ ] **Step 3: Verify no placeholders**

```bash
grep -n "TBD\|TODO\|FIXME\|XXX" docs/tbmq-migration/removal-inventory.md
```

Expected: **no output.**

- [ ] **Step 4: Spot-check three line references**

Pick any three `astro.sidebar.ts` line numbers you wrote and confirm each:

```bash
sed -n '3803p;3855p;4339p' astro.sidebar.ts
```

Expected: the `export const tbmqSidebar`, `export const tbmqPeSidebar` and `export const tbmqSidebarTabLinks` declarations. If a number is off, fix the document — a stale line reference is worse than none.

- [ ] **Step 5: Commit**

```bash
git add docs/tbmq-migration/removal-inventory.md
git commit -m "docs(tbmq): add phase-2 removal inventory"
```

---

### Task 11: Static verification sweep

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–10.
- Produces: green CI-equivalent checks.

- [ ] **Step 1: Run the full CI set**

```bash
pnpm check && pnpm lint:eslint && pnpm lint:slugcheck
```

Expected: all three PASS. These are exactly what GitHub Actions runs, so a failure here fails the PR.

- [ ] **Step 2: If anything fails, fix it before continuing**

Do not proceed to Task 12 with a red check. A build takes minutes; a type error found now costs seconds.

- [ ] **Step 3: No commit unless a fix was needed**

If you fixed something, commit it with a `fix(...)` message scoped to the file.

---

### Task 12: Built-output verification

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–11.
- Produces: evidence that the resolved URLs are correct in real HTML.

This is where Task 1's URL builders are actually tested — against rendered output rather than source.

- [ ] **Step 1: Ask the user before building**

`CLAUDE.md` requires it. Ask: "Run `pnpm build:fast` to verify, or skip?" Wait for the answer. If they skip, note in the final report that built-output verification did not run, and stop here.

- [ ] **Step 2: Build**

```bash
pnpm build:fast
```

Expected: completes with no errors.

- [ ] **Step 3: Assert the mega-menu links resolved**

```bash
grep -o 'href="https://tbmq.io/product/"[^>]*' dist/index.html | head -2
grep -o 'href="https://tbmq.io/docs/"[^>]*' dist/index.html | head -2
```

Expected: both found, each carrying `target="_blank"` and `rel="noopener noreferrer"`. The mega-menu renders on every page, so `dist/index.html` is a valid sample.

- [ ] **Step 4: Assert the docs product selector resolved**

```bash
grep -o 'href="https://tbmq.io/docs/"[^>]*' dist/docs/index.html | head -2
```

Expected: found with `target="_blank"` and `rel="noopener noreferrer"` — this is the Ecosystem → MQTT Broker row in the product popover.

- [ ] **Step 5: Assert the Try it now links resolved, including the query-string edge case**

```bash
grep -c 'https://tbmq.io/docs/mqtt-broker/' dist/installations/index.html
grep -o 'https://tbmq.io/docs/mqtt-broker/installation/?installationType=helm' dist/installations/index.html
```

Expected: first ≥ 16. Second must match **exactly** — no trailing slash after `helm`. A hit of `…?installationType=helm/` means `tbmqDocsUrl` mishandled the query string; fix the helper in `src/data/external-sites.ts`, not the call site.

- [ ] **Step 6: Assert the pricing tab and bounce**

```bash
grep -o 'href="https://tbmq.io/pricing/"[^>]*' dist/pricing/index.html | head -1
grep -c 'data-product-content="tbmq"' dist/pricing/index.html
grep -o 'tbmqPricingUrl' dist/pricing/index.html | head -1
```

Expected: the anchor found with `target`/`rel`; `data-product-content="tbmq"` count **0**; `tbmqPricingUrl` present (the `define:vars` binding reached the inline script).

- [ ] **Step 7: Assert no local TBMQ product links survive on the changed marketing pages**

```bash
grep -o 'href="/products/mqtt-broker/"' dist/index.html dist/products/index.html dist/installations/index.html
```

Expected: **no output.** The `/products/mqtt-broker/` page itself still exists in `dist/` — that is correct, it is phase-2 work.

- [ ] **Step 8: Run the link checker**

```bash
pnpm lint:linkcheck:nobuild
```

Expected: PASS. `pnpm build:fast` in Step 2 already produced `dist/`, so the `:nobuild` variant is right. tbmq.io URLs are skipped as external hosts (`scripts/lint-linkcheck.ts` only treats `PROD_ORIGIN` and `additionalLocalHosts` as local), so they cannot fail here — what this catches is an internal link broken by the pricing-block deletion.

- [ ] **Step 9: Manual smoke check**

Report to the user which surfaces to click through, since only they can eyeball rendering:

1. Products menu → TBMQ → `tbmq.io/product/` in a new tab
2. Docs menu → TBMQ → `tbmq.io/docs/` in a new tab
3. Any docs page → product selector → Ecosystem → MQTT Broker → `tbmq.io/docs/`, with the ↗ affordance visible in the popover row
4. `/installations/?product=mqtt-broker` → panel still renders locally; every CTA and deploy card opens tbmq.io
5. `/pricing/` → TBMQ tab opens `tbmq.io/pricing/` in a new tab; the ThingsBoard tab and its three sub-tabs behave exactly as before
6. `/pricing/?section=tbmq-options` → bounces to `tbmq.io/pricing/` with no flash of the ThingsBoard tab

- [ ] **Step 10: No commit**

Verification only. Any fix gets its own scoped commit and a re-run of the affected assertions.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| § A central URL module | 1 |
| § B item 1 — Products menu | 2, 3 |
| § B item 2 — Docs menu | 2, 3 |
| § B item 3 — Try it now, 18 links | 5 |
| § B item 4 — docs product selector | 4 |
| § B item 7 — pricing tab + query bounce | 6, 7 |
| § C — homepage + products-index cards | 8 |
| § C — blog posts deliberately excluded | 9 Step 2 asserts no content edits |
| § D — phase-2 redirects | 10 (documented, not implemented — correct per spec) |
| § E — removal inventory | 10 |
| Verification | 11, 12 |
| "No hardcoded URLs" constraint | 9 |

No gaps.

**Placeholder scan:** No TBD/TODO. Every code step carries the actual code. Every verification step carries the actual command and expected output. Task 10's document body is written out in full rather than described.

**Type consistency:** `tbmqUrl` / `tbmqDocsUrl` / `TBMQ_URLS` / `TBMQ_ORIGIN` are defined in Task 1 and used with those exact names in Tasks 3, 4, 5, 6, 7, 8. `SubMenuItem.external` is defined in Task 2 and set in Task 3. `Family.externalUrl` is defined and consumed within Task 4. `ProductTabs`' `href` is defined and consumed within Task 6, and Task 7 depends only on the class/attribute contract Task 6 Step 5 asserts.

**One risk worth flagging to the reviewer:** Task 7 Step 6 removes imports based on grep. `ceIcon`, `smIcon` and `pcIcon` are shared between `tbSubTabs` and the deleted `tbmqSubTabs`, so they must survive. `pnpm check` catches an over-removal immediately (undefined identifier), and `pnpm lint:eslint` catches an under-removal (unused import) — the two together make this safe, but it is the step most likely to need a second pass.
