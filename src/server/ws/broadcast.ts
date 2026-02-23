/**
 * Thin wrapper around Bun's server pub/sub so that game modules can broadcast
 * without holding a direct reference to the server object.
 *
 * Call `setServer(server)` once in index.ts after creating the Bun server.
 * Every connected WebSocket must subscribe to:
 *   - room topic  : `room:<roomId>`  — room-wide broadcasts
 *   - player topic: `player:<playerId>` — private messages
 */
import type { ServerEvent } from "./events";

/** Minimal interface for the pub/sub methods we use from the Bun server. */
interface Publishable {
  publish(
    topic: string,
    data: string | ArrayBuffer | SharedArrayBuffer | ArrayBufferView,
    compress?: boolean,
  ): number;
}

let _server: Publishable | null = null;

export function setServer(s: Publishable): void {
  _server = s;
}

/** Broadcast a typed event to every subscriber of a room. */
export function broadcast(roomId: string, event: ServerEvent, payload: unknown): void {
  _server?.publish(`room:${roomId}`, JSON.stringify({ event, payload }));
}

/** Send a typed event privately to a single player. */
export function sendToPlayer(playerId: string, event: ServerEvent, payload: unknown): void {
  _server?.publish(`player:${playerId}`, JSON.stringify({ event, payload }));
}
