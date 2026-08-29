import { handleSeoRequest } from '../seo/server-render.mjs';

export async function onRequest(context) {
  return handleSeoRequest(context);
}
