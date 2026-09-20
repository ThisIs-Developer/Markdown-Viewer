import {
  canonicalUrlForLocale,
  getSeoLocale,
  hasSeoLocale
} from '../seo/locales.mjs';
import { localizedWelcomeMarkdown, renderWelcomeHtml } from '../seo/welcome-content.mjs';

function setAttribute(field, attribute, value) {
  const element = document.querySelector(`[data-seo-field="${field}"]`);
  if (element) element.setAttribute(attribute, value);
}

function updateApplicationSchema(locale, canonicalUrl) {
  const element = document.getElementById('application-schema');
  if (!element) return;
  try {
    const schema = JSON.parse(element.textContent);
    schema.name = locale.name;
    schema.url = canonicalUrl;
    schema.description = locale.description;
    schema.inLanguage = locale.htmlLang;
    element.textContent = JSON.stringify(schema, null, 2);
  } catch (_) {
    // Keep the server-provided schema when an extension mutates the JSON-LD.
  }
}

function applyForLanguage(languageCode) {
  const locale = getSeoLocale(languageCode);
  const canonicalUrl = canonicalUrlForLocale(locale);

  document.documentElement.lang = locale.htmlLang;
  setAttribute('canonical', 'href', canonicalUrl);
  setAttribute('meta-title', 'content', locale.title);
  setAttribute('description', 'content', locale.description);
  setAttribute('language', 'content', locale.languageName);
  setAttribute('og-url', 'content', canonicalUrl);
  setAttribute('og-title', 'content', locale.title);
  setAttribute('og-description', 'content', locale.description);
  setAttribute('twitter-url', 'content', canonicalUrl);
  setAttribute('twitter-title', 'content', locale.title);
  setAttribute('twitter-description', 'content', locale.description);
  document.title = locale.title;
  updateApplicationSchema(locale, canonicalUrl);
}

function languageFromUrl() {
  const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
  return requestedLanguage && hasSeoLocale(requestedLanguage) ? requestedLanguage.toLowerCase() : 'en';
}

const initialLanguage = languageFromUrl();
window.MarkdownViewerSeo = Object.freeze({ applyForLanguage, languageFromUrl });
applyForLanguage(initialLanguage);

// Static hosts use the same starter as Pages. Do this only before app startup:
// switching the UI language must never replace an open or saved document.
const preview = document.getElementById('welcome-preview');
if (preview) preview.outerHTML = renderWelcomeHtml(initialLanguage);
const template = document.getElementById('default-markdown');
if (template && initialLanguage !== 'en') {
  template.textContent = localizedWelcomeMarkdown(initialLanguage);
}
