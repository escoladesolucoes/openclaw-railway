/**
 * services/instagramActivity.js
 *
 * Tiny in-memory ring buffer of recent bridge activity, for LIVE diagnosis
 * (Railway logs aren't reachable from the dev session). A token-gated endpoint
 * exposes it. Resets on redeploy — fine for a live test. Remove when stable.
 */

const BUFFER = [];
const MAX = 60;

export function recordActivity(entry) {
  BUFFER.push({ ts: new Date().toISOString(), ...entry });
  while (BUFFER.length > MAX) BUFFER.shift();
}

export function listActivity() {
  return BUFFER.slice().reverse(); // newest first
}
