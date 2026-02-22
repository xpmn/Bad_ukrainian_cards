# Copilot Instructions — Bad cards

## Project Overview
This is an implementation of popular card game "Cards Against Humanity". The project is built with the following technologies:
- Bun for package management and script runtime
- React for frontend framework
- TypeScript for type safety
- Websockets for real-time communication, all api routes for game logic are implemented as websocket handlers, REST API is used for general game endpoints - create room, join room, etc.

The project prioritizes clarity, predictability, and fast iteration over over-engineering.

## Project Structure
- `src/lib/`: Reusable components, utilities, and assets
- `src/server/`: All backend code, including game logic and websocket handlers
- `src/frontend/`: All frontend code, including React components and styles
- `src/frontend/App.tsx`: Main React component, entry point for the frontend
- `src/index.ts`: Entry point for the backend, starts the websocket server

---

## Architecture Rules

### Frontend
- React is the only frontend framework
- Keep components small and focused (single responsibility principle)
- always define types and interfaces in separate files, use React conventions
- no external CDN dependencies, all dependencies must be stored locally
- use hash-based routing for simplicity, no server-side rendering
- css 

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

