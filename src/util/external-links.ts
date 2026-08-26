/**
 * Off-site link policy, shared by every render site that emits anchors from
 * data-driven hrefs: an absolute http(s) URL leaves thingsboard.io, so it
 * opens in a new tab with rel="noopener noreferrer"; local paths get neither
 * attribute. Not related to @util/site-links, which is the rehype normalizer
 * for production-origin URLs.
 */
export const isExternalHref = (href: string): boolean => /^https?:\/\//.test(href);

/** Spread onto an `<a>` (or NButton) to apply the off-site link policy in one place. */
export const externalLinkAttrs = (href: string | undefined): { target?: '_blank'; rel?: string } =>
	href !== undefined && isExternalHref(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
