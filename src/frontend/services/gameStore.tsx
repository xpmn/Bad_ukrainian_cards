// Game state store (React context) — implemented in task 3.3
import { createContext, useContext, type ReactNode } from "react";
import type { GamePhase, ConnectionState } from "../types";

interface GameState {
  phase: GamePhase;
  connectionState: ConnectionState;
}

const GameContext = createContext<GameState | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const state: GameState = { phase: "lobby", connectionState: "disconnected" };
  return <GameContext.Provider value={state}>{children}</GameContext.Provider>;
}

export function useGameState(): GameState {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameState must be used inside <GameProvider>");
  return ctx;
}
