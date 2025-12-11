import { InteractionResponseFlags } from "discord-interactions";

// Store active Tic Tac Toe games
const tttGames = {}; // key: userId, value: 9-element board array

// Create a new empty board
function newBoard() {
  return Array(9).fill(null);
}

// Render board exactly like app.js currently does
function renderBoard(board) {
  const display = board.map((cell, i) => (cell ? cell : i + 1));
  return (
    "```text\n" +
    `${display[0]} | ${display[1]} | ${display[2]}\n` +
    "---------\n" +
    `${display[3]} | ${display[4]} | ${display[5]}\n` +
    "---------\n" +
    `${display[6]} | ${display[7]} | ${display[8]}\n` +
    "```"
  );
}

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board, symbol) {
  return WIN_LINES.some(([a, b, c]) => (
    board[a] === symbol && board[b] === symbol && board[c] === symbol
  ));
}

// Random bot move
function getBotMoveIndex(board) {
  const empty = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) empty.push(i);
  }
  if (empty.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * empty.length);
  return empty[randomIndex];
}

// Start game function
export function startTicTacToe(userId) {
  const board = newBoard();
  tttGames[userId] = board;

  return {
    flags: InteractionResponseFlags.EPHEMERAL,
    content:
      "🎮 **Tic Tac Toe started!**\n" +
      "You are **X**, bot is **O**.\n" +
      "Make a move with `/tictactoe position:<1-9>`.\n\n" +
      renderBoard(board),
  };
}

// Handle moves
export function handleTicTacToeMove(userId, position) {

  if (!tttGames[userId]) {
    tttGames[userId] = newBoard();
  }
    
  const board = tttGames[userId];
  if (!board) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: "❌ You don't have an active Tic Tac Toe game. Start one with `/tictactoe`.",
    };
  }

  const idx = Number(position) - 1;
  if (idx < 0 || idx > 8) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: "❌ Position must be between **1 and 9**.",
    };
  }

  if (board[idx] !== null) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: "❌ That spot is already taken.\n" + renderBoard(board),
    };
  }

  // Player move
  board[idx] = "X";

  // Check if player wins
  if (checkWinner(board, "X")) {
    delete tttGames[userId];
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        "🎉 **You win!**\n" +
        renderBoard(board),
    };
  }

  // Check draw before bot move
  if (board.every(cell => cell !== null)) {
    delete tttGames[userId];
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        "🤝 **It's a draw!**\n" +
        renderBoard(board),
    };
  }

  // Bot move
  const botIdx = getBotMoveIndex(board);
  if (botIdx !== null) {
    board[botIdx] = "O";
  }

  // Check if bot wins
  if (checkWinner(board, "O")) {
    delete tttGames[userId];
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        "💀 **Bot wins!**\n" +
        renderBoard(board),
    };
  }

  // Check if draw
  if (board.every(cell => cell !== null)) {
    delete tttGames[userId];
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        "🤝 **It's a draw!**\n" +
        renderBoard(board),
    };
  }

  // Game continues
  return {
    flags: InteractionResponseFlags.EPHEMERAL,
    content:
      "Your move!\n" +
      renderBoard(board),
  };
}
