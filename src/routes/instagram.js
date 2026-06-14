/**
 * routes/instagram.js
 *
 * Meta webhook bridge for Instagram Direct messages. Instagram is NOT a native
 * OpenClaw channel, so we bridge it: receive the DM via Meta's webhook, ask the
 * OpenClaw agent for a reply, then send it back through the Graph API.
 *
 *   GET  /webhooks/instagram        — Meta verification handshake (hub.challenge)
 *   GET  /webhooks/instagram/health — non-secret config probe for debugging
 *   POST /webhooks/instagram        — inbound message events (HMAC-signed)
 *
 * Flow:  DM → Meta webhook → verifySignature → 200 ack → runAgentTurn →
 *        sendInstagramMessage → reply lands in the user's DM.
 */

import { Router } from 'express';
import {
  IG_VERIFY_TOKEN, IG_APP_SECRET, IG_ACCESS_TOKEN, IG_AGENT, IG_GRAPH_VERSION,
} from '../config/index.js';
import {
  verifySignature, parseSignedRequest, sendInstagramMessage, instagramBridgeConfigured,
} from '../services/instagram.js';
import { runAgentTurn } from '../services/agentRunner.js';
import { gatewayManager } from '../services/gatewayManager.js';
import { log } from '../utils/log.js';

export const instagramRoutes = Router();

// ── GET /webhooks/instagram — Meta verification handshake ──────────
// Meta calls this once when you save the webhook: it sends hub.mode=subscribe,
// hub.verify_token=<your token>, hub.challenge=<random>. Echo the challenge
// back (200) only if the verify token matches.
instagramRoutes.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === IG_VERIFY_TOKEN) {
    log.info('[instagram] webhook verified ✅');
    return res.status(200).send(String(challenge ?? ''));
  }
  log.warn('[instagram] webhook verification failed (bad mode/verify token)');
  return res.sendStatus(403);
});

// ── GET /webhooks/instagram/health — config probe (no secrets) ─────
instagramRoutes.get('/instagram/health', (req, res) => {
  res.json({
    configured: instagramBridgeConfigured(),
    env: {
      IG_VERIFY_TOKEN: Boolean(IG_VERIFY_TOKEN),
      IG_APP_SECRET: Boolean(IG_APP_SECRET),
      IG_ACCESS_TOKEN: Boolean(IG_ACCESS_TOKEN),
      IG_AGENT: IG_AGENT || null,
      IG_GRAPH_VERSION,
    },
    gatewayRunning: gatewayManager.isRunning(),
  });
});

// ── Instagram Business Login callbacks ─────────────────────────────
// Required URLs for the "Set up Instagram business login" dashboard step.
// For an own-account bot (no client onboarding, App Review skipped) these just
// need to exist and return valid responses.

// OAuth redirect — where Meta sends the user after Instagram business login.
instagramRoutes.get('/instagram/oauth', (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    log.warn(`[instagram] oauth error: ${error} — ${error_description || ''}`);
    return res.status(400).send(`Instagram login error: ${error}`);
  }
  if (code) {
    // Token is provisioned out-of-band via IG_ACCESS_TOKEN; we just log receipt.
    // (Full code→token exchange can be added here if/when token auto-refresh is wanted.)
    log.info(`[instagram] oauth authorization code received (len=${String(code).length})`);
    return res.status(200).send('✅ Instagram autorizado. Pode fechar esta janela.');
  }
  res.status(200).send('Instagram OAuth redirect endpoint.');
});

// Deauthorize callback — Meta POSTs a signed_request when a user removes the app.
instagramRoutes.post('/instagram/deauthorize', (req, res) => {
  const data = parseSignedRequest(req.body?.signed_request);
  log.info(`[instagram] deauthorize callback for user ${data?.user_id ?? 'unknown'}`);
  res.sendStatus(200);
});

