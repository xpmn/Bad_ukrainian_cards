/**
 * AI bot logic.
 *
 * Bots play randomly with a small human-like delay so the game doesn't feel
 * instant. This module imports from engine.ts but engine.ts does NOT import
 * from here, avoiding circular dependencies.
 */
import type { Room } from "../../lib/types";
import { submitCard, selectWinner } from "./engine";

// How long bots "think" before acting
const BOT_SUBMIT_MIN_MS  = 3_000;
const BOT_SUBMIT_MAX_MS  = 8_000;
const BOT_JUDGE_MIN_MS   = 5_000;
const BOT_JUDGE_MAX_MS   = 10_000;

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Schedule a bot's card submission for the current round.
 * Safe to call multiple times — the submitCard engine function guards against
 * double submissions.
 */
export function scheduleBotTurn(room: Room, botId: string): void {
  const delay = randomDelay(BOT_SUBMIT_MIN_MS, BOT_SUBMIT_MAX_MS);

  room.timers[`bot_submit:${botId}`] = setTimeout(() => {
    delete room.timers[`bot_submit:${botId}`];

    if (room.phase !== "submitting") return;
    // Already submitted?
    if (room.submissions.some(s => s.playerId === botId)) return;

    const bot = room.players.find(p => p.id === botId);
    if (!bot || !bot.isBot) return;

    const card = randomItem(bot.hand);
    if (!card) return;

    try {
      submitCard(room, botId, card);

      // If this submission triggered the judging phase and the hetman is also
      // a bot, schedule the hetman turn here (the WS handler SUBMIT_CARD path
      // only runs for human players, so we must do it ourselves).
      const phaseAfterSubmit = room.phase as string;
      if (phaseAfterSubmit === "judging") {
        const hetman = room.players.find(p => p.id === room.hetmanId);
        if (hetman?.isBot) {
          scheduleBotHetmanTurn(room, hetman.id);
        }
      }
    } catch {
      // Silently ignore — e.g. phase already changed
    }
  }, delay);
}

/**
 * Schedule the bot Hetman to pick a random winner.
 * Must be called after the judging phase begins.
 */
export function scheduleBotHetmanTurn(room: Room, botId: string): void {
  const delay = randomDelay(BOT_JUDGE_MIN_MS, BOT_JUDGE_MAX_MS);

  room.timers[`bot_judge:${botId}`] = setTimeout(() => {
    delete room.timers[`bot_judge:${botId}`];

    if (room.phase !== "judging") return;
    if (room.hetmanId !== botId) return;

    const submission = randomItem(room.submissions);
    if (!submission) return;

    try {
      selectWinner(room, botId, submission.anonymousId);
    } catch {
      // Silently ignore
    }
  }, delay);
}

/**
 * Schedule all bot actions for the current round (after dealRound).
 * Call this from handler.ts after `dealRound(room)`.
 */
export function scheduleBotActionsAfterDeal(room: Room): void {
  for (const player of room.players) {
    if (!player.isBot) continue;
    if (player.id === room.hetmanId) continue; // hetman doesn't submit
    scheduleBotTurn(room, player.id);
  }

  // If the hetman is a bot, schedule them to judge once judging phase starts.
  // We use a polling approach: wait until all_submitted fires, then schedule.
  // The handler.ts already calls scheduleBotHetmanTurn when phase → judging.
}
