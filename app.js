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

const app = express();
const PORT = process.env.PORT || 3000;
const activeGames = {};

// --- Discord Interactions Endpoint ---
app.post(
  '/interactions',
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    const { id, type, data } = req.body;

    // --- Handle PING ---
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    // --- Handle Slash Commands ---
    if (type === InteractionType.APPLICATION_COMMAND) {
      const { name } = data;

      // /test command
      if (name === 'test') {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `hello world ${getRandomEmoji()}` },
        });
      }

      // /challenge command
      if (name === 'challenge' && id) {
        const context = req.body.context;
        const userId =
          context === 0 ? req.body.member.user.id : req.body.user.id;
        const objectName = req.body.data.options[0].value;

        activeGames[id] = { id: userId, objectName };

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Rock Paper Scissors challenge from <@${userId}>!`,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    custom_id: `accept_button_${req.body.id}`,
                    label: 'Accept',
                    style: ButtonStyleTypes.PRIMARY,
                  },
                ],
              },
            ],
          },
        });
      }

      console.error(`Unknown command: ${name}`);
      return res.status(400).json({ error: 'Unknown command' });
    }

    // --- Handle Message Components (buttons, selects) ---
    if (type === InteractionType.MESSAGE_COMPONENT) {
      const componentId = data.custom_id;

      // When someone clicks the "Accept" button
      if (componentId.startsWith('accept_button_')) {
        const gameId = componentId.replace('accept_button_', '');
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          // Send an ephemeral select menu
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: 'What is your object of choice?',
              components: [
                {
                  type: MessageComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: MessageComponentTypes.STRING_SELECT,
                      custom_id: `select_choice_${gameId}`,
                      options: getShuffledOptions(),
                    },
                  ],
                },
              ],
            },
          });

          // Delete the old challenge message
          await DiscordRequest(endpoint, { method: 'DELETE' });
        } catch (err) {
          console.error('Error sending message:', err);
        }
        return;
      }

      // When someone selects their object
      if (componentId.startsWith('select_choice_')) {
        const gameId = componentId.replace('select_choice_', '');

        if (activeGames[gameId]) {
          const context = req.body.context;
          const userId =
            context === 0 ? req.body.member.user.id : req.body.user.id;
          const objectName = data.values[0];

          // Compute result
          const resultStr = getResult(activeGames[gameId], {
            id: userId,
            objectName,
          });

          delete activeGames[gameId];

          // Send updated message (remove menu + show result)
          return res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
              content: `You chose **${objectName}**!\n\n${resultStr}`,
              components: [], // hides the menu after choice
            },
          });
        }
      }
    }

    console.error('Unknown interaction type', type);
    return res.status(400).json({ error: 'Unknown interaction type' });
  }
);

// --- Start Server ---
app.listen(PORT, () => {
  console.log('🚀 Listening on port', PORT);
});
