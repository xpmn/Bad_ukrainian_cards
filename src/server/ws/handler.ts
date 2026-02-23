// WebSocket message dispatcher — implemented in task 2.2
import type { ServerWebSocket } from "bun";

export interface WsData {
  roomId: string;
  playerId: string;
  token: string;
}

export function handleMessage(
  _ws: ServerWebSocket<WsData>,
  _message: string | Buffer,
): void {
  // TODO: implement in task 2.2
}

export function handleOpen(_ws: ServerWebSocket<WsData>): void {
  // TODO: implement in task 2.2
}

export function handleClose(_ws: ServerWebSocket<WsData>): void {
  // TODO: implement in task 2.2
}
