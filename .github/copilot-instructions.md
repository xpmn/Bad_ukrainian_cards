# Copilot Instructions — Bad cards

## Project Overview
This is an implementation of popular card game "Cards Against Humanity". The project is built with the following technologies:
- Bun for package management and script runtime
- React for frontend framework
- TypeScript for type safety
- Websockets for real-time communication, all api routes for game logic are implemented as websocket handlers, REST API is used for general game endpoints - create room, join room, etc.
- project using i18n for all user-facing text, two languages are supported: English and Ukrainian, deafult language is Ukrainian.

The project prioritizes clarity, predictability, and fast iteration over over-engineering.

## Project Structure
- `src/lib/`: Reusable components, utilities, and assets
- `src/server/`: All backend code, including game logic and websocket handlers
- `src/frontend/`: All frontend code, including React components and styles
- `src/frontend/App.tsx`: Main React component, entry point for the frontend
- `src/index.ts`: Entry point for the backend, starts the websocket server
- card data is stored in `src/lib/cards.ts` as simple arrays of strings, no database or external APIs are used, all card data is returned as JSON from the server on client connection. 

## Game mechanics
- The game supports 3–10 players, with one player acting as the "Hetman" (Card Czar) each round.
- Each player starts with 10 white cards, and the Hetman plays a black card each round.
- Players submit white cards in response to the black card, and the Hetman selects the winning submission.
- During game setup host can define settings such as number of rounds, time limit for submissions, and whether to allow custom cards. Also by default hetman role rotates each round, but host can choose to keep the same player as hetman for the entire game.
- The game session has time limit of 1 hour, after which the game will end and the player with the most points will be declared the winner. This is to prevent games from dragging on indefinitely.
- If no user interacts with the game for 15 minutes, the game session will automatically end to free up server resources.
- After creating game room, host can share the game link with other players to join. Players can also join by entering the game code on the homepage.
- Host can set game password to prevent unauthorized access to the game room.
- Host attach AI bots to player list during the game setup. In the worst case host can play with 9 AI bots.
- If user disconnects from game - they can reconnect - game will recognize them by unique token stored in local storage and restore their session, including their hand of cards and points.
- Host can replace user with AI bot (soft kick), or if they want to leave the game early. Bot will play randomly, without any strategy. This is to ensure that the game can continue even if a player leaves unexpectedly. In case if player is AI - they will be marked as bot in the player list, and their name will have "(AI)" suffix to make it clear to other players that they are not human.

---

## Architecture Rules

### Frontend
- React is the only frontend framework
- Keep components small and focused (single responsibility principle)
- always define types and interfaces in separate files, use React conventions
- no external CDN dependencies, all dependencies must be stored locally
- use hash-based routing for simplicity, no server-side rendering
- css-in-js is preferred, but plain css files are also acceptable for global styles
- use single service for websocket communication, all game logic should be handled through this service, no direct websocket calls in React components
- each player should see all their cards in their hand, and the black card for the current round. They should also see the submissions from other players, but not which player submitted which card (except for the Hetman, who sees all submissions without player names). After the Hetman selects a winning submission, all players should see which card won and who submitted it.
- cards should have animations for dealing, submitting, and winning. Animations should be smooth and not interfere with gameplay.

### Backend
- All backend code must be in `src/server/`
- Use WebSockets for all game logic and real-time communication
- REST API is only for general game endpoints (create room, join room, etc.)

## Code Style

- TypeScript everywhere
- No any
- Prefer early returns

---

## Agent Behavior Rules

When acting as an agent:
- Propose changes before implementing
- Never introduce new dependencies silently
- If uncertain, present 2–3 options with trade-offs
- never run dev script, pretend that dev environment is already running and you can see the app in the browser
