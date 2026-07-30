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

// `import.meta.env` only exists under Vite. The redirects generator
// (`pnpm generate:redirects`) and Astro's config loader pull this file in under
// plain Node, where the guard short-circuits to the literal fallback.
const envSiteUrl = import.meta.env ? import.meta.env.TBMQ_SITE_URL : undefined;

export const TBMQ_ORIGIN = normalizeOrigin(envSiteUrl ?? 'https://tbmq.io');

/**
 * tbmq.io is a TBMQ-only site, so its docs tree carries no `mqtt-broker/`
 * segment: thingsboard.io's `/docs/mqtt-broker/<slug>` is `/docs/<slug>` there,
 * a 1:1 mapping by prefix substitution.
 */
const TBMQ_DOCS_ROOT = '/docs/';

/**
 * Absolute docs root with trailing slash (`https://tbmq.io/docs/`). For redirect
 * splat templates (`` `${TBMQ_DOCS_BASE}pe/:splat` ``), where `tbmqDocsUrl` can't
 * be used — it would append a trailing slash after `:splat`.
 */
export const TBMQ_DOCS_BASE = `${TBMQ_ORIGIN}${TBMQ_DOCS_ROOT}`;

/** Absolute tbmq.io URL for `path`. Leading and trailing slashes are normalized. */
export function tbmqUrl(path = '/'): string {
	const trimmed = path.replace(/^\/+/, '');
	const withSlash = trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
	return `${TBMQ_ORIGIN}/${withSlash}`;
}

/**
 * Absolute tbmq.io docs URL for a slug relative to the TBMQ docs root.
 *   tbmqDocsUrl('installation/')    → https://tbmq.io/docs/installation/
 *   tbmqDocsUrl('pe/installation/') → https://tbmq.io/docs/pe/installation/
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
	// The site root is the product landing — tbmq.io has no separate /product/ page.
	product: tbmqUrl('/'),
	docs: tbmqUrl('/docs/'),
	liveDemo: 'https://demo.tbmq.io/signup',
} as const;
