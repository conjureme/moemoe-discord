// this one is a little primitive
// may make something a little more interactive
// something far more visual...
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

interface RouletteNumber {
  number: number;
  color: 'red' | 'black' | 'green';
}

class RouletteWheel {
  private numbers: RouletteNumber[] = [
    { number: 0, color: 'green' },
    { number: 1, color: 'red' },
    { number: 2, color: 'black' },
    { number: 3, color: 'red' },
    { number: 4, color: 'black' },
    { number: 5, color: 'red' },
    { number: 6, color: 'black' },
    { number: 7, color: 'red' },
    { number: 8, color: 'black' },
    { number: 9, color: 'red' },
    { number: 10, color: 'black' },
    { number: 11, color: 'black' },
    { number: 12, color: 'red' },
    { number: 13, color: 'black' },
    { number: 14, color: 'red' },
    { number: 15, color: 'black' },
    { number: 16, color: 'red' },
    { number: 17, color: 'black' },
    { number: 18, color: 'red' },
    { number: 19, color: 'red' },
    { number: 20, color: 'black' },
    { number: 21, color: 'red' },
    { number: 22, color: 'black' },
    { number: 23, color: 'red' },
    { number: 24, color: 'black' },
    { number: 25, color: 'red' },
    { number: 26, color: 'black' },
    { number: 27, color: 'red' },
    { number: 28, color: 'black' },
    { number: 29, color: 'black' },
    { number: 30, color: 'red' },
    { number: 31, color: 'black' },
    { number: 32, color: 'red' },
    { number: 33, color: 'black' },
    { number: 34, color: 'red' },
    { number: 35, color: 'black' },
    { number: 36, color: 'red' },
  ];

  spin(): RouletteNumber {
    const index = Math.floor(Math.random() * this.numbers.length);
    return this.numbers[index];
  }

  calculatePayout(
    betType: string,
    specificNumber: number | null,
    result: RouletteNumber,
    betAmount: number
  ): number {
    switch (betType) {
      case 'red':
        return result.color === 'red' ? betAmount * 2 : 0;
      case 'black':
        return result.color === 'black' ? betAmount * 2 : 0;
      case 'green':
        return result.color === 'green' ? betAmount * 36 : 0;
      case 'odd':
        return result.number !== 0 && result.number % 2 === 1
          ? betAmount * 2
          : 0;
      case 'even':
        return result.number !== 0 && result.number % 2 === 0
          ? betAmount * 2
          : 0;
      case 'low':
        return result.number >= 1 && result.number <= 18 ? betAmount * 2 : 0;
      case 'high':
        return result.number >= 19 && result.number <= 36 ? betAmount * 2 : 0;
      case 'first12':
        return result.number >= 1 && result.number <= 12 ? betAmount * 3 : 0;
      case 'second12':
        return result.number >= 13 && result.number <= 24 ? betAmount * 3 : 0;
      case 'third12':
        return result.number >= 25 && result.number <= 36 ? betAmount * 3 : 0;
      case 'column1':
        return result.number % 3 === 1 && result.number !== 0
          ? betAmount * 3
          : 0;
      case 'column2':
        return result.number % 3 === 2 && result.number !== 0
          ? betAmount * 3
          : 0;
      case 'column3':
        return result.number % 3 === 0 && result.number !== 0
          ? betAmount * 3
          : 0;
      case 'number':
        return result.number === specificNumber ? betAmount * 36 : 0;
      default:
        return 0;
    }
  }

  getColorEmoji(color: string): string {
    switch (color) {
      case 'red':
        return '🔴';
      case 'black':
        return '⚫';
      case 'green':
        return '🟢';
      default:
        return '';
    }
  }

  getBetTypeDescription(
    betType: string,
    specificNumber?: number | null
  ): string {
    switch (betType) {
      case 'red':
        return 'red';
      case 'black':
        return 'black';
      case 'green':
        return 'green (0)';
      case 'odd':
        return 'odd';
      case 'even':
        return 'even';
      case 'low':
        return 'low (1-18)';
      case 'high':
        return 'high (19-36)';
      case 'first12':
        return '1st dozen (1-12)';
      case 'second12':
        return '2nd dozen (13-24)';
      case 'third12':
        return '3rd dozen (25-36)';
      case 'column1':
        return '1st column (1,4,7...)';
      case 'column2':
        return '2nd column (2,5,8...)';
      case 'column3':
        return '3rd column (3,6,9...)';
      case 'number':
        return `number ${specificNumber}`;
      default:
        return betType;
    }
  }
}

