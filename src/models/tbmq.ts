/**
 * TBMQ product site — the landing lives at the site root since the tbmq.io
 * cutover; /products/mqtt-broker/ still builds but is superseded in production
 * by an edge redirect, so internal links must point here directly. src/data/redirects.ts
 * keeps its own private TBMQ_ORIGIN copy: node scripts import it directly and
 * cannot resolve the `@models` alias.
 */
export const TBMQ_SITE_URL = 'https://tbmq.io/';

/**
 * TBMQ documentation root on tbmq.io. Its docs tree carries no mqtt-broker/
 * segment, so thingsboard.io's /docs/mqtt-broker/<path> lives at /docs/<path>
 * there.
 */
export const TBMQ_DOCS_URL = `${TBMQ_SITE_URL}docs/`;

/** Deep link into the TBMQ docs. Pass page paths with their trailing slash (e.g. 'installation/'). */
export const tbmqDocsUrl = (path: string): string => `${TBMQ_DOCS_URL}${path}`;

/**
 * Contact page with the TBMQ subject pre-selected. The subject value must
 * match an <option> in ContactForm.astro — the prefill silently no-ops on
 * unknown values.
 */
export const TBMQ_CONTACT_US_URL = '/contact-us/?subject=TBMQ';
