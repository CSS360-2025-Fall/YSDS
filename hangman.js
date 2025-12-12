// hangman.js
// Stand-alone Hangman game logic (file-backed word list)

import { InteractionResponseFlags } from 'discord-interactions';
import { readFile } from 'node:fs/promises';

export const hangmanGames = new Map();

const HANGMAN_MAX_WRONG = 6;

// Word list location
// /data/hangman_words.txt
const WORDS_PATH = new URL('./data/hangman_words.txt', import.meta.url);

export const HANGMAN_STAGES = [
  "```\n\n\n\n\n=====\n```",
  "```\n |\n |\n |\n |\n=====\n```",
  "```\n +---+\n |\n |\n |\n |\n=====\n```",
  "```\n +---+\n |\n |\n O   |\n     |\n=====\n```",
  "```\n +---+\n |\n |\n O   |\n |   |\n=====\n```",
  "```\n +---+\n |\n |\n O   |\n/|\\  |\n=====\n```",
  "```\n +---+\n |\n |\n O   |\n/|\\  |\n/ \\  |\n=====\n```",
];

let WORD_CACHE = null;

async function getWordList() {
  if (WORD_CACHE) return WORD_CACHE;

  const raw = await readFile(WORDS_PATH, 'utf8');

  WORD_CACHE = raw
    .split(/\r?\n/g)
    .map(line => line.trim().toLowerCase())
    .filter(line => line && !line.startsWith('#'))
    .filter(line => /^[a-z]+$/.test(line));

  if (!WORD_CACHE.length) {
    throw new Error('hangman_words.txt has no valid words.');
  }

  return WORD_CACHE;
}

async function pickRandomWord() {
  const words = await getWordList();
  const idx = Math.floor(Math.random() * words.length);
  return words[idx];
}

function formatMaskedWord(word, guessedLetters) {
  return word
    .split('')
    .map(ch => (guessedLetters.has(ch) ? ch : '_'))
    .join(' ');
}

function formatGuessedLetters(guessedLetters) {
  if (!guessedLetters.size) return '(none)';
  return Array.from(guessedLetters).sort().join(', ');
}

function renderHangmanState(game) {
  const masked = formatMaskedWord(game.word, game.guessedLetters);
  const guessed = formatGuessedLetters(game.guessedLetters);
  const wrong = game.maxLives - game.livesLeft;
  const stage = HANGMAN_STAGES[Math.min(wrong, HANGMAN_STAGES.length - 1)];

  return (
    stage +
    '\n```text\n' +
    `Word:    ${masked}\n` +
    `Guessed: ${guessed}\n` +
    `Lives:   ${game.livesLeft}/${game.maxLives}\n` +
    '```'
  );
}

// Starts a new game for a user
export async function startHangmanGame(userId) {
  const word = await pickRandomWord();

  hangmanGames.set(userId, {
    word,
    guessedLetters: new Set(),
    livesLeft: HANGMAN_MAX_WRONG,
    maxLives: HANGMAN_MAX_WRONG,
  });

  return {
    flags: InteractionResponseFlags.EPHEMERAL,
    content:
      '🎮 New Hangman game started!\n' +
      renderHangmanState(hangmanGames.get(userId)) +
      '\nGuess a letter or the whole word with `/hangguess guess:<...>`.',
  };
}

// Handles guesses (letter or full word)
// Slash command option: name="guess", type=STRING, required=true
export function handleHangmanGuess(data, userId) {
  const game = hangmanGames.get(userId);

  if (!game) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: "❌ You don't have an active Hangman game. Start one with `/hangman`.",
    };
  }

  const guessOption = data.options?.find(o => o.name === 'guess');
  const raw = String(guessOption?.value || '').toLowerCase().trim();

  if (!raw) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: '❌ Please provide a guess.',
    };
  }

  if (/^[a-z]{2,}$/.test(raw)) {
    if (raw === game.word) {
      hangmanGames.delete(userId);
      return {
        flags: InteractionResponseFlags.EPHEMERAL,
        content:
          '🎉 You guessed the word!\n```text\n' +
          `Word:   ${game.word}\n` +
          '```',
      };
    }

    game.livesLeft--;

    if (game.livesLeft <= 0) {
      hangmanGames.delete(userId);
      return {
        flags: InteractionResponseFlags.EPHEMERAL,
        content: '💀 No lives left. Game over!\n' + `The word was: **${game.word}**`,
      };
    }

    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: `❌ Nope, **${raw}** is not the word.\n` + renderHangmanState(game),
    };
  }

  if (!/^[a-z]$/.test(raw)) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: '❌ Guess must be a single letter or a full word.',
    };
  }

  const letter = raw;

  if (game.guessedLetters.has(letter)) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: `⚠️ You already guessed **${letter}**.\n` + renderHangmanState(game),
    };
  }

  game.guessedLetters.add(letter);

  if (game.word.includes(letter)) {
    const won = game.word
      .split('')
      .every(ch => game.guessedLetters.has(ch));

    if (won) {
      hangmanGames.delete(userId);
      return {
        flags: InteractionResponseFlags.EPHEMERAL,
        content:
          '🎉 You guessed the word!\n```text\n' +
          `Word:   ${game.word}\n` +
          '```',
      };
    }

    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: `✅ Good guess! **${letter}** is in the word.\n` + renderHangmanState(game),
    };
  }

  game.livesLeft--;

  if (game.livesLeft <= 0) {
    hangmanGames.delete(userId);
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: '💀 No lives left. Game over!\n' + `The word was: **${game.word}**`,
    };
  }

  return {
    flags: InteractionResponseFlags.EPHEMERAL,
    content: `❌ Nope, **${letter}** is not in the word.\n` + renderHangmanState(game),
  };
}
