/**
 * Off-site link policy, shared by every render site that emits anchors from
 * data-driven hrefs: an absolute http(s) URL leaves thingsboard.io, so it
 * opens in a new tab with rel="noopener noreferrer"; local paths get neither
 * attribute. Not related to @util/site-links, which is the rehype normalizer
 * for production-origin URLs.
 */
export const isExternalHref = (href: string): boolean => /^https?:\/\//.test(href);

/**
 * target/rel pair for the off-site link policy. Spread it as the LAST
 * attributes of the `<a>`: Astro resolves duplicate attributes last-one-wins,
 * so placing the spread last keeps the derived policy authoritative over any
 * earlier explicit target/rel at the call site.
 */
export const externalLinkAttrs = (href: string | undefined): { target?: '_blank'; rel?: string } =>
	href !== undefined && isExternalHref(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};

/**
 * rel half of the policy for anchors whose target comes from data rather than
 * being derived from the href — the single home of the noopener string.
 * Spread it right after the `target` attribute.
 */
export const relForTarget = (target?: string): { rel?: string } =>
	target === '_blank' ? { rel: 'noopener noreferrer' } : {};

/**
 * Accessible name for a link that opens in a new tab — screen readers don't
 * announce target="_blank". Names the destination host when the href is
 * off-site; internal hrefs (e.g. promo slides) get the plain suffix.
 */
export const newTabLinkLabel = (name: string, href?: string): string =>
	href !== undefined && isExternalHref(href)
		? `${name} (opens ${new URL(href).host} in a new tab)`
		: `${name} (opens in a new tab)`;
