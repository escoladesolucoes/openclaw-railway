/**
 * services/agentRunner.js
 *
 * Channel-agnostic helper to run a single OpenClaw agent turn and return the
 * reply text. Used by inbound webhook bridges (e.g. Instagram, WhatsApp Cloud
 * API) that aren't native OpenClaw channels: we receive a message over HTTP,
 * ask the agent for a reply, then deliver the reply ourselves.
 *
 * Two backends, selected by AGENT_BACKEND:
 *   'openclaw' (default) → `openclaw agent --message … --session-id … --json`
 *                          (routes through the local gateway)
 *   'hermes'             → remote Hermes HTTP api_server (see hermesAgent.js)
 *
 * The stable --session-id / session key keeps per-user conversation memory
 * across calls. We do NOT deliver from here; the caller sends the reply back
 * over the originating channel's own API.
 */

import { runOpenclaw } from './onboardBuilder.js';
import { IG_AGENT, AGENT_BACKEND } from '../config/index.js';
import { runHermesTurn } from './hermesAgent.js';
import { log } from '../utils/log.js';

// Agent turns can take a while (model latency). We already 200-acked the
// webhook, and Meta gives a 24h window to reply, so a generous timeout is fine.
const AGENT_TIMEOUT_MS = 180_000;

/**
 * Run one agent turn.
 * @returns {Promise<{reply: string|null, code: number, raw: string}>}
 */
export async function runAgentTurn(text, sessionKey, { agent = IG_AGENT } = {}) {
  // Remote Hermes backend: hand off to the HTTP api_server client.
  if (AGENT_BACKEND === 'hermes') {
    return runHermesTurn(text, sessionKey);
  }

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
 * OpenClaw 2026.5.x prints (with --json):
 *   { status: "ok", result: { payloads: [{ text, mediaUrl }], meta: {...} } }
 * so the reply lives at result.payloads[].text. We also accept a top-level
 * `payloads` (older docs) and fall back to meta.finalAssistantVisibleText.
 * stdout/stderr may carry log noise, so safeParseJson extracts defensively.
 */
function extractReplyText(output) {
  const obj = safeParseJson(output);
  if (!obj) return null;

  const payloads = obj.result?.payloads ?? obj.payloads;
  if (Array.isArray(payloads)) {
    const txt = payloads
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (txt) return txt;
  }

  const fallback = obj.result?.meta?.finalAssistantVisibleText
    ?? obj.result?.meta?.finalAssistantRawText;
  return (typeof fallback === 'string' && fallback.trim()) ? fallback.trim() : null;
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
