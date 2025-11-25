// app.js
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

import { getRandomEmoji } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

// 🔹 Single-player blackjack imports
import { startBlackjack, handleBlackjackAction } from './blackjack.js';

// 🔹 Multiplayer blackjack imports
import {
  startBlackjackMulti,
  handleBlackjackMultiAction
} from './blackjack-multi.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Store active games
const blackjackGames = {};          // single-player games
const blackjackMultiTables = {};    // multiplayer tables

// Math command handlers...
// (THIS PART UNCHANGED — NOT TOUCHING ANYTHING)
function handleDivCommand(data) {
  const a = Number(data.options?.[0]?.value || 0);
  const b = Number(data.options?.[1]?.value || 1);
  if (b === 0) return { content: "❌ Cannot divide by zero!" };
  return { content: `Result: **${a} ÷ ${b} = ${a / b}**` };
}

function handleMultiCommand(data) {
  const a = Number(data.options?.[0]?.value || 0);
  const b = Number(data.options?.[1]?.value || 1);
  return { content: `Result: **${a} × ${b} = ${a * b}**` };
}

function handleAddCommand(data) {
  const a = Number(data.options?.[0]?.value || 0);
  const b = Number(data.options?.[1]?.value || 1);
  return { content: `Result: **${a} + ${b} = ${a + b}**` };
}

function handleSubCommand(data) {
  const a = Number(data.options?.[0]?.value || 0);
  const b = Number(data.options?.[1]?.value || 1);
  return { content: `Result: **${a} - ${b} = ${a - b}**` };
}

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
  const { id, type, data } = req.body;

  // PING
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Slash Commands
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    const userId = req.body.member?.user?.id || req.body.user?.id;

    // /test
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`,
            }
          ]
        }
      });
    }

    // Math commands...
    if (name === 'div') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleDivCommand(data),
      });
    }
    if (name === 'multi') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleMultiCommand(data),
      });
    }
    if (name === 'add') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleAddCommand(data),
      });
    }
    if (name === 'sub') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: handleSubCommand(data),
      });
    }

    // 🎰 SINGLE-PLAYER BLACKJACK — FIXED
    if (name === 'blackjack') {
      const gameId = userId;  // ONE GAME PER USER
      const result = startBlackjack(blackjackGames, gameId, userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    // 🃏 MULTIPLAYER BLACKJACK (UNCHANGED)
    if (name === 'blackjack_multi') {
      const tableId = req.body.id;
      const result = startBlackjackMulti(blackjackMultiTables, tableId, userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: result,
      });
    }

    return res.status(400).json({ error: "unknown command" });
  }

  // BUTTON COMPONENTS
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const userId = req.body.member?.user?.id || req.body.user?.id;
    const customId = data.custom_id;

    // 🎰 SINGLE-PLAYER BLACKJACK — FIXED
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

    // 🃏 MULTIPLAYER BLACKJACK (UNCHANGED)
    if (customId.startsWith("bjm_")) {
      const [prefix, tableId] = customId.split(":");
      const action = prefix.replace("bjm_", "");

      const result = handleBlackjackMultiAction(
        blackjackMultiTables,
        tableId,
        userId,
        action
      );

      if (result.ephemeral) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: result.content,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: result.content,
          components: result.components,
        },
      });
    }

    return res.status(400).json({ error: "unknown component" });
  }

  return res.status(400).json({ error: "unknown interaction type" });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
