# Bad Cards — Development Task List

Implementation roadmap for the "Cards Against Humanity" clone.
Stack: **Bun · React 19 · TypeScript · WebSockets · i18n (uk/en)**

---

## Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- **P0** — Must have (game unplayable without it)
- **P1** — Important (degrades experience without it)
- **P2** — Nice to have

---

## Phase 1 — Foundation

### 1.1 Project Structure & Configuration
**Priority:** P0

- [x] Create folder skeleton:
  ```
  src/
    lib/
      cards.ts          # Card data
      types.ts          # All shared TypeScript interfaces
      i18n/
        index.ts        # i18n engine (tiny, no external dep)
        uk.ts           # Ukrainian strings
        en.ts           # English strings
    server/
      index.ts          # HTTP + WS server entry (replaces current src/index.ts)
      router.ts         # REST route definitions
      ws/
        handler.ts      # WebSocket message dispatcher
        events.ts       # WS event type constants
      game/
        engine.ts       # Core game state machine
        room.ts         # Room/session management
        bot.ts          # AI bot logic
        timers.ts       # Inactivity + game-time-limit timers
    frontend/
      App.tsx           # Hash router root
      pages/
        HomePage.tsx
        LobbyPage.tsx
        GamePage.tsx
        NotFoundPage.tsx
      components/
        Card/
          BlackCard.tsx
          WhiteCard.tsx
          CardBack.tsx
        PlayerList.tsx
        ScoreBoard.tsx
        SubmissionPile.tsx
        GameSettings.tsx
        PasswordModal.tsx
        Toast.tsx
      services/
        wsService.ts    # Single WS connection singleton
        gameStore.ts    # React context / state store
      hooks/
        useGame.ts
        useWS.ts
      styles/
        globals.css
        animations.css
      types.ts          # Frontend-only types (re-exports lib/types.ts)
  ```

- [x] Update `tsconfig.json` — add `paths` alias `@lib/*` → `src/lib/*`, `@server/*` → `src/server/*`, `@frontend/*` → `src/frontend/*`
- [x] Update `src/index.ts` to import from `src/server/index.ts`
- [x] Add `.env.example` with `PORT`, `HOST` variables

**Technologies:** Bun built-in module resolution, TypeScript project references

---

### 1.2 Shared Type Definitions (`src/lib/types.ts`)
**Priority:** P0

Define all shared interfaces used by both server and client:

```typescript
// Game phases
type GamePhase = 'lobby' | 'dealing' | 'submitting' | 'judging' | 'reveal' | 'roundEnd' | 'gameOver';

// Player
interface Player {
  id: string;           // UUID
  token: string;        // reconnect token (server-side only, never sent to other clients)
  name: string;
  isBot: boolean;
  isConnected: boolean;
  isHost: boolean;
  points: number;
  hand: string[];       // white card texts
}

// Game settings (chosen by host in lobby)
interface GameSettings {
  maxRounds: number;          // default: 10
  submissionTimeLimitSec: number | null;  // null = no limit
  allowCustomCards: boolean;
  rotateHetman: boolean;      // default: true
  password: string | null;
}

// Room
interface Room {
  id: string;           // 6-char uppercase code
  hostId: string;
  players: Player[];
  phase: GamePhase;
  settings: GameSettings;
  currentRound: number;
  hetmanId: string | null;
  currentBlackCard: string | null;
  submissions: Submission[];
  createdAt: number;
  lastActivityAt: number;
}

// Round submission
interface Submission {
  playerId: string;
  card: string;
  isWinner: boolean;
}
```

- [x] Write all interfaces above in `src/lib/types.ts`
- [x] Export all types from a barrel `src/lib/index.ts`

---

### 1.3 Card Data (`src/lib/cards.ts`)
**Priority:** P0

- [x] Create `src/lib/cards.ts` with:
  - `blackCards: string[]` — at least **90 black cards** in Ukrainian
  - `whiteCards: string[]` — at least **400 white cards** in Ukrainian
  - `blackCardsEn: string[]` — English equivalents (can be same set translated)
  - `whiteCardsEn: string[]`
