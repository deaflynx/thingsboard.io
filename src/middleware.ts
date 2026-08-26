import { defineMiddleware } from 'astro:middleware';
import { DYNAMIC_REDIRECTS } from '@data/redirects.ts';

// Dev-only emulation of the Cloudflare edge for cross-origin splat rules (the
// TBMQ cutover group). Astro never reads public/_redirects, and the config
// `redirects:` map cannot mirror these either: Astro never substitutes params
// into external redirect targets (astro@6.3.8 core/redirects/render.js,
// resolveRedirectTarget returns external string targets verbatim). So this
// middleware replays the same first-match 301s on localhost. Local content no
// longer links into /docs/mqtt-broker/* — this covers hand-typed and inbound
// legacy URLs in `pnpm dev` (static `preview` runs no middleware).

const crossOriginRules = DYNAMIC_REDIRECTS.flatMap((group) => group.entries).filter((entry) =>
	entry.target.startsWith('http'),
);

function toRegex(source: string): RegExp {
	let body = source.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	body = body.replace(/\*/g, '(.*)');
	body = body.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '[^/]+');
	return new RegExp(`^${body}$`);
}

const compiled = crossOriginRules.map((rule) => ({
	regex: toRegex(rule.source),
	target: rule.target,
	status: (rule.status ?? 301) as 301,
}));

export const onRequest = defineMiddleware((context, next) => {
	if (!import.meta.env.DEV) return next();
	const { pathname } = context.url;
	for (const rule of compiled) {
		const match = rule.regex.exec(pathname);
		if (match) {
			return context.redirect(rule.target.replace(':splat', match[1] ?? ''), rule.status);
		}
	}
	return next();
});
