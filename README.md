# Spotify Music Quiz

**A multiplayer quiz game where players test how well they know each other's music taste using their Spotify data.**

## 🚀 Features
- **Spotify Login:** Users authenticate using their Spotify account.
- **Multiplayer Mode:** Two users join the same room to play.
- **Dynamic Questions:** Players guess each other's top artists, songs, and genres.
- **Scoring System:** Points are awarded based on correct guesses.
- **Real-time Gameplay:** Uses WebSockets for live interactions.
- **Interactive UI:** Selected answers are highlighted, with a max of 5 per category.

---

## 🛠️ **Tech Stack**
- **Frontend:** React, Socket.io-client
- **Backend:** Node.js, Express, Socket.io
- **Spotify API:** Fetch user top artists, tracks, and genres
- **Styling:** CSS (Spotify-inspired theme)

## Setup
- Install React and Node.js
- Download the .env, server.js and App.js in different folders.
- In the App.js folder run npm install
- In the server.js folder run npm install
- In the server.js folder run node server.js
- In the App.js folder run npm start and localhost:3000 will be automatically redirected to in your primary browser.

# How to Play
1. Login with Spotify to fetch your top artists, songs, and genres.
2. Create or Join a Room with another player.
3. Answer Questions about the other player's music taste.
4. Submit Answers and wait for results!
5. See Your Score and find out who wins!

# Future Improvements
🎨 Better UI/UX Enhancements
🏆 Leaderboard System
📊 More Question Types
🌍 Support for More Players
