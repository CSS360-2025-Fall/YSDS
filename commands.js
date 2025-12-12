import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}
const DIV_COMMAND = {
  name: 'div',
  description: 'Divide two numbers (a ÷ b)',
  options: [
    {
      type: 10, // NUMBER
      name: 'a',
      description: 'Enter the first number (dividend)',
      required: true,
    },
    {
      type: 10, // NUMBER
      name: 'b',
      description: 'Enter the second number (divisor)',
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT command
  integration_types: [0, 1],
  contexts: [0, 2],
};

const MULTI_COMMAND = {
  name: 'multi',
  description: 'Multiply two numbers (a * b)',
  options: [
    {
      type: 10, // NUMBER
      name: 'a',
      description: 'Enter the first number (Multiplicand)',
      required: true,
    },
    {
      type: 10, // NUMBER
      name: 'b',
      description: 'Enter the second number (Multiplier)',
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT command
  integration_types: [0, 1],
  contexts: [0, 2],
};
const ADD_COMMAND = {
  name: 'add',
  description: 'Add two numbers (a * b)',
  options: [
    {
      type: 10, // NUMBER
      name: 'a',
      description: 'Enter the first number (Addend)',
      required: true,
    },
    {
      type: 10, // NUMBER
      name: 'b',
      description: 'Enter the second number (Addend)',
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT command
  integration_types: [0, 1],
  contexts: [0, 2],
};
const SUB_COMMAND = {
  name: 'sub',
  description: 'Subtract two numbers (a * b)',
  options: [
    {
      type: 10, // NUMBER
      name: 'a',
      description: 'Enter the first number (Subtrahend)',
      required: true,
    },
    {
      type: 10, // NUMBER
      name: 'b',
      description: 'Enter the second number (Minuend)',
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT command
  integration_types: [0, 1],
  contexts: [0, 2],
};
// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};
const GUESSGAME_COMMAND = {
  name: 'guessgame',
  description: 'Start a new Hotter/Colder guessing game',
  type: 1, // CHAT_INPUT
  integration_types: [0, 1],
  contexts: [0, 2],
};

const GUESS_COMMAND = {
  name: 'guess',
  description: 'Make a guess in your active Hotter/Colder game',
  options: [
    { type: 10, name: 'number', description: 'Your guess (1-100)', required: true },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const REMIND_COMMAND = {
  name: 'remindme',
  description: 'Ask the bot to remind you after a duration',
  options: [
    {
      type: 3, // STRING
      name: 'duration',
      description: 'When should I remind you? (e.g., 10m, 2h, 45 seconds)',
      required: true,
    },
    {
      type: 3, // STRING
      name: 'message',
      description: 'What should I remind you about?',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Joke command
const JOKE_COMMAND = {
  name: 'joke',
  description: 'Tell a random joke',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const TICTACTOE_COMMAND = {
  name: 'tictactoe',
  description: 'Play tic tac toe against the bot',
  options: [
    {
      type: 4, // INTEGER
      name: 'position',
      description: 'Pick a position 1-9',
      required: true,
    },

  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};


// Quote command
const QUOTE_COMMAND = {
  name: 'quote',
  description: 'Send a random inspirational or funny quote',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const HANGMAN_COMMAND = {
  name: 'hangman',
  description: 'Start a new text-based Hangman game',
  type: 1, // CHAT_INPUT
  integration_types: [0, 1],
  contexts: [0, 2],
};

const HANGGUESS_COMMAND = {
  name: 'hangguess',
  description: 'Guess a letter in your active Hangman game',
  options: [
    {
      type: 3, // STRING
      name: 'letter',
      description: 'Your letter guess (a-z)',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const MATH_COMMAND = {
  name: 'math',
  description: 'Perform a math operation',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
  options: [
    {
      type: 3, // STRING
      name: 'operation',
      description: 'Choose the operation',
      required: true,
      choices: [
        { name: 'Add', value: 'add' },
        { name: 'Subtract', value: 'sub' },
        { name: 'Multiply', value: 'multi' },
        { name: 'Divide', value: 'div' }
      ]
    },
    {
      type: 10, // NUMBER (can use decimals)
      name: 'num1',
      description: 'First number',
      required: true,
    },
    {
      type: 10, // NUMBER
      name: 'num2',
      description: 'Second number',
      required: true,
    }
  ],
};

// 🎰 Single player blackjack
const BLACKJACK_COMMAND = {
  name: 'blackjack',
  description: 'Play single-player blackjack!',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// 🃏 Multiplayer blackjack
const BLACKJACK_MULTI_COMMAND = {
  name: 'blackjack_multi',
  description: 'Play multiplayer blackjack (table lobby).',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// 💰 Multiplayer Blackjack betting (v2.1)
const BET_COMMAND = {
  name: 'bet',
  description: 'Place a bet for multiplayer blackjack',
  options: [
    {
      type: 4, // INTEGER
      name: 'amount',
      description: 'Bet amount (10–500)',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const SIMON_COMMAND = {
  name: 'simon',
  description: 'Start a Simon Says memory challenge',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const SIMON_GUESS_COMMAND = {
  name: 'sg',
  description: 'Submit your guess for the Simon Says sequence',
  options: [
    {
      type: 3, // STRING
      name: 'sequence',
      description: 'Enter the memorized numbers (e.g., 3 5 7 or 357)',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const SIMON_LEADERBOARD_COMMAND = {
  name: 'slb',
  description: 'View the Simon Says leaderboard',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const HELP_COMMAND = {
  name: 'help',
  description: 'Show available commands or details for one command',
  options: [
    {
      type: 3, // STRING
      name: 'command',
      description: 'Optional command name for detailed help',
      required: false,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};



// Add it to the list of commands you register

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, DIV_COMMAND, MULTI_COMMAND, ADD_COMMAND, SUB_COMMAND, GUESSGAME_COMMAND, GUESS_COMMAND, JOKE_COMMAND, QUOTE_COMMAND, TICTACTOE_COMMAND, REMIND_COMMAND, MATH_COMMAND, HANGMAN_COMMAND, HANGGUESS_COMMAND, BLACKJACK_COMMAND, BLACKJACK_MULTI_COMMAND, BET_COMMAND, SIMON_COMMAND, SIMON_GUESS_COMMAND, SIMON_LEADERBOARD_COMMAND, HELP_COMMAND];

// Add it at the bottom of commands.js
// ===== GLOBAL COMMAND INSTALL =====
import 'dotenv/config';

(async () => {
  const { DISCORD_TOKEN, APP_ID } = process.env;

  console.log('[register] starting global registration…');
  console.log('[register] APP_ID =', APP_ID);
  console.log('[register] commands =', ALL_COMMANDS.map(c => c.name));

  if (!DISCORD_TOKEN || !APP_ID) {
    console.error('❌ Missing DISCORD_TOKEN or APP_ID in .env');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ALL_COMMANDS)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Discord API error:', res.status, err);
    process.exit(1);
  }

  const data = await res.json();
  console.log('✅ Installed GLOBAL commands:', data.map(c => c.name));
  process.exit(0);
})().catch(e => {
  console.error('❌ Install failed:', e);
  process.exit(1);
});
