/**
 * TBMQ product site — the landing lives at the site root since the tbmq.io
 * cutover; /products/mqtt-broker/ still builds but is superseded in production
 * by an edge redirect, so internal links must point here directly. src/data/redirects.ts
 * keeps its own private TBMQ_ORIGIN copy: node scripts import it directly and
 * cannot resolve the `@models` alias.
 */
export const TBMQ_SITE_URL = 'https://tbmq.io/';

/**
 * Contact page with the TBMQ subject pre-selected. The subject value must
 * match an <option> in ContactForm.astro — the prefill silently no-ops on
 * unknown values.
 */
export const TBMQ_CONTACT_US_URL = '/contact-us/?subject=TBMQ';
