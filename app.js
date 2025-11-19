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
const MIN_REMINDER_MS = 10 * 1000; // keep reminders reasonable (>10s)
const MAX_REMINDER_MS = 24 * 60 * 60 * 1000; // cap at 24h to avoid runaway timers
const SIMON_VIEW_BASE_MS = 5 * 1000;
const SIMON_VIEW_INCREMENT_MS = 1000;
const SIMON_RESPONSE_BASE_MS = 10 * 1000;
const SIMON_RESPONSE_INCREMENT_MS = 1500;
const simonGames = new Map();
const simonRecords = new Map();

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

function getSimonDisplayName(body) {
  return (
    body?.member?.nick ||
    body?.member?.user?.global_name ||
    body?.member?.user?.username ||
    body?.user?.global_name ||
    body?.user?.username ||
    'Player'
  );
}

function getSimonViewDurationMs(level) {
  return SIMON_VIEW_BASE_MS + Math.max(0, level - 1) * SIMON_VIEW_INCREMENT_MS;
}

function getSimonResponseDurationMs(level) {
  return SIMON_RESPONSE_BASE_MS + Math.max(0, level - 1) * SIMON_RESPONSE_INCREMENT_MS;
}

function generateSimonSequence(level) {
  const length = Math.max(2, level + 1);
  return Array.from({ length }, () => Math.floor(Math.random() * 10));
}

function normalizeSimonGuess(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return null;
  }
  const compact = rawInput.replace(/\s+/g, '');
  if (!/^[0-9]+$/.test(compact)) {
    return null;
  }
  return compact;
}

function updateSimonRecord(userId, completedLevel, displayName) {
  const safeLevel = Math.max(0, completedLevel);
  const existing = simonRecords.get(userId);
  const previousBest = existing?.bestLevel ?? 0;
  const newBest = Math.max(previousBest, safeLevel);
  const record = {
    bestLevel: newBest,
    displayName: displayName || existing?.displayName || `Player ${userId}`,
  };
  simonRecords.set(userId, record);
  return {
    previousBest,
    bestLevel: newBest,
    isNewRecord: newBest > previousBest,
  };
}

function clearSimonTimers(game) {
  if (!game) return;
  if (game.hideTimeout) {
    clearTimeout(game.hideTimeout);
    game.hideTimeout = null;
  }
  if (game.responseTimeout) {
    clearTimeout(game.responseTimeout);
    game.responseTimeout = null;
  }
}

async function deleteSimonSequenceMessage(game) {
  if (!game?.sequenceMessage || !game?.appId) {
    return;
  }
  try {
    await DiscordRequest(`webhooks/${game.appId}/${game.sequenceMessage.token}/messages/${game.sequenceMessage.id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete Simon sequence message', error);
  } finally {
    game.sequenceMessage = null;
  }
}

async function sendSimonFollowUp(game, content) {
  if (!game?.appId || !game?.latestToken || !content) {
    return;
  }
  try {
    await DiscordRequest(`webhooks/${game.appId}/${game.latestToken}`, {
      method: 'POST',
      body: {
        content,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Failed to send Simon follow-up', error);
  }
}

async function hideSimonSequence(game) {
  if (!game) return;
  game.hideTimeout = null;
  await deleteSimonSequenceMessage(game);
  const remainingMs = Math.max(0, (game.responseDeadline || Date.now()) - Date.now());
  if (remainingMs <= 0) {
    return;
  }
  const secondsLeft = (remainingMs / 1000).toFixed(1).replace(/\.0$/, '');
  await sendSimonFollowUp(game, `🙈 Sequence hidden! You have ${secondsLeft}s left to respond with /sg.`);
}

async function sendSimonSequence(game) {
  if (!game?.appId || !game?.latestToken) {
    console.error('Cannot send Simon sequence without app ID or interaction token');
    return;
  }
  const viewDurationMs = getSimonViewDurationMs(game.level);
  const responseDurationMs = getSimonResponseDurationMs(game.level);
  const sequenceText = game.sequence.join(' ');
  const viewSeconds = (viewDurationMs / 1000).toFixed(0);
  const answerSeconds = (responseDurationMs / 1000).toFixed(1).replace(/\.0$/, '');

  try {
    const response = await DiscordRequest(`webhooks/${game.appId}/${game.latestToken}`, {
      method: 'POST',
      body: {
        content: [
          `🔢 **Simon Says — Level ${game.level}**`,
          `Sequence: \`${sequenceText}\``,
          `View time: ${viewSeconds}s · Answer time: ${answerSeconds}s`,
          'Respond with /sg when ready.',
        ].join('\n'),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
    const data = await response.json();
    if (data?.id) {
      game.sequenceMessage = { id: data.id, token: game.latestToken };
    } else {
      game.sequenceMessage = null;
    }
    clearSimonTimers(game);
    game.hideTimeout = setTimeout(() => {
      hideSimonSequence(game).catch(error => console.error('Failed to hide Simon sequence', error));
    }, viewDurationMs);
    game.responseDeadline = Date.now() + responseDurationMs;
    game.responseTimeout = setTimeout(() => {
      handleSimonTimeout(game.userId).catch(error => console.error('Simon timeout failed', error));
    }, responseDurationMs);
  } catch (error) {
    console.error('Failed to send Simon sequence', error);
  }
}

async function finalizeSimonGame(game, completedLevel) {
  const safeLevel = Math.max(0, completedLevel);
  const record = updateSimonRecord(game.userId, safeLevel, game.displayName);
  clearSimonTimers(game);
  await deleteSimonSequenceMessage(game);
  simonGames.delete(game.userId);
  return { record, completedLevel: safeLevel };
}

async function abortSimonGame(userId) {
  const existing = simonGames.get(userId);
  if (!existing) {
    return;
  }
  clearSimonTimers(existing);
  await deleteSimonSequenceMessage(existing);
  simonGames.delete(userId);
}

async function handleSimonTimeout(userId) {
  const game = simonGames.get(userId);
  if (!game) {
    return;
  }
  const { record, completedLevel } = await finalizeSimonGame(game, Math.max(game.level - 1, 0));
  const parts = [`⌛ Time's up! You reached level ${completedLevel}.`];
  if (record.isNewRecord && completedLevel > 0) {
    parts.push('🎉 New personal best!');
  } else if (record.bestLevel) {
    parts.push(`Best level: ${record.bestLevel}.`);
  }
  await sendSimonFollowUp(game, parts.join(' '));
}
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

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});// Task 3: Addition user story – documented by Shivek Tiwari
