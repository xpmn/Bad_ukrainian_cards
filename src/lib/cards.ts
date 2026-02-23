// Card data — populated in task 1.3
export const blackCards: string[] = [];
export const whiteCards: string[] = [];
export const blackCardsEn: string[] = [];
export const whiteCardsEn: string[] = [];

export function shuffleDeck<T>(deck: T[]): T[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function dealCards(
  deck: string[],
  count: number,
): { hand: string[]; remaining: string[] } {
  const hand = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { hand, remaining };
}
