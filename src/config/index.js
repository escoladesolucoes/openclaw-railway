/**
 * config/index.js
 *
 * Single source of truth for all paths and runtime constants.
 * Everything that touches the filesystem or env vars lives here.
 */

import path from 'path';
import fs from 'fs/promises';

// --- Paths ---
// DATA_DIR is the Railway volume mount. All persistent state lives here.
export const DATA_DIR = process.env.OPENCLAW_DATA_DIR || '/data';

export const OPENCLAW_HOME = path.join(DATA_DIR, '.openclaw');
export const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, 'openclaw.json');
export const OPENCLAW_ENV_PATH = path.join(OPENCLAW_HOME, '.env');
export const OPENCLAW_STATE_DIR = OPENCLAW_HOME;

// Gateway internal address (loopback, never publicly exposed)
export const GATEWAY_PORT = 18789;
export const GATEWAY_HOST = '127.0.0.1';
export const GATEWAY_INTERNAL_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
export const GATEWAY_WS_URL = `ws://${GATEWAY_HOST}:${GATEWAY_PORT}`;

// Wrapper's public-facing port (Railway sets PORT automatically)
export const PORT = parseInt(process.env.PORT || '3000', 10);

// Admin password for the wrapper's own /setup and /api endpoints
// Set WRAPPER_ADMIN_PASSWORD in Railway env vars.
export const WRAPPER_ADMIN_PASSWORD = process.env.WRAPPER_ADMIN_PASSWORD || null;

// Gateway token for openclaw's own auth layer.
// Set OPENCLAW_GATEWAY_TOKEN in Railway env vars.
// Displayed in /admin so you can paste it into the openclaw UI login.
export const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || null;

// Optional: pre-fill the Ollama URL field in /setup.
// Set OLLAMA_BASE_URL in Railway env vars (e.g. http://ollama.railway.internal:11434).
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || null;

// ─── Instagram (Meta) Direct-message bridge ─────────────────────────
// Instagram is NOT a native OpenClaw channel, so we bridge it via Meta's
// Graph API + webhooks. All values come from Railway env vars.
// See src/routes/instagram.js and src/services/instagram.js.
export const IG_VERIFY_TOKEN  = process.env.IG_VERIFY_TOKEN  || null; // webhook handshake token (you choose this string)
export const IG_APP_SECRET    = process.env.IG_APP_SECRET    || null; // Meta app secret — validates webhook signatures
export const IG_ACCESS_TOKEN  = process.env.IG_ACCESS_TOKEN  || null; // Instagram user access token — sends replies
export const IG_AGENT         = process.env.IG_AGENT         || null; // optional: route to a specific openclaw agent id
export const IG_GRAPH_HOST    = process.env.IG_GRAPH_HOST    || 'graph.instagram.com';
export const IG_GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v21.0';
// Optional: POST a JSON alert here when a user requests a human (/humano).
// Point it at a Slack/Discord/Telegram incoming webhook, or your own endpoint.
export const IG_HANDOFF_WEBHOOK = process.env.IG_HANDOFF_WEBHOOK || null;
// Default bot behaviour per Instagram conversation:
//   'off' (default) → bot stays silent until the user sends /bot (human-first)
//   'on'            → bot answers until the user sends /humano
export const IG_DEFAULT_BOT = process.env.IG_DEFAULT_BOT || 'off';

// Privacy Policy page (/privacy) — Meta requires a public privacy policy URL to
// publish the app. Customize without code via these Railway env vars.
export const PRIVACY_ENTITY  = process.env.PRIVACY_ENTITY  || 'Este serviço';
export const PRIVACY_CONTACT = process.env.PRIVACY_CONTACT || null;

// ─── Agent backend selection ────────────────────────────────────────
// Which engine answers bridged channels (Instagram, etc.):
//   'openclaw' (default) → local OpenClaw gateway via `openclaw agent` CLI
//   'hermes'             → remote Hermes HTTP api_server (OpenAI-compatible)
// Set AGENT_BACKEND=hermes on a dedicated bridge service to make a per-company
// Hermes the official responder without running OpenClaw here.
export const AGENT_BACKEND = (process.env.AGENT_BACKEND || 'openclaw').toLowerCase();

// BRIDGE_ONLY=true → run ONLY the Express bridge (webhooks + legal pages),
// never boot/launch the local OpenClaw gateway. Used by the dedicated
// Instagram→Hermes bridge service (reuses this repo, no OpenClaw runtime).
export const BRIDGE_ONLY = /^(1|true|yes|on)$/i.test(process.env.BRIDGE_ONLY || '');

// Hermes HTTP api_server (used when AGENT_BACKEND=hermes). The api_server is
// OpenAI-compatible: POST /v1/chat/completions with a Bearer key; per-user
// memory rides on the X-Hermes-Session-Id header (stable id = persistent scope).
export const HERMES_API_URL = process.env.HERMES_API_URL || null; // e.g. http://hermes-agent.railway.internal:8643
export const HERMES_API_KEY = process.env.HERMES_API_KEY || null; // = Hermes service's API_SERVER_KEY
export const HERMES_MODEL   = process.env.HERMES_MODEL   || 'hermes-agent';

// Path to openclaw's entry.js — invoking via `node entry.js` is more reliable
// than the bin wrapper (avoids env-detection quirks in containers and lets us
// load openclaw/plugin-sdk/device-bootstrap via createRequire from the same path).
export const OPENCLAW_ENTRY =
  process.env.OPENCLAW_ENTRY?.trim() ||
  '/usr/local/lib/node_modules/openclaw/dist/entry.js';
export const OPENCLAW_NODE = process.env.OPENCLAW_NODE?.trim() || 'node';

// Make OPENCLAW_STATE_DIR visible to any in-process openclaw SDK we load.
// The device-bootstrap SDK reads this env var to find pending.json/paired.json.
process.env.OPENCLAW_STATE_DIR = OPENCLAW_HOME;
process.env.HOME = DATA_DIR;

export const config = {
  DATA_DIR,
  OPENCLAW_HOME,
  OPENCLAW_CONFIG_PATH,
  OPENCLAW_ENV_PATH,
  OPENCLAW_STATE_DIR,
  GATEWAY_PORT,
  GATEWAY_HOST,
  GATEWAY_INTERNAL_URL,
  GATEWAY_WS_URL,
  PORT,
  WRAPPER_ADMIN_PASSWORD,
  OPENCLAW_GATEWAY_TOKEN,

  async isAlreadyConfigured() {
    try {
      await fs.access(OPENCLAW_CONFIG_PATH);
      return true;
    } catch {
      return false;
    }
  },

  async readConfig() {
    try {
      const raw = await fs.readFile(OPENCLAW_CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async writeConfig(configObj) {
    await fs.mkdir(OPENCLAW_HOME, { recursive: true });
    const tmp = OPENCLAW_CONFIG_PATH + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(configObj, null, 2), 'utf8');
    // Atomic rename — safe against mid-write crashes
    await fs.rename(tmp, OPENCLAW_CONFIG_PATH);
  },

  async writeEnvFile(envVars) {
    await fs.mkdir(OPENCLAW_HOME, { recursive: true });
    const lines = Object.entries(envVars)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const tmp = OPENCLAW_ENV_PATH + '.tmp';
    await fs.writeFile(tmp, lines + '\n', 'utf8');
    await fs.rename(tmp, OPENCLAW_ENV_PATH);
  },
};

export default config;