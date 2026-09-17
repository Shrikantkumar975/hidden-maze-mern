# Hidden Maze Challenge — MERN Stack

A full-stack version of the Hidden Maze Challenge.

## Stack

- **MongoDB** — stores player progress / best stats
- **Express + Node.js** — REST API
- **React + Vite** — game UI
- **CSS** — custom dark arcade interface

## Features

- Exactly 20 progressive levels
- Deterministic seeded maze generation
- Guaranteed connected/sovable level layout
- Invisible walls reset the player to start
- Visited-cell trail
- Multiple keys + locked exit
- Countdown timer
- WASD / Arrow Keys
- Mouse adjacent-cell movement
- Mobile D-pad
- Level map and progress screen
- MongoDB-backed player progress
- Local fallback when MongoDB is unavailable

## Run locally

### 1. Install dependencies

```bash
npm install
npm run install-all
```

### 2. Configure server

Copy `server/.env.example` to `server/.env`.

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/hidden-maze
CLIENT_URL=http://localhost:5173
```

MongoDB Atlas can be used instead of local MongoDB.

### 3. Start both apps

```bash
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:5000/api/health

### 4. Build frontend

```bash
npm run build
```

## OA / Interview talking points

1. React state controls the active game state and re-renders the board.
2. A seeded randomized DFS generates the maze deterministically.
3. BFS verifies reachability so every key and exit is reachable from the start.
4. Express provides a small REST API for persistence.
5. MongoDB stores completion state without making the game dependent on the database.
6. The UI separates level data, game engine logic, components, and API calls.
