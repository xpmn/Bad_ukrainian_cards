import { serve } from "bun";
import index from "../index.html";
import { setServer } from "./ws/broadcast";
import { handleOpen, handleClose, handleMessage, type WsData } from "./ws/handler";
import { handleCreateRoom, handleJoinRoom, handleGetRoom } from "./router";
import { logger } from "./logger";

const PORT = Number(process.env["PORT"] ?? 3000);

const server = serve<WsData>({
  port: PORT,

  // Serve the HTML bundle (with HMR in dev) at every non-API path.
  // Using Bun's native static routing avoids the [object HTMLBundle] issue.
  routes: {
    "/": index,
  },

  fetch(req, srv) {
    const url = new URL(req.url);

    // ── WebSocket upgrade ─────────────────────────────────────────────────────
    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("roomId") ?? "";
      const token  = url.searchParams.get("token")  ?? "";

      if (!roomId || !token) {
        return new Response("Missing roomId or token", { status: 400 });
      }

      // Accept the upgrade for any request with roomId+token present.
      // handleOpen will validate the token and close with code 4001 if invalid.
      // This lets the client receive a meaningful close code instead of a raw
      // HTTP 401 (which WebSocket API exposes only as opaque error code 1006).
      const upgraded = srv.upgrade(req, {
        data: { roomId: roomId.toUpperCase(), playerId: "", token },
      });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 500 });
    }

    // ── REST API ──────────────────────────────────────────────────────────────
    if (url.pathname === "/api/rooms" && req.method === "POST") {
      return handleCreateRoom(req);
    }

    const joinMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (joinMatch && req.method === "POST") {
      return handleJoinRoom(req, joinMatch[1]!);
    }

    const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && req.method === "GET") {
      return handleGetRoom(roomMatch[1]!);
    }

    // All other paths fall through to the static "/" SPA shell above.
    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      handleOpen(ws);
    },
    message(ws, msg) {
      handleMessage(ws, msg);
    },
    close(ws) {
      handleClose(ws);
    },
    perMessageDeflate: true,
  },

  development: process.env["NODE_ENV"] !== "production" && {
    hmr: true,
    console: true,
  },
});

// Store server reference for pub/sub broadcasts
setServer(server);

logger.info(`🚀 Server running at ${server.url}`);
