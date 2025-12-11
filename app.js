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
import { startBlackjack, handleBlackjackAction } from './blackjack.js';
import { startGuessGame, handleGuess } from './guess.js';
import { startTicTacToe, handleTicTacToeMove } from './tictactoe.js';
import {
  MIN_REMINDER_MS,
  MAX_REMINDER_MS,
  simonGames,
  simonRecords,
  getSimonDisplayName,
  generateSimonSequence,
  normalizeSimonGuess,
  updateSimonRecord,
  clearSimonTimers,
  deleteSimonSequenceMessage,
  sendSimonFollowUp,
  sendSimonSequence,
  finalizeSimonGame,
  abortSimonGame,
  handleSimonTimeout,
  getSimonViewDurationMs,
  getSimonResponseDurationMs
} from './simon.js';
import {
  hangmanGames,
  startHangmanGame,
  handleHangmanGuess
} from './hangman.js';

// 🔹 Multiplayer blackjack imports
import {
  startBlackjackMulti,
  handleBlackjackMultiAction
} from './blackjack-multi.js';

// Store active games
const blackjackGames = {};          // single-player games
const blackjackMultiTables = {};    // multiplayer tables


/**
 * Hangman game handlers
 */

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

const HELP_ENTRIES = [
  { name: 'help', description: 'Show available commands or details for one command.' },
  { name: 'tictactoe', description: 'Play tic tac toe vs the bot. Use /tictactoe position:<1-9> to make moves.' },
  { name: 'hangman', description: 'Start a text Hangman game. Guess letters with /hangguess letter:<a-z>.' },
  { name: 'guessgame', description: 'are you good at guessing come find out'},
  { name: 'joke', description: 'Get a random joke.' },
  { name: 'quote', description: 'Get a random inspirational or funny quote.' },
  { name: 'remindme', description: 'Set a reminder, e.g. /remindme duration:10m message:Take a break.' },
  { name: 'math', description: 'Math helper: add/subtract/multiply/divide two numbers.' },
  { name: 'blackjack', description: 'Play single-player blackjack.' },
  { name: 'blackjack_multi', description: 'Create/join a multiplayer blackjack table.' },
  { name: 'simon', description: 'Start a Simon Says memory challenge. Submit with /sg, view top scores with /slb.' },
];

function getHelpEntry(commandName) {
  const target = (commandName || '').toLowerCase().trim();
  if (!target) return null;
  return HELP_ENTRIES.find(entry => entry.name.toLowerCase() === target) || null;
}

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games

/**
 * Math command handlers
 */
function handleDivCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0) {
    return { flags: InteractionResponseFlags.EPHEMERAL, content: "❌ Cannot divide by zero!" };
  }

  const result = num1 / num2;
  return { flags: InteractionResponseFlags.EPHEMERAL, content: `✅ The result of ${num1} ÷ ${num2} is **${result}**` };
}

function handleMultiCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  if (num2 === 0 || num1 === 0) {
    return { flags: InteractionResponseFlags.EPHEMERAL, content: `✅ The result of ${num1} * ${num2} is **0**` };
  }

  const result = num1 * num2;
  return { flags: InteractionResponseFlags.EPHEMERAL, content: `✅ The result of ${num1} * ${num2} is **${result}**` };
}

function handleAddCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 + num2;
  return { flags: InteractionResponseFlags.EPHEMERAL, content: `✅ The result of ${num1} + ${num2} is **${result}**` };
}

function handleSubCommand(data) {
  const num1 = Number(data.options?.[0]?.value || 0);
  const num2 = Number(data.options?.[1]?.value || 1);

  const result = num1 - num2;
  return { flags: InteractionResponseFlags.EPHEMERAL, content: `✅ The result of ${num1} - ${num2} is **${result}**` };
}


/**
 * Hotter/Colder game handlers
 */

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


