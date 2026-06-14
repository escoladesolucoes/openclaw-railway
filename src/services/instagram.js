/**
 * services/instagram.js
 *
 * Meta-side helpers for the Instagram Direct bridge:
 *  - verifySignature(rawBody, header) — validate the X-Hub-Signature-256 HMAC
 *  - sendInstagramMessage(igsid, text) — POST a reply via the Graph API
 *
 * Uses the "Instagram API with Instagram Login" flow:
 *   POST https://graph.instagram.com/<version>/me/messages
 *   body: { recipient: { id: <IGSID> }, message: { text } }
 * authenticated with the Instagram user access token.
 */

import crypto from 'crypto';
import {
  IG_APP_SECRET, IG_ACCESS_TOKEN, IG_GRAPH_HOST, IG_GRAPH_VERSION,
} from '../config/index.js';

/**
 * Validate Meta's webhook signature. Returns true only if the HMAC-SHA256 of
 * the raw request body (keyed with the app secret) matches the header value.
 * Uses a timing-safe comparison.
 */
export function verifySignature(rawBody, signatureHeader) {
  if (!IG_APP_SECRET || !signatureHeader || !rawBody) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', IG_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Send a text reply to an Instagram user (IGSID) via the Graph API.
 * Throws on non-2xx so the caller can log Meta's error payload.
 */
export async function sendInstagramMessage(recipientId, text) {
  if (!IG_ACCESS_TOKEN) throw new Error('IG_ACCESS_TOKEN is not set');

  const url = `https://${IG_GRAPH_HOST}/${IG_GRAPH_VERSION}/me/messages`
    + `?access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Graph API send failed (HTTP ${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

/** True when the minimum env needed to receive + reply is present. */
export function instagramBridgeConfigured() {
  return Boolean(IG_APP_SECRET && IG_ACCESS_TOKEN);
}
