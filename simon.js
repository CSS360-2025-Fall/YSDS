// simon.js
// Extracted module based on the exact code provided by user.

import { InteractionResponseFlags } from 'discord-interactions';
import { DiscordRequest } from './utils.js';

export const MIN_REMINDER_MS = 10 * 1000;
export const MAX_REMINDER_MS = 24 * 60 * 60 * 1000;
export const SIMON_VIEW_BASE_MS = 5 * 1000;
export const SIMON_VIEW_INCREMENT_MS = 1000;
export const SIMON_RESPONSE_BASE_MS = 10 * 1000;
export const SIMON_RESPONSE_INCREMENT_MS = 1500;

export const simonGames = new Map();
export const simonRecords = new Map();

export function getSimonDisplayName(body) {
  return (
    body?.member?.nick ||
    body?.member?.user?.global_name ||
    body?.member?.user?.username ||
    body?.user?.global_name ||
    body?.user?.username ||
    'Player'
  );
}

export function getSimonViewDurationMs(level) {
  return SIMON_VIEW_BASE_MS + Math.max(0, level - 1) * SIMON_VIEW_INCREMENT_MS;
}

export function getSimonResponseDurationMs(level) {
  return SIMON_RESPONSE_BASE_MS + Math.max(0, level - 1) * SIMON_RESPONSE_INCREMENT_MS;
}

export function generateSimonSequence(level) {
  const length = Math.max(2, level + 1);
  return Array.from({ length }, () => Math.floor(Math.random() * 10));
}

export function normalizeSimonGuess(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const compact = rawInput.replace(/\s+/g, '');
  if (!/^[0-9]+$/.test(compact)) return null;
  return compact;
}

export function updateSimonRecord(userId, completedLevel, displayName) {
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

export function clearSimonTimers(game) {
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

export async function deleteSimonSequenceMessage(game) {
  if (!game?.sequenceMessage || !game?.appId) return;
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

export async function sendSimonFollowUp(game, content) {
  if (!game?.appId || !game?.latestToken || !content) return;
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

export async function hideSimonSequence(game) {
  if (!game) return;
  game.hideTimeout = null;
  await deleteSimonSequenceMessage(game);

  const remainingMs = Math.max(0, (game.responseDeadline || Date.now()) - Date.now());
  if (remainingMs <= 0) return;

  const secondsLeft = (remainingMs / 1000).toFixed(1).replace(/\.0$/, '');
  await sendSimonFollowUp(game, `🙈 Sequence hidden! You have ${secondsLeft}s left to respond with /sg.`);
}

export async function sendSimonSequence(game) {
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
      hideSimonSequence(game).catch(err => console.error('Failed to hide Simon sequence', err));
    }, viewDurationMs);

    game.responseDeadline = Date.now() + responseDurationMs;

    game.responseTimeout = setTimeout(() => {
      handleSimonTimeout(game.userId).catch(err => console.error('Simon timeout failed', err));
    }, responseDurationMs);
  } catch (error) {
    console.error('Failed to send Simon sequence', error);
  }
}

export async function finalizeSimonGame(game, completedLevel) {
  const safeLevel = Math.max(0, completedLevel);
  const record = updateSimonRecord(game.userId, safeLevel, game.displayName);

  clearSimonTimers(game);
  await deleteSimonSequenceMessage(game);
  simonGames.delete(game.userId);

  return { record, completedLevel: safeLevel };
}

export async function abortSimonGame(userId) {
  const existing = simonGames.get(userId);
  if (!existing) return;

  clearSimonTimers(existing);
  await deleteSimonSequenceMessage(existing);
  simonGames.delete(userId);
}

export async function handleSimonTimeout(userId) {
  const game = simonGames.get(userId);
  if (!game) return;

  const { record, completedLevel } = await finalizeSimonGame(game, Math.max(game.level - 1, 0));

  const parts = [`⌛ Time's up! You reached level ${completedLevel}.`];
  if (record.isNewRecord && completedLevel > 0) {
    parts.push('🎉 New personal best!');
  } else if (record.bestLevel) {
    parts.push(`Best level: ${record.bestLevel}.`);
  }

  await sendSimonFollowUp(game, parts.join(' '));
}
