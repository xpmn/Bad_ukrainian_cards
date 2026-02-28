/**
 * AI bot logic.
 *
 * Bots play randomly with a small human-like delay so the game doesn't feel
 * instant. This module imports from engine.ts but engine.ts does NOT import
 * from here, avoiding circular dependencies.
 */
import type { Room } from "../../lib/types";
import { submitCard, selectWinner, pickBlackCard } from "./engine";

// How long bots "think" before acting
const BOT_SUBMIT_MIN_MS  = 3_000;
const BOT_SUBMIT_MAX_MS  = 8_000;
const BOT_JUDGE_MIN_MS   = 5_000;
const BOT_JUDGE_MAX_MS   = 10_000;
const BOT_PICK_MIN_MS    = 2_000;
const BOT_PICK_MAX_MS    = 5_000;

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
      // engine.ts calls room.onJudgingStart when all submissions are in,
      // which schedules the bot hetman turn — no need to do it here.
    } catch {
      // Silently ignore — e.g. phase already changed
    }
  }, delay);
}

/**
 * Schedule the bot Hetman to pick a random winner.
 * Must be called after the judging phase begins.
 * Safe to call multiple times — only schedules once per round.
 */
export function scheduleBotHetmanTurn(room: Room, botId: string): void {
  // Already scheduled this round — don't reset the delay.
  if (room.timers[`bot_judge:${botId}`] !== undefined) return;

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
 * Schedule all bot submissions for the current round (called via room.onDealComplete).
 * The bot hetman's judging turn is scheduled separately via room.onJudgingStart.
 */
export function scheduleBotActionsAfterDeal(room: Room): void {
  for (const player of room.players) {
    if (!player.isBot) continue;
    if (player.id === room.hetmanId) continue; // hetman doesn't submit
    scheduleBotTurn(room, player.id);
  }
}

/**
 * Schedule the bot Hetman to pick a random black card from the offered choices.
 * Called via room.onHetmanPick when the hetman is a bot.
 */
export function scheduleBotBlackCardPick(room: Room, botId: string): void {
  // Already scheduled — don't reset.
  if (room.timers[`bot_pick:${botId}`] !== undefined) return;

  const delay = randomDelay(BOT_PICK_MIN_MS, BOT_PICK_MAX_MS);

  room.timers[`bot_pick:${botId}`] = setTimeout(() => {
    delete room.timers[`bot_pick:${botId}`];

    if (room.phase !== "hetmanPicking") return;
    if (room.hetmanId !== botId) return;
    if (room.blackCardChoices.length === 0) return;

    const card = randomItem(room.blackCardChoices);
    if (!card) return;

    try {
      pickBlackCard(room, botId, card);
    } catch {
      // Silently ignore
    }
  }, delay);
}
