import { canonicalUrlForLocale, getSeoLocale, hasSeoLocale } from './locales.mjs';
import { localizedWelcomeMarkdown, renderWelcomeHtml } from './welcome-content.mjs';

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtmlText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceSeoAttribute(html, field, attribute, value) {
  const tagPattern = new RegExp(`<[^>]+data-seo-field=["']${field}["'][^>]*>`, 'i');
  return html.replace(tagPattern, tag => {
    const attributePattern = new RegExp(`(\\s${attribute}=["'])[^"']*(["'])`, 'i');
    return tag.replace(attributePattern, `$1${escapeHtmlAttribute(value)}$2`);
  });
}

function replaceSeoText(html, field, value) {
  const pattern = new RegExp(`(<[^>]+data-seo-field=["']${field}["'][^>]*>)[\\s\\S]*?(<\\/[^>]+>)`, 'i');
  return html.replace(pattern, `$1${escapeHtmlText(value)}$2`);
}

function replaceApplicationSchema(html, locale, canonicalUrl) {
  const pattern = /(<script\b[^>]*\bid=["']application-schema["'][^>]*>)([\s\S]*?)(<\/script>)/i;
  return html.replace(pattern, (match, opening, source, closing) => {
    try {
      const schema = JSON.parse(source);
      schema.name = locale.name;
      schema.url = canonicalUrl;
      schema.description = locale.description;
      schema.inLanguage = locale.htmlLang;
      return `${opening}\n${JSON.stringify(schema, null, 2)}\n    ${closing}`;
    } catch (_) {
      return match;
    }
  });
}

export function renderLocalizedSeoHtml(sourceHtml, localeOrCode) {
  const locale = typeof localeOrCode === 'string' ? getSeoLocale(localeOrCode) : localeOrCode;
  const canonicalUrl = canonicalUrlForLocale(locale);
  let html = sourceHtml.replace(/(<html\b[^>]*\blang=["'])[^"']*(["'])/i, `$1${locale.htmlLang}$2`);

  for (const [field, attribute, value] of [
    ['canonical', 'href', canonicalUrl],
    ['meta-title', 'content', locale.title],
    ['description', 'content', locale.description],
    ['language', 'content', locale.languageName],
    ['og-url', 'content', canonicalUrl],
    ['og-title', 'content', locale.title],
    ['og-description', 'content', locale.description],
    ['twitter-url', 'content', canonicalUrl],
    ['twitter-title', 'content', locale.title],
    ['twitter-description', 'content', locale.description]
  ]) {
    html = replaceSeoAttribute(html, field, attribute, value);
  }

  html = replaceSeoText(html, 'document-title', locale.title);
  html = html.replace(/<!-- welcome-preview:start -->[\s\S]*?<!-- welcome-preview:end -->/, () =>
    `<!-- welcome-preview:start -->\n${renderWelcomeHtml(locale.code)}\n<!-- welcome-preview:end -->`);
  if (locale.code !== 'en') {
    html = html.replace(/(<textarea\b[^>]*\bid="default-markdown"[^>]*>)[\s\S]*?(<\/textarea>)/i,
      (_, opening, closing) => `${opening}${escapeHtmlText(localizedWelcomeMarkdown(locale.code))}${closing}`);
  }
  return replaceApplicationSchema(html, locale, canonicalUrl);
}

function redirectWithoutInvalidLanguage(url) {
  const destination = new URL(url);
  destination.searchParams.delete('lang');
  return Response.redirect(destination.toString(), 308);
}

function redirectToNormalizedLanguage(url, languageCode) {
  const destination = new URL(url);
  destination.searchParams.set('lang', languageCode);
  return Response.redirect(destination.toString(), 308);
}

export async function handleSeoRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname !== '/' || !['GET', 'HEAD'].includes(context.request.method)) {
    return context.next();
  }

  const requestedLanguage = url.searchParams.get('lang');
  if (requestedLanguage) {
    const normalizedLanguage = requestedLanguage.toLowerCase();
    if (!hasSeoLocale(normalizedLanguage) || normalizedLanguage === 'en') {
      return redirectWithoutInvalidLanguage(url);
    }
    if (requestedLanguage !== normalizedLanguage) {
      return redirectToNormalizedLanguage(url, normalizedLanguage);
    }
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/html')) {
    return response;
  }

  const locale = getSeoLocale(requestedLanguage);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('Content-Language', locale.htmlLang);

  const body = context.request.method === 'HEAD' ? null : renderLocalizedSeoHtml(await response.text(), locale);
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
