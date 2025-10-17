// commands/divCommand.js
export const DIV_COMMAND = {
  name: 'div',
  description: 'Divide two numbers: /div num1 num2',
  options: [
    { type: 10, name: 'num1', description: 'First number', required: true },
    { type: 10, name: 'num2', description: 'Second number', required: true },
  ],
  type: 1, // CHAT_INPUT
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

export function handleDivCommand(interactionOrData) {
  // Accept either full interaction object or just its data
  const d = interactionOrData?.data ?? interactionOrData ?? {};
  const opts = d.options ?? [];

  const num1 = Number(opts.find(o => o.name === 'num1')?.value);
  const num2 = Number(opts.find(o => o.name === 'num2')?.value);

  if (!Number.isFinite(num1) || !Number.isFinite(num2)) {
    return { content: '❌ Please provide valid numbers: /div num1 num2' };
  }

  if (num2 === 0) {
    return { content: '🚫 You can’t divide by zero!' };
  }

  const result = Math.round((num1 / num2) * 1000) / 1000; // round to 3 decimals
  return { content: `✅ ${num1} ÷ ${num2} = ${result}` };
}
