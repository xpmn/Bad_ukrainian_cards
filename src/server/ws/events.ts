/** All WebSocket event name constants. */

// Client → Server
export const CLIENT_EVENTS = {
  SUBMIT_CARD: "submit_card",
  SELECT_WINNER: "select_winner",
  START_GAME: "start_game",
  ADD_BOT: "add_bot",
  REMOVE_PLAYER: "remove_player",
  UPDATE_SETTINGS: "update_settings",
  CHAT_MESSAGE: "chat_message",
  PING: "ping",
} as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];

// Server → Client
export const SERVER_EVENTS = {
  ROOM_STATE: "room_state",
  ROUND_START: "round_start",
  CARDS_DEALT: "cards_dealt",
  SUBMISSION_RECEIVED: "submission_received",
  ALL_SUBMITTED: "all_submitted",
  WINNER_SELECTED: "winner_selected",
  ROUND_END: "round_end",
  GAME_OVER: "game_over",
  PLAYER_JOINED: "player_joined",
  PLAYER_RECONNECTED: "player_reconnected",
  PLAYER_DISCONNECTED: "player_disconnected",
  PLAYER_REPLACED_BY_BOT: "player_replaced_by_bot",
  SETTINGS_UPDATED: "settings_updated",
  ERROR: "error",
  PONG: "pong",
} as const;

export type ServerEvent = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

// Union of any WS message
export interface WsMessage<E extends string = string, P = unknown> {
  event: E;
  payload: P;
}
