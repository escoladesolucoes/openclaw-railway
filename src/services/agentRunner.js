/**
 * services/agentRunner.js
 *
 * Channel-agnostic helper to run a single OpenClaw agent turn and return the
 * reply text. Used by inbound webhook bridges (e.g. Instagram, WhatsApp Cloud
 * API) that aren't native OpenClaw channels: we receive a message over HTTP,
 * ask the agent for a reply via the `openclaw agent` CLI (which routes through
 * the running gateway), then deliver the reply ourselves.
 *
 *   openclaw agent --message "<text>" --session-id "<id>" --json
 *
 * The stable --session-id keeps per-user conversation memory across calls.
 * We do NOT pass --deliver: the agent only computes the reply; the caller
 * delivers it back over the originating channel's own API.
 */

import { runOpenclaw } from './onboardBuilder.js';
import { IG_AGENT } from '../config/index.js';
import { log } from '../utils/log.js';

// Agent turns can take a while (model latency). We already 200-acked the
// webhook, and Meta gives a 24h window to reply, so a generous timeout is fine.
const AGENT_TIMEOUT_MS = 180_000;

/**
 * Run one agent turn.
 * @returns {Promise<{reply: string|null, code: number, raw: string}>}
 */
export async function runAgentTurn(text, sessionKey, { agent = IG_AGENT } = {}) {
  const args = ['agent', '--message', text, '--session-id', sessionKey, '--json'];
  if (agent) args.push('--agent', agent);

  const result = await runOpenclaw(args, AGENT_TIMEOUT_MS);
  const reply = extractReplyText(result.output);

  if (result.code !== 0) {
    log.warn(`[agent] exit=${result.code} for session ${sessionKey}: ${result.output.slice(-400)}`);
  }
  return { reply, code: result.code, raw: result.output };
}

/**
 * The CLI prints a JSON object shaped like:
 *   { payloads: [{ text, mediaUrl }], meta: {...}, deliveryStatus: {...} }
 * but stdout/stderr may carry log noise, so we extract the JSON defensively:
 * parse the whole blob first, then fall back to the widest {...} slice.
 */
function extractReplyText(output) {
  const obj = safeParseJson(output);
  if (obj && Array.isArray(obj.payloads)) {
    const txt = obj.payloads
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    return txt || null;
  }
  return null;
}

function safeParseJson(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* give up */ }
  }
  return null;
}
