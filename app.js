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
function handleDivCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0) {
    return {
      content: "❌ Cannot divide by zero!",
    };
  }

  const result = num1 / num2;
  return {
    content: `✅ The result of ${num1} ÷ ${num2} is **${result}**`,
  };
}
function handleMultiCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0 || num1 === 0) {
    return {
      content: `✅ The result of ${num1} * ${num2} is **${0}**`,
    };
  }

  const result = num1 * num2;
  return {
    content: `✅ The result of ${num1} * ${num2} is **${result}**`,
  };
}
function handleAddCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 + num2;
  return {
    content: `✅ The result of ${num1} + ${num2} is **${result}**`,
  };
}
function handleSubCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 - num2;
  return {
    content: `✅ The result of ${num1} - ${num2} is **${result}**`,
  };
}

// ========== TIC TAC TOE STATE + HELPERS ==========
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
// ========== END TIC TAC TOE HELPERS ==========


/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

        // "/div" command
    if (name === 'div') {
      const result = handleDivCommand(data);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    if (name === 'multi') {
      const result = handleMultiCommand(data);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    if (name === 'add') {
      const result = handleAddCommand(data);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    if (name === 'sub') {
      const result = handleSubCommand(data);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

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
    
    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});// Task 3: Addition user story – documented by Shivek Tiwari
