// Room & session management — implemented in task 2.4
import type { Room, Player, GameSettings, PublicRoom } from "../../lib/types";

export const rooms = new Map<string, Room>();

/** Find a room by any player token. */
export function getRoomByToken(_token: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.token === _token)) return room;
  }
  return undefined;
}

export function createRoom(
  _hostName: string,
  _settings: GameSettings,
): Room {
  throw new Error("Not implemented — task 2.4");
}

export function joinRoom(
  _roomId: string,
  _playerName: string,
  _password?: string,
): Player {
  throw new Error("Not implemented — task 2.4");
}

export function getPublicRoom(_room: Room): PublicRoom {
  throw new Error("Not implemented — task 2.4");
}

export function reconnectPlayer(
  _token: string,
  _ws: unknown,
): { room: Room; player: Player } {
  throw new Error("Not implemented — task 2.4");
}