/**
 * Interactions endpoint
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { id, type, data, member } = req.body;

  if (type === InteractionType.PING) return res.send({ type: InteractionResponseType.PONG });


  if (type === InteractionType.APPLICATION_COMMAND) {

    // Identify user for ANY command (guilds + DMs)
    const userId =
      req.body.member?.user?.id ||
      req.body.user?.id;


    const { name } = data;

    if (name === 'help') {
      const specific = getOptionValue(data.options, 'command');
      const entry = getHelpEntry(specific);

      const content = entry
        ? `**/${entry.name}**\n${entry.description}`
        : [
            '🤖 **Available commands**',
            HELP_ENTRIES.map(e => `• **/${e.name}** — ${e.description}`).join('\n'),
            'Use `/help command:<name>` for details on one command.',
          ].join('\n');

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL,
          content,
        },
      });
    }

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

    if (name === 'simon') {
      const userId = req.body?.member?.user?.id || req.body?.user?.id;
      const displayName = getSimonDisplayName(req.body);
      const appId = process.env.APP_ID;

      if (!userId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'I could not determine who started the game. Please try again.',
          },
        });
      }

      if (!appId) {
        console.error('Missing APP_ID for Simon game');
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: '❌ Missing application configuration. Please try again later.',
          },
        });
      }

      await abortSimonGame(userId);

      const game = {
        userId,
        displayName,
        level: 1,
        sequence: generateSimonSequence(1),
        appId,
        latestToken: req.body.token,
        responseDeadline: 0,
        sequenceMessage: null,
        hideTimeout: null,
        responseTimeout: null,
      };
      simonGames.set(userId, game);

      const bestLevel = simonRecords.get(userId)?.bestLevel ?? 0;
      const viewSeconds = (getSimonViewDurationMs(game.level) / 1000).toFixed(0);
      const answerSeconds = (getSimonResponseDurationMs(game.level) / 1000).toFixed(1).replace(/\.0$/, '');

      setTimeout(() => {
        sendSimonSequence(game).catch(error => console.error('Failed to send opening Simon sequence', error));
      }, 0);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL,
          content: [
            `🧠 Starting Simon Says for **${displayName}**!`,
            `Level 1 will show ${game.sequence.length} numbers for ${viewSeconds}s and you get ${answerSeconds}s to answer.`,
            bestLevel ? `Personal best: level ${bestLevel}.` : 'Set your first record!',
            'Use /sg to submit what you remember.',
          ].join('\n'),
        },
      });
    }

    if (name === 'sg') {
      const userId = req.body?.member?.user?.id || req.body?.user?.id;
      const displayName = getSimonDisplayName(req.body);
      const guessInput = getOptionValue(data.options, 'sequence');
      const normalizedGuess = normalizeSimonGuess(guessInput);

      if (!userId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'I could not identify you. Please try again.',
          },
        });
      }

      if (!normalizedGuess) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'Please enter only digits (0-9). You can separate them with spaces or type them together.',
          },
        });
      }

      const game = simonGames.get(userId);
      if (!game) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'Start a session first with /simon.',
          },
        });
      }

      const now = Date.now();
      if (game.responseDeadline && now > game.responseDeadline) {
        const { record, completedLevel } = await finalizeSimonGame(game, Math.max(game.level - 1, 0));
        const lines = [
          `⌛ Time ran out before you answered. The sequence was \`${game.sequence.join(' ')}\`.`,
          `You reached level ${completedLevel}.`,
        ];
        if (record.isNewRecord && completedLevel > 0) {
          lines.push('🎉 New personal best!');
        } else if (record.bestLevel) {
          lines.push(`Best level: ${record.bestLevel}.`);
        }
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: lines.join('\n'),
          },
        });
      }

      const correctSequence = game.sequence.join('');
      if (normalizedGuess !== correctSequence) {
        const { record, completedLevel } = await finalizeSimonGame(game, Math.max(game.level - 1, 0));
        const lines = [
          `❌ Not quite. The correct sequence was \`${game.sequence.join(' ')}\`.`,
          `You made it to level ${completedLevel}.`,
        ];
        if (record.isNewRecord && completedLevel > 0) {
          lines.push('🎉 New personal best!');
        } else if (record.bestLevel) {
          lines.push(`Best level: ${record.bestLevel}.`);
        }
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: lines.join('\n'),
          },
        });
      }

      const completedLevel = game.level;
      const record = updateSimonRecord(userId, completedLevel, displayName);
      clearSimonTimers(game);
      await deleteSimonSequenceMessage(game);

      game.level += 1;
      game.sequence = generateSimonSequence(game.level);
      game.latestToken = req.body.token;
      game.displayName = displayName;

      const viewSeconds = (getSimonViewDurationMs(game.level) / 1000).toFixed(0);
      const answerSeconds = (getSimonResponseDurationMs(game.level) / 1000).toFixed(1).replace(/\.0$/, '');

      setTimeout(() => {
        sendSimonSequence(game).catch(error => console.error('Failed to send next Simon sequence', error));
      }, 0);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL,
          content: [
            `✅ Correct! Level ${completedLevel} cleared.`,
            `Level ${game.level} incoming — ${game.sequence.length} numbers, ${viewSeconds}s view window, ${answerSeconds}s to answer.`,
            record.isNewRecord ? '🎉 New personal best!' : `Best level: ${record.bestLevel}.`,
          ].join('\n'),
        },
      });
    }

    if (name === 'slb') {
      const leaderboard = Array.from(simonRecords.entries())
        .filter(([, value]) => value.bestLevel > 0)
        .sort((a, b) => b[1].bestLevel - a[1].bestLevel)
        .slice(0, 10);

      const content = leaderboard.length
        ? leaderboard.map(([_, value], index) => `**${index + 1}.** ${value.displayName} — Level ${value.bestLevel}`).join('\n')
        : 'No records yet. Be the first with /simon!';

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL,
          content: `🏆 **Simon Says Leaderboard**\n${content}`,
        },
      });
    }


    // 🎰 SINGLE-PLAYER BLACKJACK
    if (name === 'blackjack') {
      const gameId = req.body.id; // use interaction ID
      const result = startBlackjack(blackjackGames, gameId, userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    // 🃏 MULTIPLAYER BLACKJACK
    if (name === 'blackjack_multi') {
      const tableId = req.body.id; // unique table ID
      const result = startBlackjackMulti(blackjackMultiTables, tableId, userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    // "/tictactoe" command

    if (name === 'tictactoe') {
      const userId = req.body.member?.user?.id || req.body.user?.id;

      if (!userId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: '❌ Could not identify user for this game.',
          },
        });
      }

      const positionOption = data.options?.find(opt => opt.name === 'position');
      const position = positionOption?.value;

      // If no position provided, start a new game
      if (!position) {
        const result = startTicTacToe(userId);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: result,
        });
      }

      // Otherwise, handle the move
      const result = handleTicTacToeMove(userId, position);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
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

    // Hangman commands
    if (name === 'hangman') {
      const userId =
        req.body.member?.user?.id ||
        req.body.user?.id;

      const result = startHangmanGame(userId);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    if (name === 'hangguess') {
      const userId =
        req.body.member?.user?.id ||
        req.body.user?.id;

      const result = handleHangmanGuess(data, userId);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    // Hotter/Colder game commands
    if (name === 'guessgame') {
      const result = startGuessGame(userId);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result
      });
    }

    if (name === 'guess') {
      const number = getOptionValue(data.options, 'number');
      const result = handleGuess(userId, number);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result
      });
    }


    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const userId = req.body.member?.user?.id || req.body.user?.id;
    const customId = data.custom_id;

    // 🎰 Single-player blackjack buttons
    if (customId.startsWith("blackjack_")) {
      const action = customId.replace("blackjack_", "");
      const result = handleBlackjackAction(blackjackGames, userId, action);

      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: result.content,
          components: result.components,
        },
      });
    }

    // 🃏 Multiplayer blackjack buttons (bjm_join, bjm_hit, etc.)
    if (customId.startsWith("bjm_")) {
      const [prefix, tableId] = customId.split(":");
      const action = prefix.replace("bjm_", "");

      const result = handleBlackjackMultiAction(
        blackjackMultiTables,
        tableId,
        userId,
        action
      );

      // ephemeral (private) reply ONLY to the user
      if (result.ephemeral) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: result.content,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      // update shared message
      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: result.content,
          components: result.components,
        },
      });
    }

    console.error("Unknown component:", customId);
    return res.status(400).json({ error: "unknown component" });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
