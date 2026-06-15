/**
 * services/hermesAgent.js
 *
 * Hermes backend for bridged channels (Instagram, etc.). Instead of running a
 * local OpenClaw agent, we POST the user's message to a remote Hermes
 * api_server (OpenAI-compatible Chat Completions) and return the reply text.
 *
 *   POST {HERMES_API_URL}/v1/chat/completions
 *   headers: Authorization: Bearer <HERMES_API_KEY>
 *            X-Hermes-Session-Id:  <sessionKey>   (per-user conversation memory)
 *            X-Hermes-Session-Key: <sessionKey>   (per-user long-term memory scope)
 *   body:    { model, messages: [{ role: "user", content }], stream: false }
 *
 * The stable sessionKey (e.g. `instagram-<igsid>`) keeps each user's memory
 * isolated and persistent across turns — verified live on the Vivero AI Hermes.
 */

import { HERMES_API_URL, HERMES_API_KEY, HERMES_MODEL } from '../config/index.js';
import { log } from '../utils/log.js';

// Agent turns can take a while (model latency). We already 200-acked the
// webhook and Meta gives a 24h reply window, so a generous timeout is fine.
const HERMES_TIMEOUT_MS = 180_000;

/** True when the minimum env needed to reach the Hermes api_server is present. */
export function hermesConfigured() {
  return Boolean(HERMES_API_URL && HERMES_API_KEY);
}

/** Best-effort liveness probe of the Hermes api_server (/health needs no auth). */
export async function hermesHealthy() {
  if (!HERMES_API_URL) return false;
  try {
    const res = await fetch(`${HERMES_API_URL}/health`, { signal: AbortSignal.timeout(8_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run one Hermes turn.
 * @returns {Promise<{reply: string|null, code: number, raw: string}>}
 *   code 0 on success; otherwise the HTTP status (or -1 on transport error).
 */
export async function runHermesTurn(text, sessionKey) {
  if (!hermesConfigured()) {
    throw new Error('Hermes backend not configured (set HERMES_API_URL and HERMES_API_KEY)');
  }

  let res;
  try {
    res = await fetch(`${HERMES_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HERMES_API_KEY}`,
        'X-Hermes-Session-Id': sessionKey,
        'X-Hermes-Session-Key': sessionKey,
      },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages: [{ role: 'user', content: text }],
        stream: false,
      }),
      signal: AbortSignal.timeout(HERMES_TIMEOUT_MS),
    });
  } catch (err) {
    log.error(`[hermes] transport error for session ${sessionKey}: ${err.message}`);
    return { reply: null, code: -1, raw: err.message };
  }

  const raw = await res.text();
  if (!res.ok) {
    log.warn(`[hermes] HTTP ${res.status} for session ${sessionKey}: ${raw.slice(-400)}`);
    return { reply: null, code: res.status, raw };
  }

  const reply = extractReplyText(raw);
  if (!reply) log.warn(`[hermes] empty reply for session ${sessionKey}: ${raw.slice(0, 300)}`);
  return { reply, code: 0, raw };
}

/** OpenAI Chat Completions shape → choices[0].message.content. */
function extractReplyText(raw) {
  let obj;
  try { obj = JSON.parse(raw); } catch { return null; }
  const content = obj?.choices?.[0]?.message?.content;
  return (typeof content === 'string' && content.trim()) ? content.trim() : null;
}
