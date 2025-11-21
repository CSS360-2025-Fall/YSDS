// commands.js
import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize } from './utils.js';

// Create choices for /challenge command
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

// ➕ Math Commands
const DIV_COMMAND = {
  name: 'div',
  description: 'Divide two numbers (a ÷ b)',
  options: [
    { type: 10, name: 'a', description: 'Dividend', required: true },
    { type: 10, name: 'b', description: 'Divisor', required: true },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const MULTI_COMMAND = {
  name: 'multi',
  description: 'Multiply two numbers (a * b)',
  options: [
    { type: 10, name: 'a', description: 'Multiplicand', required: true },
    { type: 10, name: 'b', description: 'Multiplier', required: true },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const ADD_COMMAND = {
  name: 'add',
  description: 'Add two numbers (a + b)',
  options: [
    { type: 10, name: 'a', description: 'Addend A', required: true },
    { type: 10, name: 'b', description: 'Addend B', required: true },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const SUB_COMMAND = {
  name: 'sub',
  description: 'Subtract two numbers (a - b)',
  options: [
    { type: 10, name: 'a', description: 'Value A', required: true },
    { type: 10, name: 'b', description: 'Value B', required: true },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Returns a test emoji.',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// RPS challenge
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge someone to Rock-Paper-Scissors.',
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

// ALL COMMANDS INSTALLED GLOBALLY
const ALL_COMMANDS = [
  TEST_COMMAND,
  CHALLENGE_COMMAND,
  DIV_COMMAND,
  MULTI_COMMAND,
  ADD_COMMAND,
  SUB_COMMAND,
  BLACKJACK_COMMAND,
  BLACKJACK_MULTI_COMMAND,
];

// ===== INSTALL GLOBAL COMMANDS =====
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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ALL_COMMANDS),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Discord API error:', res.status, err);
    process.exit(1);
  }

  const data = await res.json();
  console.log('✅ Installed GLOBAL commands:', data.map(c => c.name));
  process.exit(0);
})();
