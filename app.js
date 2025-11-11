import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Math command handlers
 */
function handleDivCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0) {
    return { content: "❌ Cannot divide by zero!" };
  }

  const result = num1 / num2;
  return { content: `✅ The result of ${num1} ÷ ${num2} is **${result}**` };
}

function handleMultiCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0 || num1 === 0) {
    return { content: `✅ The result of ${num1} * ${num2} is **0**` };
  }

  const result = num1 * num2;
  return { content: `✅ The result of ${num1} * ${num2} is **${result}**` };
}

function handleAddCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 + num2;
  return { content: `✅ The result of ${num1} + ${num2} is **${result}**` };
}

function handleSubCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 - num2;
  return { content: `✅ The result of ${num1} - ${num2} is **${result}**` };
}

/**
 * Hotter/Colder game handlers
 */
function handleGuessGameCommand(userId) {
  if (!activeGames[userId]) {
    activeGames[userId] = { number: Math.floor(Math.random() * 100) + 1, previousGuess: null };
    return { content: "🎲 I picked a number between 1 and 100! Make a guess using `/guess <number>`." };
  } else {
    return { content: "You already have an ongoing game! Use `/guess <number>` to continue." };
  }
}

function handleGuessCommand(data, userId) {
  const game = activeGames[userId];
  if (!game) return { content: "You don't have an active game. Start one with `/guessgame`." };

  const guess = Number(data.options?.[0]?.value);
  if (isNaN(guess) || guess < 1 || guess > 100) return { content: "Please provide a valid number between 1 and 100." };

  if (guess === game.number) {
    delete activeGames[userId];
    return { content: `🎉 Congratulations! You guessed the number ${guess}!` };
  }

  let response = game.previousGuess === null
    ? "Not quite! Make another guess!"
    : Math.abs(game.number - guess) < Math.abs(game.number - game.previousGuess)
      ? "🔥 Hotter! You're getting closer."
      : "❄️ Colder! You're getting farther away.";

  game.previousGuess = guess;
  return { content: response };
}

/**
 * Interactions endpoint
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { id, type, data, member } = req.body;

  if (type === InteractionType.PING) return res.send({ type: InteractionResponseType.PONG });

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // Math commands
    if (name === 'div') {
      const result = handleDivCommand(data);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    if (name === 'multi') {
      const result = handleMultiCommand(data);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    if (name === 'add') {
      const result = handleAddCommand(data);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    if (name === 'sub') {
      const result = handleSubCommand(data);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    // Hotter/Colder game commands
    if (name === 'guessgame') {
      const result = handleGuessGameCommand(member.user.id);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    if (name === 'guess') {
      const result = handleGuessCommand(data, member.user.id);
      return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: result });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
