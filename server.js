const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* Create Express server */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = {}; // Stores room data { roomID: { users: [], data: {} } }

/* Important spotify api information*/
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

//Login route
app.get("/login", (req, res) => {
  const scope = "user-top-read user-read-recently-played";
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&show_dialog=true`;
  res.redirect(authUrl);    
});

//Callback route
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const tokenUrl = "https://accounts.spotify.com/api/token";

  const authData = new URLSearchParams();
  authData.append("grant_type", "authorization_code");
  authData.append("code", code);
  authData.append("redirect_uri", REDIRECT_URI);
  authData.append("client_id", CLIENT_ID);
  authData.append("client_secret", CLIENT_SECRET);

  //POST request to get user's access token
  try {
    const response = await axios.post(tokenUrl, authData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    res.redirect(`http://localhost:3000/?access_token=${response.data.access_token}`);
  } catch (error) {
    res.status(400).json({ error: error.response.data });
  }
});

// 🔹 Fetch User Data, Including Name
const getUserSpotifyData = async (accessToken, termLength) => {
  const timeRange = {
    short: "short_term",
    medium: "medium_term",
    long: "long_term",
  }[termLength] || "medium_term";

  try {
    const [profile, topArtists, topTracks] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=15`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    return {
      name: profile.data.display_name,
      topArtists: topArtists.data.items.map((artist) => artist.name),
      topTracks: topTracks.data.items.map(
          (track) => `${track.name} - ${track.artists.map((artist) => artist.name).join(", ")}`
      ),
    };
  } catch (error) {
    console.error("Error fetching Spotify data:", error);
    return null;
  }
};

// WebSocket logic to create rooms
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
  
    socket.on("join_room", async ({ roomID, accessToken, termLength }) => {
      if (!rooms[roomID]) {
        rooms[roomID] = { users: [], data: {} };
      }
  
      if (rooms[roomID].users.length < 2) {
        rooms[roomID].users.push(socket.id);
        if(!rooms[roomID].termLength){
          rooms[roomID].termLength=termLength;
        }
        rooms[roomID].data[socket.id] = await getUserSpotifyData(accessToken, rooms[roomID].termLength);
        
        console.log(rooms[roomID].data[socket.id]);
        socket.join(roomID);
        console.log(`User ${socket.id} joined room ${roomID}`);
  
        if (rooms[roomID].users.length === 2) {
          // Both users have joined, generate questions
          const userIDs = rooms[roomID].users;
          const user1ID = userIDs[0];
          const user2ID = userIDs[1];
  
          const user1Data = rooms[roomID].data[user1ID];
          const user2Data = rooms[roomID].data[user2ID];
  
          const questions = generateQuiz(user1Data, user2Data);
  
          // Store quiz in the room
          rooms[roomID].quiz = questions;
          
          io.to(user1ID).emit("quiz_ready", {
            roomID,
            questions: questions.user1, // Send only user1's questions
            users: [
                { id: user1ID, name: user1Data.name },
                { id: user2ID, name: user2Data.name },
            ],
          });
          
          io.to(user2ID).emit("quiz_ready", {
            roomID,
            questions: questions.user2, // Send only user2's questions
            users: [
                { id: user1ID, name: user1Data.name },
                { id: user2ID, name: user2Data.name },
            ],
          });
        }
      } else {
        socket.emit("room_full", { message: "This room is already full." });
      }
    });
  
    // Receive answers from users
    socket.on("submit_answers", ({ roomID, userID, answers }) => {
      if (!rooms[roomID].answers) {
        rooms[roomID].answers = {};
      }
      console.log(answers);
      rooms[roomID].answers[userID] = answers;
  
      // If both users have submitted answers, calculate scores
      if (Object.keys(rooms[roomID].answers).length === 2) {
        const userIDs = rooms[roomID].users;
        const user1ID = userIDs[0];
        const user2ID = userIDs[1];
  
        const score1 = calculateScore(rooms[roomID].quiz, rooms[roomID].answers[user1ID], rooms[roomID].data[user2ID]);
        const score2 = calculateScore(rooms[roomID].quiz, rooms[roomID].answers[user2ID], rooms[roomID].data[user1ID]);
  
        const result = {
          scores: { [user1ID]: score1, [user2ID]: score2 },
          winner: score1 > score2 ? rooms[roomID].data[user1ID].name : score2 > score1 ? rooms[roomID].data[user2ID].name : "tie",
        };

        //Send results to users
        console.log("Emitting game_results:", result);
        setTimeout(() => {
            io.to(roomID).emit("game_results", result);
        }, 2000); 
      }
    });
  
    socket.on("disconnect", () => {
      for (const roomID in rooms) {
        rooms[roomID].users = rooms[roomID].users.filter((id) => id !== socket.id);
        delete rooms[roomID].data[socket.id];
  
        if (rooms[roomID].users.length === 0) {
          delete rooms[roomID];
        }
      }
      console.log("User disconnected:", socket.id);
    });
  });
  
  const generateQuiz = (user1Data, user2Data) => {
    return {
      user1: {
        artists: {
            question: `What are ${user2Data.name}'s top 5 artists`,
            correctAnswers: user2Data.topArtists.slice(0, 5),
            options: shuffleArray(user2Data.topArtists.slice()),
        },
        songs: {
            question: `What are ${user2Data.name}'s top 5 songs`,
            correctAnswers: user2Data.topTracks.slice(0, 5),
            options: shuffleArray(user2Data.topTracks.slice()),
        },
    },
      user2: {
        songs: {
            question: `What are ${user1Data.name}'s top 5 songs`,
            correctAnswers: user1Data.topTracks.slice(0, 5),
            options: shuffleArray(user1Data.topTracks.slice()),
        },
        artists: {
            question: `What are ${user1Data.name}'s top 5 artists`,
            correctAnswers: user1Data.topArtists.slice(0, 5),
            options: shuffleArray(user1Data.topArtists.slice()),
        },
      }
    };
  };
  
  const calculateScore = (quiz, answers, correctData) => {
    let total = 0;
    const scoreList = (userAnswers, correctList) => {
      let score = 0;
      console.log(userAnswers);
      console.log(correctList);
      userAnswers.forEach((answer, index) => {
        if (answer === correctList[index]) {
          console.log("3: "+answer);
          score += 3;
        }
        else if (correctList.includes(answer)) {
          console.log("1: "+answer);
          score += 1;
        }
      });
      return score;
    };
  
    total += scoreList(answers.artists, correctData.topArtists.slice(0, 5));
    total += scoreList(answers.songs, correctData.topTracks.slice(0, 5));
    return total;
  };
  
  // 🔹 Utility Functions
  const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

server.listen(4000, '0.0.0.0' ,() => console.log("Server running on port 4000"));
