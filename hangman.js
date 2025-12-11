// hangman.js
// Stand-alone module for Hangman game logic
import { InteractionResponseFlags } from 'discord-interactions';

export const hangmanGames = new Map();

const HANGMAN_MAX_WRONG = 6;

const HANGMAN_WORDS = [
  'discord',
  'bot',
  'javascript',
  'uwbothell',
  'software',
  'hangman',
  'college',
  'computer',
  'coding',
  'quality',
  'algorithm',
  'binary',
  'pointer',
  'compiler',
  'runtime',
  'recursion',
  'hashing',
  'dataset',
  'variable',
  'function',
  'boolean',
  'array',
  'linkedlist',
  'database',
  'network',
  'latency',
  'server',
  'client',
  'protocol',
  'command',
  'syntax',
  'debug',
  'vscode',
  'project',
  'midterm',
  'lecture',
  'robotics',
  'kernel',
  'sandbox',
  'pipeline'
];

export const HANGMAN_STAGES = [
  "```\n\n\n\n\n=====\n```",
  "```\n |\n |\n |\n |\n=====\n```",
  "```\n +---+\n |\n |\n |\n |\n=====\n```",
  "```\n +---+\n |   |\n O   |\n     |\n     |\n=====\n```",
  "```\n +---+\n |   |\n O   |\n |   |\n     |\n=====\n```",
  "```\n +---+\n |   |\n O   |\n/|\\  |\n     |\n=====\n```",
  "```\n +---+\n |   |\n O   |\n/|\\  |\n/ \\  |\n=====\n```",
];

function pickRandomWord() {
  const idx = Math.floor(Math.random() * HANGMAN_WORDS.length);
  return HANGMAN_WORDS[idx].toLowerCase();
}

function formatMaskedWord(word, guessedLetters) {
  const letters = word.split('').map(ch => {
    if (!/[a-z]/.test(ch)) return ch; // non-letters as-is
    return guessedLetters.has(ch) ? ch : '_';
  });
  return letters.join(' ');
}

function formatGuessedLetters(guessedLetters) {
  if (!guessedLetters.size) return '(none)';
  return Array.from(guessedLetters).sort().join(', ');
}

function renderHangmanState(game) {
  const masked = formatMaskedWord(game.word, game.guessedLetters);
  const guessed = formatGuessedLetters(game.guessedLetters);
  return (
    '```text\n' +
    `Word:   ${masked}\n` +
    `Guessed: ${guessed}\n` +
    `Lives:  ${game.livesLeft}/${game.maxLives}\n` +
    '```'
  );
}

export function startHangmanGame(userId) {
  const word = pickRandomWord();
  const game = {
    word,
    guessedLetters: new Set(),
    livesLeft: 6,
    maxLives: 6,
  };
  hangmanGames.set(userId, game);

  return {
    flags: InteractionResponseFlags.EPHEMERAL,
    content:
      '🎮 New Hangman game started!\n' +
      renderHangmanState(game) +
      '\nGuess a letter with `/hangguess letter:<a-z>`.',
  };
}

export function handleHangmanGuess(data, userId) {
  const game = hangmanGames.get(userId);
  if (!game) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        "❌ You don't have an active Hangman game. Start one with `/hangman`.",
    };
  }

  const letterOption = data.options?.find(o => o.name === 'letter');
  let raw = String(letterOption?.value || '').toLowerCase().trim();

  if (!raw || !/[a-z]/.test(raw[0])) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: '❌ Please provide a single letter (a–z).',
    };
  }

  const letter = raw[0];

  if (game.guessedLetters.has(letter)) {
    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        `⚠️ You already guessed **${letter}**.\n` +
        renderHangmanState(game),
    };
  }

  game.guessedLetters.add(letter);

  if (game.word.includes(letter)) {
    // Check win: all letters in the word have been guessed
    const allGuessed = game.word
      .split('')
      .filter(ch => /[a-z]/.test(ch))
      .every(ch => game.guessedLetters.has(ch));

    if (allGuessed) {
      const masked = formatMaskedWord(game.word, game.guessedLetters);
      hangmanGames.delete(userId);
      return {
        flags: InteractionResponseFlags.EPHEMERAL,
        content:
          '🎉 You guessed the word!\n' +
          '```text\n' +
          `Word:   ${masked}\n` +
          '```',
      };
    }

    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        `✅ Good guess! **${letter}** is in the word.\n` +
        renderHangmanState(game),
    };
  } else {
    game.livesLeft -= 1;

    if (game.livesLeft <= 0) {
      const answer = game.word;
      hangmanGames.delete(userId);
      return {
        flags: InteractionResponseFlags.EPHEMERAL,
        content:
          '💀 No lives left. Game over!\n' +
          `The word was: **${answer}**`,
      };
    }

    return {
      flags: InteractionResponseFlags.EPHEMERAL,
      content:
        `❌ Nope, **${letter}** is not in the word.\n` +
        renderHangmanState(game),
    };
  }
}