import React from "react";
import "./styles.css"; // Ensure styles are applied
import quizifyIcon from "./assets/quizify-icon.png"; // Replace with actual path

const TopBar = () => {
  return (
    <div className="top-bar">
      <img src={quizifyIcon} alt="Quizify Logo" className="quizify-icon" />
      <h1 className="quizify-title">Quizify</h1>
    </div>
  );
};

export default TopBar;
