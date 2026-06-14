/**
 * services/instagramHandoff.js
 *
 * Per-user bot on/off state for the Instagram bridge (human ⇄ bot handoff).
 *
 * DEFAULT IS OFF: the bot stays silent and a human handles the conversation,
 * UNLESS the user opts in by sending /bot. /humano turns it back off. The
 * default can be flipped globally with IG_DEFAULT_BOT=on.
 *
 * State is persisted on the data volume (survives restarts/redeploys) and keyed
 * by IGSID, so each conversation's on/off choice is fully independent.
 *
 *   File: $DATA_DIR/instagram-bridge/handoff.json
 *   Shape: { "<igsid>": { "bot": "on"|"off", "since": "<ISO>" } }
 */

import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR, IG_DEFAULT_BOT } from '../config/index.js';
import { log } from '../utils/log.js';

const STATE_DIR = path.join(DATA_DIR, 'instagram-bridge');
const STATE_FILE = path.join(STATE_DIR, 'handoff.json');
const DEFAULT_ON = String(IG_DEFAULT_BOT).toLowerCase() === 'on';

let cache = null; // lazy-loaded { igsid: { bot, since } }

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) || {};
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8');
  await fs.rename(tmp, STATE_FILE); // atomic
}

async function setState(igsid, bot) {
  const c = await load();
  c[igsid] = { bot, since: new Date().toISOString() };
  await persist();
  log.info(`[instagram] handoff: bot ${bot.toUpperCase()} for ${igsid}`);
}

/**
 * Is the bot currently answering this user? Uses the user's explicit override
 * (/bot or /humano) if present, otherwise the global default (IG_DEFAULT_BOT).
 */
export async function isBotEnabled(igsid) {
  const c = await load();
  const v = c[igsid]?.bot;
  if (v === 'on') return true;
  if (v === 'off') return false;
  return DEFAULT_ON;
}

export const enableBot = (igsid) => setState(igsid, 'on');   // /bot
export const disableBot = (igsid) => setState(igsid, 'off');  // /humano

/** List users who have an explicit override set. */
export async function listBotStates() {
  const c = await load();
  return Object.entries(c).map(([igsid, v]) => ({ igsid, bot: v.bot, since: v.since }));
}

export { DEFAULT_ON };
