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


const MIN_REMINDER_MS = 10 * 1000; // keep reminders reasonable (>10s)
const MAX_REMINDER_MS = 24 * 60 * 60 * 1000; // cap at 24h to avoid runaway timers

function getOptionValue(options = [], optionName) {
  return options.find(option => option.name === optionName)?.value;
}

function parseReminderDuration(raw) {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  const durationRegex = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|m|seconds?|secs?|sec|s)/g;
  let totalMs = 0;
  let match;
  let foundAny = false;

  while ((match = durationRegex.exec(normalized)) !== null) {
    foundAny = true;
    const value = Number(match[1]);
    if (Number.isNaN(value)) {
      continue;
    }

    const unit = match[2];
    if (unit.startsWith('h')) {
      totalMs += value * 60 * 60 * 1000;
    } else if (unit.startsWith('m')) {
      totalMs += value * 60 * 1000;
    } else if (unit.startsWith('s')) {
      totalMs += value * 1000;
    }
  }

  if (!foundAny || totalMs === 0) {
    return null;
  }

  return Math.round(totalMs);
}

function humanizeDuration(ms) {
  const parts = [];
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);

  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (!hours && !minutes && seconds) {
    parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  }

  if (!parts.length) {
    return 'a few seconds';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const last = parts.pop();
  return `${parts.join(', ')} and ${last}`;
}

function scheduleReminder({ delayMs, reminderText, userId, appId, interactionToken }) {
  if (!appId || !interactionToken) {
    console.error('Cannot schedule reminder without app ID or interaction token');
    return;
  }

  setTimeout(async () => {
    try {
      const mention = userId ? `<@${userId}>` : 'Reminder';
      await DiscordRequest(`webhooks/${appId}/${interactionToken}`, {
        method: 'POST',
        body: {
          content: `${mention} ⏰ Reminder: ${reminderText}`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } catch (error) {
      console.error('Failed to send reminder follow-up', error);
    }
  }, delayMs);
}

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

const tttGames = {}; // key: userId, value: 9-element array board

function newBoard() {
  return Array(9).fill(null);
}

function renderBoard(board) {
  const display = board.map((cell, i) => (cell ? cell : (i + 1)));
  return (
    '```text\n' +
    `${display[0]} | ${display[1]} | ${display[2]}\n` +
    '---------\n' +
    `${display[3]} | ${display[4]} | ${display[5]}\n` +
    '---------\n' +
    `${display[6]} | ${display[7]} | ${display[8]}\n` +
    '```'
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

function getBotMoveIndex(board) {
  const empty = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) empty.push(i);
  }
  if (empty.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * empty.length);
  return empty[randomIndex];
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

    // "/tictactoe" command
    if (name === 'tictactoe') {
      // Get the position option (1-9)
      const positionOption = data.options?.find(
        (opt) => opt.name === 'position'
      );
      const position = Number(positionOption?.value);

      if (!Number.isInteger(position) || position < 1 || position > 9) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Please choose a position from **1** to **9**.',
          },
        });
      }

      // Identify user (works in guilds + DMs)
      const userId =
        req.body.member?.user?.id ||
        req.body.user?.id;

      if (!userId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Could not identify user for this game.',
          },
        });
      }

      // Load existing board or start a new one
      let board = tttGames[userId];
      if (!board) board = newBoard();

      const index = position - 1;

      // If the cell is taken, don't let the user overwrite it
      if (board[index] !== null) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              'That spot is already taken.\n' +
              renderBoard(board),
          },
        });
      }

      // Player move: X
      board[index] = 'X';

      // Check if player wins
      if (checkWinner(board, 'X')) {
        delete tttGames[userId];
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `You placed **X** at position **${position}**.\n` +
              renderBoard(board) +
              '\n🎉 You win! Game over.',
          },
        });
      }

      // Check for draw before bot moves
      if (!board.includes(null)) {
        delete tttGames[userId];
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `You placed **X** at position **${position}**.\n` +
              renderBoard(board) +
              '\n🤝 It\'s a draw! Game over.',
          },
        });
      }

      // Bot move: O
      const botIndex = getBotMoveIndex(board);
      if (botIndex === null) {
        delete tttGames[userId];
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `You placed **X** at position **${position}**.\n` +
              renderBoard(board) +
              '\n🤝 It\'s a draw! Game over.',
          },
        });
      }

      board[botIndex] = 'O';
      const botPos = botIndex + 1;

      // Check if bot wins
      if (checkWinner(board, 'O')) {
        delete tttGames[userId];
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `You placed **X** at position **${position}**.\n` +
              `I placed **O** at position **${botPos}**.\n` +
              renderBoard(board) +
              '\n😈 I win! Game over.',
          },
        });
      }

      // Check for draw after bot move
      if (!board.includes(null)) {
        delete tttGames[userId];
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `You placed **X** at position **${position}**.\n` +
              `I placed **O** at position **${botPos}**.\n` +
              renderBoard(board) +
              '\n🤝 It\'s a draw! Game over.',
          },
        });
      }

      // Game continues – save state for this user
      tttGames[userId] = board;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            `You placed **X** at position **${position}**.\n` +
            `I placed **O** at position **${botPos}**.\n` +
            renderBoard(board) +
            '\nYour turn again! Use `/tictactoe position:<1-9>` to keep playing.',
        },
      });
    }

    if (name === 'remindme') {
      const durationInput = getOptionValue(data.options, 'duration');
      const reminderText = (getOptionValue(data.options, 'message') || '').trim();

      if (!reminderText) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'Please include what to remind you about.',
          },
        });
      }

      const delayMs = parseReminderDuration(durationInput);
      if (!delayMs) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'I could not understand that duration. Try values like `10m`, `45 seconds`, or `2h 30m`.',
          },
        });
      }

      if (delayMs < MIN_REMINDER_MS) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'Reminders must be at least 10 seconds in the future.',
          },
        });
      }

      if (delayMs > MAX_REMINDER_MS) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'I can only remember things up to 24 hours from now.',
          },
        });
      }

      const appId = process.env.APP_ID;
      const interactionToken = req.body?.token;
      const userId = req.body?.member?.user?.id || req.body?.user?.id;

      scheduleReminder({
        delayMs,
        reminderText,
        userId,
        appId,
        interactionToken,
      });

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL,
          content: `✅ I'll remind you in ${humanizeDuration(delayMs)}.`,
        },
      });
    }


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