- [x] Export helper functions:
  ```typescript
  export function shuffleDeck<T>(deck: T[]): T[]
  export function dealCards(deck: string[], count: number): { hand: string[]; remaining: string[] }
  ```
- [x] Card format for black cards uses `_` as blank placeholder (e.g. `"Я люблю _."`)

---

### 1.4 i18n (`src/lib/i18n/`)
**Priority:** P0 — all user-facing strings must go through i18n

- [x] Create a minimal i18n engine (no external dependency):
  ```typescript
  // src/lib/i18n/index.ts
  type Lang = 'uk' | 'en';
  type TranslationKey = keyof typeof import('./uk').uk;
  
  export function t(key: TranslationKey, lang: Lang = 'uk', vars?: Record<string, string | number>): string
  export function setLang(lang: Lang): void
  export function getLang(): Lang
  ```
- [x] `src/lib/i18n/uk.ts` — full Ukrainian string map
- [x] `src/lib/i18n/en.ts` — full English string map
- [x] Keys to cover: all UI labels, error messages, game phase announcements, player actions, toast notifications
- [x] On frontend: persist chosen language in `localStorage`
- [x] On frontend: expose `useLang()` React hook that triggers re-render on language change

---

## Phase 2 — Backend

### 2.1 HTTP Server & REST API (`src/server/`)
**Priority:** P0

