import { useState, useEffect } from "react";
import "../index.css";
import "./styles/globals.css";
import "./styles/animations.css";
import { GameProvider } from "./services/gameStore";
import HomePage from "./pages/HomePage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import NotFoundPage from "./pages/NotFoundPage";

// ── Hash router ───────────────────────────────────────────────────────────────

interface Route {
  page: "home" | "lobby" | "game" | "notfound";
  id?: string;
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { page: "home" };

  const lobbyMatch = path.match(/^lobby\/([^/]+)$/);
  if (lobbyMatch) return { page: "lobby", id: lobbyMatch[1] };

  const gameMatch = path.match(/^game\/([^/]+)$/);
  if (gameMatch) return { page: "game", id: gameMatch[1] };

  return { page: "notfound" };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return (
    <GameProvider>
      <div className="app">
        {route.page === "home"     && <HomePage />}
        {route.page === "lobby"    && <LobbyPage roomId={route.id!} />}
        {route.page === "game"     && <GamePage  roomId={route.id!} />}
        {route.page === "notfound" && <NotFoundPage />}
      </div>
    </GameProvider>
  );
}

export default App;

