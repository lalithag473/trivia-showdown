# Trivia Showdown — Neon Championship

A real-time, room-code multiplayer trivia MVP for 2–10 players.

## Included
- Host creates a room and shares a six-character code.
- Players join from their own phones using the same public URL.
- Questions are broadcast to everyone at once.
- Server receives answers and ranks correct answers by server receipt order.
- First/second/third/fourth+ correct answers earn 100/75/50/25 points.
- Incorrect answers are eliminated immediately.
- Repeat answers and answers from eliminated players are rejected.
- Host reveals answers and advances rounds.
- Neon Championship responsive UI and synthesized answer sounds.

## Run locally
Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. For phone testing on the same Wi-Fi, use your computer's LAN IP and port 3000.

## Publish on Render
1. Create a GitHub account/repository and upload these project files.
2. Sign in to Render and choose **New > Blueprint**.
3. Connect the repository containing `render.yaml`.
4. Deploy the `trivia-showdown` service.
5. Share the public `onrender.com` URL. The host creates a room; players enter the same URL and room code.

Render free services may sleep when idle; the first wake-up can take a little time. Check the host's current plan and pricing before relying on it for an event.

## Game rules / current MVP behavior
- The host must remain connected during the game.
- Minimum 2, maximum 10 players.
- One incorrect answer eliminates that player for the rest of the game.
- Correct answer rank is determined by the order the server receives submissions.
- The host advances after all surviving players have answered.
- No timer enforcement yet; a countdown is not currently used to auto-close submissions.
- This is an MVP: refresh/reconnect recovery, persistent rooms, moderation, anti-cheat, and production monitoring are not included.
- Answers are checked against accepted exact normalized strings; review the question bank before public events.

## Before a live event
Test the public URL with multiple devices and networks. Keep the host tab open. Review the questions and accepted answers for ambiguity.
