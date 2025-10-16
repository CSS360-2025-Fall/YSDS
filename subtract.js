const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subtract')
    .setDescription('Subtract two numbers')
    .addNumberOption(option =>
      option
        .setName('first')
        .setDescription('The first number')
        .setRequired(true))
    .addNumberOption(option =>
      option
        .setName('second')
        .setDescription('The second number')
        .setRequired(true)),

  async execute(interaction) {
    const first = interaction.options.getNumber('first');
    const second = interaction.options.getNumber('second');
    const result = first - second;

    await interaction.reply(`The answer is ${result}!`);
  },
};
