/**
 * WebSocket service — singleton.
 * Handles connection, auto-reconnect (exponential backoff), and typed events.
 */
import type { ConnectionState } from "@lib/types";

type AnyHandler = (payload: unknown) => void;

// ── Internal state ─────────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let currentRoomId = "";
let currentToken = "";
let connectionState: ConnectionState = "disconnected";
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

const listeners: Map<string, Set<AnyHandler>> = new Map();
const connStateListeners: Set<(s: ConnectionState) => void> = new Set();

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildWsUrl(roomId: string, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host  = window.location.host;
  return `${proto}//${host}/ws?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
}

function setConnectionState(s: ConnectionState): void {
  connectionState = s;
  connStateListeners.forEach(fn => fn(s));
}

function dispatchEvent(event: string, payload: unknown): void {
  listeners.get(event)?.forEach(fn => fn(payload));
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  const delay = Math.min(500 * 2 ** reconnectAttempt, 16000);
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!manualClose && currentRoomId && currentToken) {
      doConnect(currentRoomId, currentToken, true);
    }
  }, delay);
}

function doConnect(roomId: string, token: string, isReconnect: boolean): void {
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }

  currentRoomId = roomId;
  currentToken  = token;
  manualClose   = false;

  setConnectionState(isReconnect ? "reconnecting" : "connecting");

  const ws = new WebSocket(buildWsUrl(roomId, token));
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    setConnectionState("connected");
  };

  ws.onmessage = (evt: MessageEvent) => {
    try {
      const msg = JSON.parse(evt.data as string) as { event: string; payload: unknown };
      dispatchEvent(msg.event, msg.payload);
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    socket = null;
    if (manualClose) {
      setConnectionState("disconnected");
    } else {
      setConnectionState("reconnecting");
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    // onclose fires after onerror, so no extra handling needed
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Connect (or reconnect) to the game room. */
function connect(roomId: string, token: string): void {
  reconnectAttempt = 0;
  doConnect(roomId, token, false);
}

/** Gracefully close the connection. */
function disconnect(): void {
  manualClose = true;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  setConnectionState("disconnected");
}

/** Send a game event to the server. */
function send(event: string, payload?: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, payload: payload ?? {} }));
  }
}

/** Subscribe to a server-sent event. Returns unsubscribe function. */
function on(event: string, handler: AnyHandler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
  return () => off(event, handler);
}

/** Unsubscribe from a server-sent event. */
function off(event: string, handler: AnyHandler): void {
  listeners.get(event)?.delete(handler);
}

/** Get current connection state. */
function getConnectionState(): ConnectionState {
  return connectionState;
}

/** Subscribe to connection state changes. Returns unsubscribe function. */
function onConnectionStateChange(fn: (s: ConnectionState) => void): () => void {
  connStateListeners.add(fn);
  return () => connStateListeners.delete(fn);
}

export const wsService = {
  connect,
  disconnect,
  send,
  on,
  off,
  getConnectionState,
  onConnectionStateChange,
};