Endpoints (all return JSON):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/rooms` | Create a new room. Body: `{ playerName, settings }`. Returns `{ roomId, token, playerId }` |
| `POST` | `/api/rooms/:id/join` | Join existing room. Body: `{ playerName, password? }`. Returns `{ token, playerId }` |
| `GET`  | `/api/rooms/:id` | Get public room info (phase, player count, hasPassword). No auth needed. |
| `GET`  | `/*` | Serve `index.html` (SPA fallback) |

- [x] Move server bootstrap into `src/server/index.ts`
- [x] Implement `POST /api/rooms` — generate 6-char room code, create `Room` object, store in in-memory `Map<string, Room>`, return tokens
- [x] Implement `POST /api/rooms/:id/join` — validate password if set, add player, return token
- [x] Implement `GET /api/rooms/:id` — return sanitized public room data
- [x] Input validation with proper HTTP error responses (400, 401, 404, 409)
- [x] Rate limiting: max 5 rooms created per IP per minute (simple in-memory counter)

**Technologies:** Bun `serve()`, built-in `Request`/`Response`

---

### 2.2 WebSocket Server (`src/server/ws/`)
**Priority:** P0

WebSocket upgrade is handled on the same Bun server.

#### Connection lifecycle
- [x] Upgrade `GET /ws?roomId=&token=` to WebSocket
- [x] On open: validate token → find player → mark `isConnected = true` → broadcast `player_reconnected` to room
- [x] On close: mark `isConnected = false` → broadcast `player_disconnected` → start 5 min reconnect grace timer; if timer expires and player is still disconnected, replace with bot

#### Event types (`src/server/ws/events.ts`)
Define constant maps for all client→server and server→client event names.

**Client → Server events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `submit_card` | `{ card: string }` | Player submits white card |
| `select_winner` | `{ playerId: string }` | Hetman picks winner |
| `start_game` | — | Host starts the game from lobby |
| `add_bot` | — | Host adds an AI bot to lobby |
| `remove_player` | `{ playerId: string }` | Host kicks / replaces player with bot |
| `update_settings` | `{ settings: Partial<GameSettings> }` | Host updates game settings |
| `chat_message` | `{ text: string }` | Send a lobby/game chat message |
| `ping` | — | Keepalive |

**Server → Client events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `room_state` | `RoomStatePayload` | Full room snapshot (sent on connect and after each state change) |
| `round_start` | `{ blackCard, hetmanId, round }` | New round begins |
| `cards_dealt` | `{ hand: string[] }` | Private — player's new hand |
| `submission_received` | `{ count: number }` | How many submissions so far (no card text) |
| `all_submitted` | `{ submissions: AnonymousSubmission[] }` | Judging phase begins |
| `winner_selected` | `{ submission: Submission, playerName: string }` | Hetman chose winner |
| `round_end` | `{ scores: Score[] }` | Scores after round |
| `game_over` | `{ winner: Player, scores: Score[] }` | Final result |
| `player_joined` | `{ player: PublicPlayer }` | New player joined |
| `player_reconnected` | `{ playerId: string }` | Disconnected player came back |
| `player_disconnected` | `{ playerId: string }` | Player went offline |
| `player_replaced_by_bot` | `{ playerId: string, botId: string }` | Player swapped for bot |
| `settings_updated` | `{ settings: GameSettings }` | Settings changed |
| `error` | `{ code: string, message: string }` | Server error |
| `pong` | — | Keepalive reply |

- [x] Implement message dispatcher in `src/server/ws/handler.ts`
- [x] Each handler validates payload shape before processing
- [x] Use `ws.subscribe(roomId)` / `server.publish(roomId, msg)` for room broadcasting (Bun pub/sub)

**Technologies:** Bun WebSocket API (`server.upgrade`, `ws.subscribe`, `server.publish`)

---

### 2.3 Game Engine (`src/server/game/engine.ts`)
**Priority:** P0

State machine governing game phase transitions:

```
lobby → dealing → submitting → judging → reveal → roundEnd → (next round OR gameOver)
```

- [x] `startGame(room)` — validate ≥3 players, shuffle decks, deal 10 cards each, set Hetman, transition to `dealing`
- [x] `dealCards(room)` — refill each player's hand to 10 cards, draw black card, broadcast `round_start` + `cards_dealt`
- [x] `submitCard(room, playerId, card)` — validate phase is `submitting`, validate card is in player's hand, add to submissions, remove card from hand, check if all non-Hetman players submitted → auto-advance to `judging`
- [x] `selectWinner(room, hetmanId, targetPlayerId)` — validate caller is Hetman and phase is `judging`, award point, transition to `reveal` then `roundEnd`
- [x] `advanceRound(room)` — rotate Hetman (if `rotateHetman: true`), increment round, check if `currentRound >= maxRounds` → `gameOver`; else → `dealing`
- [x] `endGame(room)` — compute final scores, broadcast `game_over`, clean up timers
- [x] All state transitions emit the appropriate WS events

---

### 2.4 Room & Session Management (`src/server/game/room.ts`)
**Priority:** P0

- [x] In-memory store: `const rooms = new Map<string, Room>()`
- [x] `createRoom(hostName, settings)` → `Room`
- [x] `joinRoom(roomId, playerName, password?)` → `Player` or throw
- [x] `getPublicRoom(roomId)` — strips tokens and private hand data
- [x] `getRoomForPlayer(token)` — find room by player token
- [x] Reconnect: `reconnectPlayer(token, ws)` — find player by token, re-attach socket
- [x] Separation of concern: room.ts only manages data; engine.ts drives state changes

---

### 2.5 AI Bot Logic (`src/server/game/bot.ts`)
**Priority:** P1

- [x] `createBot(room)` — add bot player with `isBot: true`, name pattern `"Bot #{n} (AI)"`
- [x] `scheduleBotTurn(room, botId)` — after a random delay (3–8 s to feel natural), bot picks a random card from hand and submits
- [x] `scheduleBotHetmanTurn(room, botId)` — bot picks a random submission as winner after 5–10 s delay
- [x] Bots do not participate in chat
- [x] When a human player is replaced by a bot (`remove_player` event), existing player data (points, cards) is preserved and assigned to the new bot

---

### 2.6 Session Timers (`src/server/game/timers.ts`)
**Priority:** P1

- [x] **Submission timer**: if `settings.submissionTimeLimitSec` is set, start a countdown when `submitting` phase begins; when it fires, auto-submit a random card for any player who hasn't submitted yet
- [x] **Inactivity timer**: reset on every WS message received in a room; if 15 minutes pass with no activity → call `endGame(room)` with reason `'inactivity'`
- [x] **Session time limit**: when `startGame` is called, start a 1-hour timer; when it fires → call `endGame(room)` with reason `'time_limit'`
- [x] **Reconnect grace timer**: when a player disconnects, wait 5 minutes; if still offline → replace with bot
- [x] All timers stored on the `Room` object (`timers: Record<string, Timer>`) and cleared when room ends

---

## Phase 3 — Frontend

### 3.1 App Shell & Hash Router (`src/frontend/App.tsx`)
**Priority:** P0

- [x] Implement hash-based router purely in React (no `react-router`):
  ```
  /#/            → HomePage
  /#/lobby/:id   → LobbyPage
  /#/game/:id    → GamePage
  /#/*           → NotFoundPage
  ```
- [x] `parseHash()` helper: parses `window.location.hash`, listens for `hashchange`
- [x] App-level language switcher (uk/en toggle) stored in `localStorage`

---

### 3.2 WebSocket Service (`src/frontend/services/wsService.ts`)
**Priority:** P0

Single singleton managing the WS connection for the entire app:

- [x] `connect(roomId, token)` → opens `ws://host/ws?roomId=&token=`
- [x] `disconnect()` → closes connection
- [x] `send(event, payload)` → sends JSON message
- [x] `on(event, handler)` / `off(event, handler)` → typed event emitter
- [x] Auto-reconnect with exponential backoff (max 5 retries, 1s → 32s)
- [x] Expose `connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'`
- [x] All event payloads are fully typed using the types from `src/lib/types.ts`
- [x] No direct WebSocket calls anywhere else in the frontend codebase

---

### 3.3 Game State Store (`src/frontend/services/gameStore.ts`)
**Priority:** P0

React context-based state store (no external state library):

- [x] `GameProvider` wraps the app — subscribes to WS events and updates state
- [x] State shape:
  ```typescript
  interface GameState {
    room: RoomStatePayload | null;
    myPlayer: Player | null;
    myHand: string[];
    phase: GamePhase;
    currentBlackCard: string | null;
    submissions: AnonymousSubmission[];   // shown during judging
    revealedSubmissions: Submission[];    // shown after winner selected
    lastWinner: { playerName: string; card: string } | null;
    connectionState: ConnectionState;
    error: string | null;
  }
  ```
- [x] `useGame()` hook returns `{ state, actions }` where `actions` wraps all `wsService.send()` calls
- [x] Store persists `token` and `roomId` to `localStorage` for reconnect on page reload

---

### 3.4 Home Page (`src/frontend/pages/HomePage.tsx`)
**Priority:** P0

- [x] **Create Room** form:
  - Player name input
  - Game settings panel (`GameSettings` component)
  - Submit → `POST /api/rooms` → redirect to `/#/lobby/:id`
- [x] **Join Room** form:
  - Room code input (6 chars, auto-uppercase)
  - Player name input
  - Password input (shown only if room has password — check via `GET /api/rooms/:id`)
  - Submit → `POST /api/rooms/:id/join` → redirect to `/#/lobby/:id`
- [x] Language switcher in header
- [x] All labels via `t()` i18n function

---

### 3.5 Lobby Page (`src/frontend/pages/LobbyPage.tsx`)
**Priority:** P0

Connects to WebSocket on mount.

- [x] Show room code with "Copy link" button
- [x] **Player list** (`PlayerList` component): show all players, bots marked with `(AI)` tag, host badge, connection status indicator
- [x] Host controls:
  - "Add bot" button (up to 9 total players)
  - Kick/replace-with-bot button per player
  - Edit settings (`GameSettings` component, inline)
  - "Start game" button (enabled when ≥3 players)
- [x] Non-host view: waiting message, player list (read-only)
- [x] "Start game" triggers `start_game` WS event → server transitions to game, all clients redirect to `/#/game/:id`

---

### 3.6 Game Page (`src/frontend/pages/GamePage.tsx`)
**Priority:** P0

Main game screen. Composed of multiple focused sub-components.

#### Sub-components

**`BlackCard` (`src/frontend/components/Card/BlackCard.tsx`)**
- [x] Displays current black card text
- [x] Renders `_` blanks as styled underlines
- [x] Animated entrance (deal from top-center)

**`WhiteCard` (`src/frontend/components/Card/WhiteCard.tsx`)**
- [x] Renders individual white card
- [x] States: `idle`, `selected`, `submitted`, `winner`
- [x] Click to select/deselect (during `submitting` phase)
- [x] Confirm button appears when card is selected
- [x] CSS transition animations for hover, select, submit

**`CardBack` (`src/frontend/components/Card/CardBack.tsx`)**
- [x] Back-face of cards (used in dealing animation and submission pile)

**`PlayerHand`** (inline in GamePage or separate component)
- [x] Displays `myHand` as a row of `WhiteCard` components
- [x] Fan layout on desktop, scroll on mobile
- [x] Hidden for the Hetman during `submitting` phase

**`SubmissionPile` (`src/frontend/components/SubmissionPile.tsx`)**
- [x] During `submitting`: shows stacked `CardBack` count-up as cards are submitted
- [x] During `judging` (Hetman view): flip-reveal all submissions as clickable cards (no player names)
- [x] During `reveal`: highlight winner, show submitter name

**`PlayerList` (`src/frontend/components/PlayerList.tsx`)**
- [x] Sidebar list of players: name, points, Hetman crown icon, submission checkmark, connection dot
- [x] Bots: show `(AI)` badge

**`ScoreBoard` (`src/frontend/components/ScoreBoard.tsx`)**
- [x] Shown in `roundEnd` overlay and `gameOver` screen
- [x] Sorted by points descending
- [x] Winner highlighted with trophy icon

**`Toast` (`src/frontend/components/Toast.tsx`)**
- [x] Slide-in notification for events: player joined/left, round start, winner announcement
- [x] Auto-dismiss after 4 s

#### Game page phase rendering
- [x] `submitting` — show black card + player hand
- [x] `judging` — show black card + submission pile (Hetman can click to pick winner; others see waiting state)
- [x] `reveal` — animate winner card rising, show player name
- [x] `roundEnd` — score overlay for 5 s then auto-advance (host triggers `next_round` or auto after delay)
- [x] `gameOver` — final scoreboard, "Play again" button

---

### 3.7 Card Animations (`src/frontend/styles/animations.css`)
**Priority:** P1

All animations via CSS keyframes + `transition`. No animation libraries.

- [x] **Deal animation**: cards fly from center/off-screen to their slot in hand (staggered, 80 ms per card)
- [x] **Submit animation**: card slides up from hand and flips face-down onto submission pile
- [x] **Flip animation**: submission cards flip from back-face to front-face during judging reveal
- [x] **Winner animation**: winning card scales up and glows; confetti burst (pure CSS or simple canvas fallback)
- [x] **Toast slide-in/out**: slide from right
- [x] **Hover lift**: white cards lift 8 px on hover with subtle shadow
- [x] Respect `prefers-reduced-motion` media query — disable motion if set

---

### 3.8 Game Settings Component (`src/frontend/components/GameSettings.tsx`)
**Priority:** P1

Reusable in both HomePage (create room) and LobbyPage (edit settings):

- [x] **Max rounds** — number input (range 5–50, default 10)
- [x] **Submission time limit** — toggle off / 30 s / 60 s / 90 s / 120 s
- [x] **Allow custom cards** — checkbox (reserved for future)
- [x] **Rotate Hetman** — checkbox (default on)
- [x] **Password** — optional text field
- [x] In lobby (host only): changes emit `update_settings` WS event immediately on blur/change

---

### 3.9 Reconnection & Persistence
**Priority:** P1

- [x] On app load: check `localStorage` for `{ token, roomId }`
- [x] If present and not on home page: attempt WS connect; if room is still active → restore session
- [x] If room no longer exists: clear storage, redirect to `/`
- [x] Show "Reconnecting…" overlay while `connectionState === 'reconnecting'`

---

## Phase 4 — Quality & Polish

### 4.1 Error Handling
**Priority:** P1

- [x] Server sends structured errors: `{ code: 'ROOM_NOT_FOUND' | 'WRONG_PASSWORD' | 'GAME_ALREADY_STARTED' | ..., message: string }`
- [x] Client shows errors as `Toast` notifications
- [x] REST API errors shown inline on forms

### 4.2 Responsive Design
**Priority:** P1

- [x] Mobile-first layout for GamePage (hand scrolls horizontally, cards stack vertically on small screens)
- [x] Lobby and Home pages usable on 320 px+ screens
- [x] No external CSS frameworks — plain CSS with custom properties

### 4.3 Accessibility
**Priority:** P2

- [x] Keyboard navigation for card selection (arrow keys + Enter)
- [x] ARIA labels on all interactive elements
- [x] Focus rings restored where browser defaults are removed

### 4.4 Security
**Priority:** P1

- [x] Tokens are `crypto.randomUUID()` — never reuse
- [x] Player can only submit cards that are actually in their hand (server-side validation)
- [x] Only host can perform host actions (validated server-side by `playerId === room.hostId`)
- [x] Only Hetman can select winner (server-side check)
- [x] Room codes excluded from server logs in production

---

## Implementation Order (Suggested Sprint Breakdown)

### Sprint 1 — Core foundation (estimated: 2 days)
1. `src/lib/types.ts`
2. `src/lib/cards.ts` (minimum 90 black + 400 white Ukrainian cards)
3. `src/lib/i18n/` (engine + uk strings + en strings)
4. `src/server/game/room.ts` + `engine.ts` (no WS yet, just pure logic)
5. Unit-testable game engine with `bun test`

### Sprint 2 — Backend API (estimated: 1 day)
1. `src/server/index.ts` — Bun server setup
2. `src/server/router.ts` — REST endpoints
3. `src/server/ws/handler.ts` + `events.ts` — WS dispatcher
4. `src/server/game/timers.ts`

### Sprint 3 — Frontend shell (estimated: 1 day)
1. `src/frontend/services/wsService.ts`
2. `src/frontend/services/gameStore.ts`
3. `src/frontend/App.tsx` hash router
4. `HomePage.tsx` + `GameSettings.tsx`

### Sprint 4 — Lobby & Game UI (estimated: 2 days)
1. `LobbyPage.tsx` + `PlayerList.tsx`
2. `GamePage.tsx` (all phases)
3. `BlackCard`, `WhiteCard`, `CardBack`, `SubmissionPile`, `ScoreBoard`, `Toast`

### Sprint 5 — Bots, timers, animations (estimated: 1 day)
1. `src/server/game/bot.ts`
2. CSS animations
3. Reconnect flow
4. Error handling

### Sprint 6 — Polish (estimated: 1 day)
1. English card data
2. Responsive CSS
3. Accessibility pass
4. End-to-end smoke test (manual: 3-player game from join to game over)

---

## Open Questions / Design Decisions

| # | Question | Default assumption |
|---|----------|--------------------|
| 1 | Should custom cards be fully implemented in this version or only the toggle? | Toggle only (reserved) |
| 2 | Should chat be lobby-only or also in-game? | Both lobby and game |
| 3 | Multiple black cards per round (pick 2)? | No — one card per round for simplicity |
| 4 | Spectator mode (watch without playing)? | Not in this version |
| 5 | Persistent scores across multiple games in the same room? | Not in this version |