// Data deletion request — Meta requires a JSON { url, confirmation_code } reply.
// (Bridge keeps no PII of its own; eventually this should also purge the user's
// openclaw session memory keyed by instagram-<user_id>.)
instagramRoutes.post('/instagram/data-deletion', (req, res) => {
  const data = parseSignedRequest(req.body?.signed_request);
  const userId = data?.user_id ?? 'unknown';
  const code = `del_${userId}`;
  log.info(`[instagram] data deletion requested for user ${userId}`);
  res.json({
    url: `https://${req.get('host')}/webhooks/instagram/data-deletion/status?code=${encodeURIComponent(code)}`,
    confirmation_code: code,
  });
});

// Human-readable status page referenced by the data-deletion response.
instagramRoutes.get('/instagram/data-deletion/status', (req, res) => {
  res.status(200).send(`Data deletion request ${req.query.code || ''} received and processed.`);
});

// ── TEMP diagnostic — confirm the agent-invocation link ────────────
// Runs ONE agent turn through the exact same path the bridge uses and returns
// both the parsed reply and the raw `openclaw agent --json` output, so we can
// confirm the JSON shape matches the parser. Gated by IG_VERIFY_TOKEN.
// Remove once the bridge is verified end-to-end.
instagramRoutes.get('/instagram/debug-agent', async (req, res) => {
  if (!IG_VERIFY_TOKEN || req.query.token !== IG_VERIFY_TOKEN) {
    return res.sendStatus(403);
  }
  if (!gatewayManager.isRunning()) {
    return res.status(503).json({ error: 'gateway not running' });
  }
  const msg = (req.query.msg || 'oi, teste de diagnóstico').toString();
  try {
    const { reply, code, raw } = await runAgentTurn(msg, 'debug-instagram');
    res.json({ parsedReply: reply, exitCode: code, rawOutput: raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhooks/instagram — inbound events ──────────────────────
instagramRoutes.post('/instagram', (req, res) => {
  const signature = req.get('x-hub-signature-256');
  if (!verifySignature(req.rawBody, signature)) {
    log.warn('[instagram] rejected event — invalid/missing signature');
    return res.sendStatus(401);
  }

  // Ack within Meta's short window, then process asynchronously so a slow
  // agent turn never causes Meta to retry or disable the webhook.
  res.sendStatus(200);
  handleWebhook(req.body).catch((err) =>
    log.error('[instagram] webhook handler error:', err.message)
  );
});

// ── Event processing ───────────────────────────────────────────────
async function handleWebhook(body) {
  if (!body || body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    const events = entry.messaging || entry.standby || [];
    for (const ev of events) {
      const senderId = ev.sender?.id;
      const message = ev.message;
      if (!senderId || !message) continue;
      if (message.is_echo) continue;          // ignore our own outbound echoes (prevents loops)
      const text = (message.text || '').trim();
      if (!text) continue;                      // MVP: text only (skip media/reactions/postbacks)
      await replyTo(senderId, text);
    }
  }
}

async function replyTo(senderId, text) {
  if (!gatewayManager.isRunning()) {
    log.warn(`[instagram] gateway not running — dropping message from ${senderId}`);
    return;
  }

  const sessionKey = `instagram-${senderId}`;   // stable per-user → persistent memory
  log.info(`[instagram] ◀ ${senderId}: ${text.slice(0, 120)}`);

  let reply;
  try {
    ({ reply } = await runAgentTurn(text, sessionKey));
  } catch (err) {
    log.error(`[instagram] agent turn failed for ${senderId}: ${err.message}`);
    return;
  }
  if (!reply) {
    log.warn(`[instagram] no reply text for ${senderId} — nothing sent`);
    return;
  }

  try {
    await sendInstagramMessage(senderId, reply);
    log.info(`[instagram] ▶ ${senderId}: ${reply.slice(0, 120)}`);
  } catch (err) {
    log.error(`[instagram] failed to send reply to ${senderId}: ${err.message}`);
  }
}
