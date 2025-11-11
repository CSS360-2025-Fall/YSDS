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

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});// Task 3: Addition user story – documented by Shivek Tiwari
