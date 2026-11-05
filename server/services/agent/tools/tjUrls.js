// URL/image builders for tractorjunction.com, matching routes/web.php of the TJ Laravel app.
// Non-English pages live under a locale prefix (/hi/, /mr/, ...); English has none.
const SITE = process.env.TJ_SITE_URL || 'https://www.tractorjunction.com';
const ASSETS = 'https://assets.tractorjunction.com/tractor-junction/assets/images/upload';

function firstImage(images, image) {
  const src = (images || image || '').split(/,|\$\$/)[0]?.trim();
  if (!src) return null;
  return src.startsWith('http') ? src : `${ASSETS}/${src}?width=347&height=202`;
}

const base = (lang) => (lang && lang !== 'en' ? `${SITE}/${lang}` : SITE);

// /{brandSlug}-tractor/{slug}/
const tractorUrl = (brandSlug, slug, lang) => `${base(lang)}/${brandSlug}-tractor/${slug}/`;
// /implement/{brandSlug}/{slug}/
const implementUrl = (brandSlug, slug, lang) => `${base(lang)}/implement/${brandSlug}/${slug}/`;
// /harvester/{id}/{brandSlug}-{slug}-combine-harvester/
const harvesterUrl = (id, brandSlug, slug, lang) => `${base(lang)}/harvester/${id}/${brandSlug}-${slug}-combine-harvester/`;
// /{categorySlug}-news/{slug}/
const newsUrl = (categorySlug, slug, lang) => `${base(lang)}/${categorySlug || 'tractor'}-news/${slug}/`;

// Strip HTML from CMS fields so they can be fed to the LLM compactly
function plainText(html, max = 400) {
  if (!html) return '';
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

module.exports = { SITE, firstImage, tractorUrl, implementUrl, harvesterUrl, newsUrl, plainText };
