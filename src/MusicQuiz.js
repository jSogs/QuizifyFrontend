import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./styles.css"
import { v4 as uuidv4 } from "uuid"; // To generate unique room IDs

const socket = io("http://localhost:4000");

const MusicQuiz = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [roomID, setRoomID] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [users, setUsers] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({ artists: [], songs: [] });
  const [correctAnswers, setCorrectAnswers] = useState({ artists: [], songs: [] });
  const [gameResults, setGameResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [termLength, setTermLength] = useState("medium");
  const [submitButtonDisabled, setSubmitButtonDisabled] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("access_token");

    if (token) {
      setAccessToken(token);
      localStorage.setItem("accessToken", token);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleLogin = () => {
    window.location.href = "http://localhost:4000/login";
  };

  // 🔹 Create Room: Generate a unique room ID and join it
  const createRoom = () => {
    const newRoomID = uuidv4().slice(0, 6); // Generate short unique ID
    setRoomID(newRoomID);
    setInRoom(true);
    setWaitingForPlayer(true);
    socket.emit("join_room", { roomID: newRoomID, accessToken, termLength });
  };

  // 🔹 Join an Existing Room
  const joinRoom = () => {
    if (roomID && accessToken) {
      setInRoom(true);
      socket.emit("join_room", { roomID, accessToken });
    }
  };

  // 🔹 Listen for another player joining
  socket.on("room_ready", () => {
    setWaitingForPlayer(false);
    setRoomReady(true);
  });

  socket.on("quiz_ready", (data) => {
    setWaitingForPlayer(false);
    setQuiz(data.questions);
    setRoomReady(true);
    setUsers(data.users);
    setCorrectAnswers({
      artists: data.questions.artists.correctAnswers,
      songs: data.questions.songs.correctAnswers
    });
  });

  // 🔹 Listen for game results
  useEffect(() => {
    const handleGameResults = (data) => {
      console.log("Game results received:", data); // 🔹 Debugging Log
      setGameResults(data); // 🔹 Update state
      setLoading(false);
    };
  
    socket.on("game_results", handleGameResults);
  
    return () => {
      socket.off("game_results", handleGameResults); // 🔹 Clean up listener on re-render
    };
  }, []);
  

  // 🔹 Submit Answers
  const submitAnswers = () => {
    setLoading(true);
    socket.emit("submit_answers", { roomID, userID: socket.id, answers: selectedAnswers });
  };

  const handleSelection = (category, option) => {
    setSelectedAnswers((prev) => {
      const alreadySelected = prev[category].includes(option);

      if (alreadySelected) {
        // If already selected, remove from the list
        return {
          ...prev,
          [category]: prev[category].filter((item) => item !== option),
        };
      } else {
        // If not selected, only add if limit isn't reached
        if (prev[category].length < 5) {
          return {
            ...prev,
            [category]: [...prev[category], option],
          };
        }
      }
      return prev;
    });
    if(selectedAnswers.artists.length === 5 && selectedAnswers.songs.length === 5){
      setSubmitButtonDisabled(false);
    }
  };

  const SelectedAnswers = ({ selectedAnswers }) => {
    return (
      <div className="selected-answers">
        <h4>Selected Artists:</h4>
        <ol>
          {selectedAnswers.artists.map((artist, index) => (
            <li key={index}>{artist}</li>
          ))}
        </ol>
  
        <h4>Selected Songs:</h4>
        <ol>
          {selectedAnswers.songs.map((song, index) => (
            <li key={index}>{song}</li>
          ))}
        </ol>
      </div>
    );
  };

  // Function to determine color based on correctness
  const getAnswerColor = (userAnswer, correctAnswers, index) => {
    if (userAnswer === correctAnswers[index]) return "correct"; // ✅ Green (Correct & Right Position)
    if (correctAnswers.includes(userAnswer)) return "almost"; // 🟢 Light Green (Correct but Wrong Position)
    return "wrong"; // ❌ Red (Incorrect)
  };

  const GameResults = ({ gameResults, selectedAnswers, correctAnswers }) => {
    console.log("gotten game results");
    console.log(gameResults.scores);

    return (
      <div className="result-container">
        <h3 className="result-title">Game Over!</h3>

        {/* Display Scores for All Players */}
        {users.map((user, index) => (
          <p className="result-score" key={index}>
            {user.name}: {gameResults.scores[user.id]}
          </p>
        ))}

        {/* Winner Announcement */}
        <p className="result-score">
          Winner: {gameResults.winner === "tie" ? "It's a tie!" : `User ${gameResults.winner}`}
        </p>

        {/* Display User Choices vs. Correct Answers */}
        {(
          <>
            <h4 className="comparison-title"> How did your selections do?</h4>

            <div className="category-section">
              <h5>ARTISTS</h5>
              <ul className="results-list">
                {selectedAnswers.artists.map((answer, index) => (
                  <li key={index} className="comparison-item">
                    <span className={`user-answer ${getAnswerColor(answer, correctAnswers.artists, index)}`}>
                      {answer}
                    </span>
                    <span className="separator">→</span>
                    <span className="correct-answer">{correctAnswers.artists[index]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="category-section">
              <h5>SONGS</h5>
              <ul className="results-list">
                {selectedAnswers.songs.map((answer, index) => (
                  <li key={index} className="comparison-item">
                    <span className={`user-answer ${getAnswerColor(answer, correctAnswers.songs, index)}`}>
                      {answer}
                    </span>
                    <span className="separator">→</span>
                    <span className="correct-answer">{correctAnswers.songs[index]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      {!accessToken ? (
        <button className="spotify-button" onClick={handleLogin}>Login with Spotify</button>
      ) : (
        <div className="room-container">
          {!inRoom ? (
            <div>
              <select className="term-select" value={termLength} onChange={(e) => setTermLength(e.target.value)}>
                <option value="short">Short Term - 4 weeks</option>
                <option value="medium">Medium Term - 6 months</option>
                <option value="long">Long Term - 1 year</option>
              </select>
              <button className="spotify-button" onClick={createRoom}>Create Room</button>
              <br />
              <input
                className="room-input"
                type="text"
                placeholder="Enter Room ID"
                onChange={(e) => setRoomID(e.target.value)}
              />
              <button className="spotify-button" onClick={joinRoom}>Join Room</button>
            </div>
          ) : (
            <div>
              <h3>Room ID: {roomID}</h3>
              {waitingForPlayer ? (<p>Waiting for another player to join...</p>):<div></div>}
            </div>
          )}
          {gameResults ? (
            <GameResults gameResults={gameResults} selectedAnswers={selectedAnswers} correctAnswers={correctAnswers}/>
          ) : 
            <>
              {!loading ? (
                <>
                {roomReady && (  
                  <div>
                    <h1>In Game:</h1>
                    {users.map((user, index) => (
                      <h3 key={index}>{user.name}</h3> 
                    ))}
                  </div>
                )}
  
                {roomReady && quiz && (
                  <div className="questions-container">
                    <div className="questions-section">
                      {Object.entries(quiz).map(([key, questionData]) => (
                        <div key={key}>
                          <h3 className="question-title">{questionData.question}</h3>
                          <div className="answer-buttons">
                            {questionData.options.map((option) => {
                              const answerKey = questionData.question.includes("artists") ? "artists" : "songs";
                              const isSelected = selectedAnswers[answerKey].includes(option);
                              const isDisabled = selectedAnswers[answerKey].length >= 5 && !isSelected;
                              
                              return (
                                <button
                                  className={`answer-button ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                                  key={option}
                                  onClick={() =>{ handleSelection(answerKey,option); }}
                                  isDisabled={isDisabled}
                                >
                                  {option}
                                </button> 
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <SelectedAnswers selectedAnswers={selectedAnswers} />
                    <button className="submit-button" onClick={submitAnswers} isDisabled={submitButtonDisabled}>Submit Answers</button>
                  </div>
                )}
              </>
              ) : (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Calculating Results...</p>
                </div>
              )}
            </>
          }
        </div>
        )}
      </div>
  );
};

export default MusicQuiz;
