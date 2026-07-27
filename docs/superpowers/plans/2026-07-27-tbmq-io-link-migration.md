# TBMQ → tbmq.io Link Migration — Pass 1 (Entry Points) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point four thingsboard.io entry points that lead to TBMQ — the Products menu, the Docs menu, the docs left-panel product selector, and the Try it now TBMQ panel — at tbmq.io, routed through a single URL module so no tbmq.io URL is ever spelled twice.

**Architecture:** One new module, `src/data/external-sites.ts`, owns the tbmq.io origin and two URL builders. Every call site imports from it. Four surfaces change: the two mega-menu items (through the shared `SubMenuLink.astro`), the docs product selector's `FAMILIES` array, and the Try it now TBMQ panel's 18 links. TBMQ docs stay live and fully reachable on thingsboard.io — deletion and the cross-site edge redirects are later work, captured in a removal inventory document.

**Explicitly out of scope** (deferred by the user on 2026-07-27, each awaiting its own go-ahead):

| Deferred | Why it is not here |
|---|---|
| The pricing page TBMQ toggle | Left for a later decision. The page keeps its local TBMQ sections, sub-tabs, calculators and FAQ, and the 16 `?section=tbmq-options` deep links keep working. |
| Homepage + `/products/` ecosystem cards | Not among the four requested surfaces. |
| The `/docs/mqtt-broker/*` edge redirect | Would take TBMQ docs offline in production the moment it deploys. It also drags 27 chaining `SINGLE_REDIRECTS` and 4 `CATCH_ALL_REDIRECTS` groups with it — all documented in Task 7's inventory. |
| Blog posts, TBMQ docs content, `_includes` | Content edits; covered by the redirect when it lands. |

Do not implement any deferred row, even if it looks like a natural extension of a task you are on. Flag it and move on.

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
  - `TBMQ_URLS` — readonly object with keys `product`, `docs`, `liveDemo`, all `string`

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
 * because every URL produced here is baked into HTML at build time.
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

/**
 * Named tbmq.io entry points. Prefer these over spelling a path at a call site.
 * Add a key when a surface needs it — `/pricing/` and `/installations/` are
 * deliberately absent until the pricing migration is approved.
 */
