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

// Joke handler
function handleJokeCommand() {
  const jokes = [
    "Why don’t programmers like nature? Too many bugs.",
    "Why do Java developers wear glasses? Because they can't C#.",
    "I told my computer I needed a break—it said 'No problem, I'll go to sleep.'",
    "Debugging is like being a detective in a crime movie where you're also the murderer.",
    "Why was the developer broke? Because he used up all his cache."
  ];

  return { content: jokes[Math.floor(Math.random() * jokes.length)] };
}

// Quote handler
function handleQuoteCommand() {
  const quotes = [
    "“The best way to predict the future is to invent it.” — Alan Kay",
    "“Stay hungry, stay foolish.” — Steve Jobs",
    "“Whether you think you can or you think you can’t, you're right.” — Henry Ford",
    "“Strive for progress, not perfection.”",
    "“Small steps every day lead to big results.”"
  ];

  return { content: quotes[Math.floor(Math.random() * quotes.length)] };
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

    if (name === 'joke') {
      const result = handleJokeCommand();
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result
      });
    }
    
    if (name === 'quote') {
      const result = handleQuoteCommand();
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result
      });
    }


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


    // Combined Math Command
    if (name === 'math') {
      const options = data.options;

      const operation = options.find(o => o.name === 'operation').value;
      const num1 = Number(options.find(o => o.name === 'num1').value);
      const num2 = Number(options.find(o => o.name === 'num2').value);

      // Convert values back into the format your handlers expect:
      const fakeData = {
        options: [
          { value: num1 },
          { value: num2 }
        ]
      };

      let result;

      switch (operation) {
        case 'add':
          result = handleAddCommand(fakeData);
          break;
        case 'sub':
          result = handleSubCommand(fakeData);
          break;
        case 'multi':
          result = handleMultiCommand(fakeData);
          break;
        case 'div':
          result = handleDivCommand(fakeData);
          break;
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result
      });
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
