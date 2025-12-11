// guess.js

// Store guessing game states by user ID
const guessGames = {};

// Helper to start a new guessing game
export function startGuessGame(userId) {
  const secret = Math.floor(Math.random() * 100) + 1;

  guessGames[userId] = {
    secret,
    lastDiff: null
  };

  return {
    flags: 64, // InteractionResponseFlags.EPHEMERAL
    content: [
      "🎯 Guessing Game Started!",
      "I'm thinking of a number between **1–100**.",
      "Use `/guess number:<1-100>` to make a guess."
    ].join("\n")
  };
}

// Handle a guess
export function handleGuess(userId, number) {
  const game = guessGames[userId];

  if (!game) {
    return {
      flags: 64,
      content: "❌ You don't have an active guessing game. Start one with `/guessgame`."
    };
  }

  const diff = Math.abs(number - game.secret);

  if (number === game.secret) {
    delete guessGames[userId];
    return {
      flags: 64,
      content: `🎉 Correct! The number was **${number}**.`
    };
  }

  let feedback;

  if (game.lastDiff === null) {
    feedback = number > game.secret ? "Too high!" : "Too low!";
  } else {
    if (diff < game.lastDiff) {
      feedback = "🔥 Hotter!";
    } else if (diff > game.lastDiff) {
      feedback = "❄️ Colder!";
    } else {
      feedback = "😐 Same temperature!";
    }
  }

  game.lastDiff = diff;

  return {
    flags: 64,
    content: `Your guess: **${number}** — ${feedback}`
  };
}