export const TBMQ_URLS = {
	product: tbmqUrl('/product/'),
	docs: tbmqUrl('/docs/'),
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
grep -n "TBMQ_ORIGIN\|TBMQ_DOCS_ROOT = \|product:\|docs:\|liveDemo:" src/data/external-sites.ts
```

Expected: `TBMQ_ORIGIN` defined once from `import.meta.env.TBMQ_SITE_URL`, `TBMQ_DOCS_ROOT = '/docs/mqtt-broker/'`, and all three `TBMQ_URLS` keys present.

Task 9 asserts the actual resolved strings against built HTML.

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

**Critical constraint — do not remove the TBMQ `editions` array.** `currentFamily` is derived as `FAMILIES.find((f) => f.editions.some((e) => e.product === currentProduct))`. TBMQ docs are still present, so a visitor can be *on* a TBMQ docs page; emptying `editions` makes `currentFamily` `undefined` and the non-null assertion on the following line throws at build time for all 174 TBMQ pages. Only the popover link is overridden.

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

### Task 6: Repo-wide hardcoded-URL audit

**Files:** none modified unless a violation is found.

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a clean invariant that Task 9 re-checks against built output.

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

Expected: **no output** — this phase edits no content file. TBMQ docs, `_includes` and blog posts are all later work.

```bash
git diff --name-only main...HEAD | sort
```

Expected exactly — five source files and the two planning documents:

```
docs/superpowers/plans/2026-07-27-tbmq-io-link-migration.md
docs/superpowers/specs/2026-07-27-tbmq-io-link-migration-design.md
docs/tbmq-migration/removal-inventory.md
src/components/Landing/SubMenuLink.astro
src/components/VersionSwitcher.astro
src/data/external-sites.ts
src/data/installations.ts
src/data/navigation.ts
```

If `main` is not the right base, use the branch point: `git merge-base HEAD main`.

- [ ] **Step 3: Confirm no deferred surface was touched**

```bash
git diff --name-only main...HEAD | grep -E "pricing|homeEcosystem|products/index|redirects" || echo "clean"
```

Expected: `clean`. A hit means a deferred row from the header table was implemented — revert that file. The pricing page, the two ecosystem cards and `src/data/redirects.ts` are all awaiting separate go-aheads.

```bash
git diff main...HEAD -- src/data/redirects.ts public/_redirects public/redirects.json | wc -l
```

Expected: `0`. No redirect work belongs in this phase.

- [ ] **Step 4: No commit**

Nothing changed. If Step 1 or 2 found a violation, fix it, then commit with `fix(tbmq): route <file> through the URL module` and re-run both steps.

---

### Task 7: Removal inventory document (spec item 5)

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
| C | Homepage + `/products/` ecosystem cards | § Marketing |
| D | Delete the TBMQ docs, marketing pages, blog posts and assets | § Docs content, § Marketing, § Blog |

**A and D are ordered:** the redirect must deploy *before* the deletion, so no
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

## Pricing — item B, fully live, no decision made

Nothing here has been touched. `/pricing/` still renders its TBMQ tab, its three
sub-tabs (`tbmq-ce`, `tbmq-pe`, `tbmq-private-cloud`), all three calculators and
the TBMQ FAQ set, and all 16 `?section=tbmq-options` deep links still resolve
locally.

Files in play when the decision comes:

- `src/pages/pricing/index.astro` — the `data-product-content="tbmq"` block, `tbmqSubTabs`, and the `'tbmq-options'` entry in `sectionMap` inside the pre-paint `is:inline` resolver
- `src/components/Pricing/ProductTabs.astro` — the `tbmq` tab entry
- `src/data/pricing/tbmq-ce.ts`, `tbmq-self-managed.ts`, `tbmq-private-cloud.ts`
- `src/data/pricing/faq/tbmq-ce.ts`, `tbmq-self-managed-payg.ts`, `tbmq-self-managed-perp.ts`, `tbmq-private-cloud.ts` (and their registration in `src/data/pricing/faq/index.ts`)
- `src/components/Pricing/TbmqPaygCalculator.astro`, `TbmqPerpetualCalculator.astro`, `TbmqPrivateCloudCalculator.astro`
- `src/scripts/pricing/calc-tbmq-payg.ts`, `calc-tbmq-pc.ts`, `calc-tbmq-perp.ts`
- `src/assets/pricing/tbmq-icon.svg`
- 18 local TBMQ links inside `src/data/pricing/tbmq-ce.ts` and the four `faq/tbmq-*.ts` files

**Two things to know before deciding.**

First, if item A (the docs redirect) ships before this, the pricing question
partly answers itself: 9 of the 16 `?section=tbmq-options` deep links live in
TBMQ docs `_includes`, whose pages would 301 away — so those links become
unreachable and need no work.

Second, `?section=tbmq-options` cannot be redirected at the edge. Cloudflare
Pages `_redirects` does not match query strings. Whenever the local TBMQ pricing
content goes, the remaining deep links need an in-page bounce instead: read the
param in the existing pre-paint `is:inline` resolver in `pricing/index.astro` and
`location.replace()` to tbmq.io, with the URL injected via
`define:vars={{ tbmqPricingUrl: … }}` — the pattern already used by `Tabs.astro`,
`DemoRequestForm.astro` and `IotHubRuntimeConfig.astro`. Pre-paint placement is
what keeps the ThingsBoard tab from flashing first.

## Marketing ecosystem cards — item C, fully live

Two cards still point at the local `/products/mqtt-broker/` page:

- `src/data/homeEcosystem.ts` — the homepage ecosystem card
- `src/pages/products/index.astro` — the products-ecosystem card

Both are one-line changes to `TBMQ_URLS.product`. Neither card component supports
`target`/`rel`, so these would open in the same tab — acceptable for a body card,
and not worth threading the plumbing through two more components.

## Try it now

- the `mqtt-broker` product block in `src/data/installations.ts`, and its entry in `productTabs` at the bottom of that file
- the TBMQ hero images it references under `src/assets/images/landings/mqtt-broker/`

## Redirects — item A, not yet added

tbmq.io mirrors the docs tree 1:1 (`tbmq.io/docs/mqtt-broker/**`), so the whole
cutover is prefix substitution. Nothing below exists in the repo yet.

### The two splats

Add to `DYNAMIC_REDIRECTS` in `src/data/redirects.ts` (46 of the 100-rule
Cloudflare dynamic budget in use today, so this lands at 48):

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

Delete all 31. This is safe because **tbmq.io carries the identical legacy
redirect table** — verified: `/docs/mqtt-broker/api/ → /docs/mqtt-broker/rest-api/`
is present in their `public/_redirects` too. So the splat forwards the legacy
shape across and tbmq.io resolves it on their side.

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

Deleting the singles also drops them from `public/redirects.json`, which *is*
spread into `astro.redirects.ts` — so those legacy URLs stop resolving in
`pnpm dev` / `pnpm preview`. They are inbound-only Jekyll-era URLs and nothing in
the repo links to them, but confirm with `pnpm lint:linkcheck` rather than
assuming.

Also prune the five `/docs/*/search/` entries in `devFallbackRedirects` in
`astro.redirects.ts` that mention `mqtt-broker`.

### Marketing and blog

Add to `NON_DOCS_REDIRECTS`:

```
/products/mqtt-broker/ → https://tbmq.io/product/ 301
/blog/<each of the 8 slugs above>/ → https://tbmq.io/blog/<slug>/ 301
```

### Sequencing

Cloudflare applies redirect rules regardless of whether a file exists at the
path, so the splats take effect the moment they deploy — TBMQ docs go dark on
thingsboard.io immediately, which is why they land *before* the content deletion,
not after.

One loose end to decide at that point: the TBMQ pages are still built and still
in the sitemap, so crawlers get pointed at URLs that 301 cross-domain until the
deletion lands. Either accept it for the gap, or give those pages a cross-site
`<link rel="canonical">` — the sitemap integration only includes pages that are
self-canonical, so a cross-site canonical drops them automatically.
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

### Task 8: Static verification sweep

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: green CI-equivalent checks.

- [ ] **Step 1: Run the full CI set**

```bash
pnpm check && pnpm lint:eslint && pnpm lint:slugcheck
```

Expected: all three PASS. These are exactly what GitHub Actions runs, so a failure here fails the PR.

- [ ] **Step 2: If anything fails, fix it before continuing**

Do not proceed to Task 9 with a red check. A build takes minutes; a type error found now costs seconds.

- [ ] **Step 3: No commit unless a fix was needed**

If you fixed something, commit it with a `fix(...)` message scoped to the file.

---

### Task 9: Built-output verification

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–8.
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

- [ ] **Step 6: Assert the deferred surfaces are byte-identical**

The two surfaces left for a later decision must come out of this build unchanged:

```bash
grep -c 'data-product-content="tbmq"' dist/pricing/index.html
grep -o 'href="/products/mqtt-broker/"' dist/index.html dist/products/index.html | wc -l
grep -c 'tbmq\.io' dist/pricing/index.html
```

Expected: `1` (the local TBMQ pricing block still renders), `2` (both ecosystem cards still point locally), `0` (no tbmq.io URL leaked into the pricing page). Any other result means a deferred row from the header table was implemented.

- [ ] **Step 7: Assert the TBMQ docs are still reachable**

```bash
test -f dist/docs/mqtt-broker/index.html && echo "TBMQ docs built"
grep -c "mqtt-broker" dist/_redirects
```

Expected: `TBMQ docs built`, and the `dist/_redirects` count **unchanged from `main`** — compare with `git show main:public/_redirects | grep -c mqtt-broker`. No cutover redirect belongs in this phase.

- [ ] **Step 8: Run the link checker**

```bash
pnpm lint:linkcheck:nobuild
```

Expected: PASS. `pnpm build:fast` in Step 2 already produced `dist/`, so the `:nobuild` variant is right. tbmq.io URLs are skipped as external hosts (`scripts/lint-linkcheck.ts` only treats `PROD_ORIGIN` and `additionalLocalHosts` as local), so they cannot fail here — what this catches is an internal link accidentally broken along the way.

- [ ] **Step 9: Manual smoke check**

Report to the user which surfaces to click through, since only they can eyeball rendering:

1. Products menu → TBMQ → `tbmq.io/product/` in a new tab
2. Docs menu → TBMQ → `tbmq.io/docs/` in a new tab
3. Any docs page → left-panel product selector → Ecosystem → MQTT Broker → `tbmq.io/docs/`, with the ↗ affordance visible in the popover row
4. `/installations/?product=mqtt-broker` → panel still renders locally; every CTA, feature link and deploy card opens tbmq.io
5. Any TBMQ docs page (e.g. `/docs/mqtt-broker/getting-started/`) → still loads normally; the edition pills still switch Community ↔ Professional locally
6. `/pricing/` → unchanged: TBMQ tab still switches to local sections, all three sub-tabs and calculators work

- [ ] **Step 10: No commit**

Verification only. Any fix gets its own scoped commit and a re-run of the affected assertions.

---

## Self-Review

**Requested-scope coverage** (the four surfaces the user asked for on 2026-07-27):

| Requested surface | Task |
|---|---|
| Products menu → TBMQ | 2, 3 |
| Docs menu → TBMQ | 2, 3 |
| Docs left-panel product selector → MQTT Broker | 4 |
| Try it now TBMQ panel, 18 links | 5 |
| Supporting: central URL module | 1 |
| Supporting: no-hardcoded-URL audit + deferred-surface guard | 6 |
| Supporting: inventory of everything still live | 7 |
| Supporting: verification | 8, 9 |

**Deferred-scope coverage** — each row of the header table is documented in Task 7's inventory, not implemented: pricing (§ Pricing, item B), ecosystem cards (§ Marketing ecosystem cards, item C), the docs cutover redirect and its 31-entry chain prune (§ Redirects, item A), content deletion (§ Docs content, § Blog, item D). Tasks 6 and 9 both assert that none of them was touched.
No gaps.

**Placeholder scan:** No TBD/TODO. Every code step carries the actual code. Every verification step carries the actual command and expected output. Task 7's document body is written out in full rather than described.

**Type consistency:** `tbmqUrl` / `tbmqDocsUrl` / `TBMQ_URLS` / `TBMQ_ORIGIN` are defined in Task 1 and used with those exact names in Tasks 3, 4 and 5. `TBMQ_URLS` has exactly three keys — `product` (Task 3), `docs` (Tasks 3, 4), `liveDemo` (Task 5) — and every one is consumed, so no unused key ships. `SubMenuItem.external` is defined in Task 2 and set in Task 3. `Family.externalUrl` is defined and consumed within Task 4.

**Two risks worth flagging to the reviewer:**

1. **Task 4 must not empty the TBMQ `editions` array.** `currentFamily` is derived by matching the URL's product against `editions`, and TBMQ docs are still live — emptying it makes `currentFamily` undefined and the following non-null assertion throws at build time for all 174 TBMQ pages. Task 4's Step 7 grep is the guard.
2. **Scope creep is the main failure mode here.** Four of the original twelve tasks were cut, and the cut work is adjacent to the surviving work: an implementer in `installations.ts` may notice the pricing FAQ links, and one in `VersionSwitcher.astro` may reason that the redirect "should" come too. Tasks 6 and 9 exist to catch that, but the header table is the instruction — flag, don't implement.
