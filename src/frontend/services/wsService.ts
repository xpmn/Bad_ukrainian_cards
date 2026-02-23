// WS service singleton — implemented in task 3.2
export const wsService = {
  connect: (_roomId: string, _token: string) => {},
  disconnect: () => {},
  send: (_event: string, _payload?: unknown) => {},
  on: (_event: string, _handler: (_payload: unknown) => void) => {},
  off: (_event: string, _handler: (_payload: unknown) => void) => {},
};
