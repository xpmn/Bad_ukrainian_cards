// useGame hook — implemented in task 3.3
import { useGameState } from "../services/gameStore";

export function useGame() {
  return useGameState();
}
