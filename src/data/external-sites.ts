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