const roulette: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('place a bet on the roulette wheel')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('type of bet to place')
        .setRequired(true)
        .addChoices(
          { name: 'red', value: 'red' },
          { name: 'black', value: 'black' },
          { name: 'green (0)', value: 'green' },
          { name: 'odd', value: 'odd' },
          { name: 'even', value: 'even' },
          { name: 'low (1-18)', value: 'low' },
          { name: 'high (19-36)', value: 'high' },
          { name: '1st dozen (1-12)', value: 'first12' },
          { name: '2nd dozen (13-24)', value: 'second12' },
          { name: '3rd dozen (25-36)', value: 'third12' },
          { name: '1st column (1,4,7...)', value: 'column1' },
          { name: '2nd column (2,5,8...)', value: 'column2' },
          { name: '3rd column (3,6,9...)', value: 'column3' },
          { name: 'single number', value: 'number' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription(
          'specific number (0-36, required for single number bets)'
        )
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const bet = interaction.options.getInteger('bet', true);
      const betType = interaction.options.getString('type', true);
      const specificNumber = interaction.options.getInteger('number');
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const userId = interaction.user.id;

      if (!guildId || !guildName) {
        await interaction.reply({
          content: 'this command can only be used in a server!',
          flags: ['Ephemeral'],
        });
        return;
      }

      // validate single number bet
      if (betType === 'number' && specificNumber === null) {
        await interaction.reply({
          content: 'you must specify a number when betting on a single number!',
          flags: ['Ephemeral'],
        });
        return;
      }

      const economyService = serviceManager.getEconomyService();
      const userBalance = await economyService.getBalance(
        guildId,
        guildName,
        userId
      );

      const guildEconomy = economyService.getGuildEconomy(guildId);
      const currency = guildEconomy?.currency || {
        emoji: '🧀',
        name: 'curds',
      };

      if (userBalance.balance < bet) {
        await interaction.reply({
          content: `you don't have enough ${currency.name}! you only have ${currency.emoji} **${userBalance.balance.toLocaleString()}** but need ${currency.emoji} **${bet.toLocaleString()}**`,
          flags: ['Ephemeral'],
        });
        return;
      }

      // deduct bet
      await economyService.addBalance(
        guildId,
        guildName,
        userId,
        -bet,
        'roulette bet'
      );

      const wheel = new RouletteWheel();
      const betDescription = wheel.getBetTypeDescription(
        betType,
        specificNumber
      );

      // create initial embed
      const spinEmbed = new EmbedBuilder()
        .setColor(0xdc143c)
        .setTitle('✦ roulette time !')
        .setDescription(
          `betting ${currency.emoji} **${bet.toLocaleString()}** on **${betDescription}**\n\n*spinning the wheel...*`
        )
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [spinEmbed] });

      // animate the spin
      const animations = ['⚪', '🔴', '⚫', '🔴', '⚫', '🔴'];
      for (let i = 0; i < animations.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 400));

        spinEmbed.setDescription(
          `betting ${currency.emoji} **${bet.toLocaleString()}** on **${betDescription}**\n\nspinning... ${animations[i]}`
        );

        await interaction.editReply({ embeds: [spinEmbed] });
      }

      // spin the wheel
      const result = wheel.spin();
      const colorEmoji = wheel.getColorEmoji(result.color);

      // calculate payout
      const payout = wheel.calculatePayout(
        betType,
        specificNumber,
        result,
        bet
      );
      const netResult = payout - bet;

      // create result description
      let resultDescription = `the ball landed on ${colorEmoji} **${result.number}** (${result.color})\n\n`;

      if (payout > 0) {
        await economyService.addBalance(
          guildId,
          guildName,
          userId,
          payout,
          'roulette win'
        );

        const newBalance = await economyService.getBalance(
          guildId,
          guildName,
          userId
        );

        resultDescription += `⸝⸝ **you won!**\n\n`;
        resultDescription += `profit: ${currency.emoji} **${netResult.toLocaleString()} ${currency.name}**\n`;
        resultDescription += `new balance: ${currency.emoji} **${newBalance.balance.toLocaleString()} ${currency.name}**`;

        spinEmbed.setColor(0xd4e6d4);
      } else {
        const newBalance = await economyService.getBalance(
          guildId,
          guildName,
          userId
        );

        resultDescription += `⸝⸝ **you lost!**\n\n`;
        resultDescription += `lost: ${currency.emoji} **${bet.toLocaleString()} ${currency.name}**\n`;
        resultDescription += `new balance: ${currency.emoji} **${newBalance.balance.toLocaleString()} ${currency.name}**`;

        spinEmbed.setColor(0xf87171);
      }

      spinEmbed.setDescription(resultDescription);
      await interaction.editReply({ embeds: [spinEmbed] });

      logger.info(
        `${interaction.user.username} played roulette: bet ${bet} on ${betDescription}, result: ${result.number} ${result.color}, payout: ${payout} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in roulette command:', error);

      const errorMessage = {
        content: 'an error occurred while spinning the roulette wheel!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default roulette;
