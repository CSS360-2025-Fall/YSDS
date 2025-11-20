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

// ⭐ NEW: Import Blackjack functions
import { startBlackjack, handleBlackjackAction } from './blackjack.js';

// ⭐ NEW: Store blackjack games per user
const blackjackGames = {};

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// --- Your math functions (unchanged) ---
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
 * Discord interactions endpoint
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data } = req.body;

  /* ------------------------
     PING (Discord handshake)
     ------------------------ */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /* ------------------------
     Slash Commands
     ------------------------ */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const name = data.name;
    const userId = req.body.member?.user?.id || req.body.user?.id;

    // test
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`,
            },
          ],
        },
      });
    }

    // div
    if (name === 'div') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleDivCommand(data),
      });
    }

    // multi
    if (name === 'multi') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleMultiCommand(data),
      });
    }

    // add
    if (name === 'add') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleAddCommand(data),
      });
    }

    // sub
    if (name === 'sub') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleSubCommand(data),
      });
    }

    /* ------------------------
       ⭐ NEW: Blackjack slash command
       ------------------------ */
    if (name === 'blackjack') {
      const response = startBlackjack(userId, blackjackGames);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: response,
      });
    }

    console.error("unknown command:", name);
    return res.status(400).json({ error: 'unknown command' });
  }

  /* ------------------------
     ⭐ NEW: Blackjack Button Interactions
     ------------------------ */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const customId = data.custom_id;
    const userId = req.body.member?.user?.id || req.body.user?.id;

    if (customId.startsWith("blackjack_")) {
      const action = customId.replace("blackjack_", "");
      const response = handleBlackjackAction(userId, action, blackjackGames);

      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: response,
      });
    }

    console.error("unknown component:", customId);
    return res.status(400).json({ error: 'unknown component' });
  }

  return res.status(400).json({ error: 'unknown interaction type' });
});

/* ------------------------
   Server Start
   ------------------------ */
app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
