import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

interface Card {
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
  value: number;
  color: 'red' | 'black';
}

interface RideTheBusGame {
  userId: string;
  guildId: string;
  bet: number;
  cards: Card[];
  deck: Card[];
  currentStage: 1 | 2 | 3 | 4 | 'finished';
  choices: string[];
  result?: 'win' | 'lose' | 'cashout';
  currentMultiplier?: number;
}

class RideTheBusManager {
  private games: Map<string, RideTheBusGame> = new Map();

  private getGameKey(userId: string, guildId: string): string {
    return `${guildId}:${userId}`;
  }

  private createDeck(): Card[] {
    const suits: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
    const ranks = [
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      'J',
      'Q',
      'K',
      'A',
    ];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (let i = 0; i < ranks.length; i++) {
        const rank = ranks[i];
        const value = i + 2;
        const color = suit === '♥' || suit === '♦' ? 'red' : 'black';
        deck.push({ suit, rank, value, color });
      }
    }

    return deck;
  }

  createGame(userId: string, guildId: string, bet: number): RideTheBusGame {
    const deck = this.createDeck();
    // shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const game: RideTheBusGame = {
      userId,
      guildId,
      bet,
      cards: [],
      deck,
      currentStage: 1,
      choices: [],
    };

    const key = this.getGameKey(userId, guildId);
    this.games.set(key, game);

    return game;
  }

  getGame(userId: string, guildId: string): RideTheBusGame | undefined {
    const key = this.getGameKey(userId, guildId);
    return this.games.get(key);
  }

  deleteGame(userId: string, guildId: string): void {
    const key = this.getGameKey(userId, guildId);
    this.games.delete(key);
  }

  drawCard(game: RideTheBusGame): Card {
    if (game.deck.length === 0) {
      throw new Error('no cards left in deck');
    }
    return game.deck.pop()!;
  }

  processChoice(game: RideTheBusGame, choice: string): boolean {
    const card = this.drawCard(game);
    game.cards.push(card);
    game.choices.push(choice);

    let correct = false;

    switch (game.currentStage) {
      case 1:
        correct = choice === card.color;
        break;

      case 2:
        const firstCard = game.cards[0];
        if (choice === 'higher') {
          correct = card.value >= firstCard.value;
        } else {
          correct = card.value <= firstCard.value;
        }
        break;

      case 3:
        const low = Math.min(game.cards[0].value, game.cards[1].value);
        const high = Math.max(game.cards[0].value, game.cards[1].value);
        if (choice === 'between') {
          correct = card.value > low && card.value < high;
        } else {
          correct = card.value <= low || card.value >= high;
        }
        break;

      case 4:
        correct = choice === card.suit;
        break;
    }

    if (!correct) {
      game.result = 'lose';
      game.currentStage = 'finished';
      return false;
    }

    if (game.currentStage === 1) {
      game.currentMultiplier = 2;
      game.currentStage = 2;
    } else if (game.currentStage === 2) {
      game.currentMultiplier = 3;
      game.currentStage = 3;
    } else if (game.currentStage === 3) {
      game.currentMultiplier = 5;
      game.currentStage = 4;
    } else if (game.currentStage === 4) {
      game.currentMultiplier = 20;
      game.result = 'win';
      game.currentStage = 'finished';
    }

    return correct;
  }

  cashout(game: RideTheBusGame): void {
    game.result = 'cashout';
    game.currentStage = 'finished';
  }

  formatCard(card: Card): string {
    return `${card.rank}${card.suit}`;
  }

  cleanup(): void {
    for (const [key, game] of this.games.entries()) {
      if (game.currentStage === 'finished') {
        this.games.delete(key);
      }
    }
  }
}

const busManager = new RideTheBusManager();

setInterval(
  () => {
    busManager.cleanup();
  },
  5 * 60 * 1000
);

function createGameEmbed(
  game: RideTheBusGame,
  currency: { emoji: string; name: string },
  username: string,
  avatarUrl: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(
      game.result === 'win' || game.result === 'cashout'
        ? 0xd4e6d4
        : game.result === 'lose'
          ? 0xf87171
          : 0x4169e1
    )
    .setTitle('✦ ride the bus time !')
    .setFooter({
      text: username,
      iconURL: avatarUrl,
    });

  let description = `bet: ${currency.emoji} **${game.bet.toLocaleString()} ${currency.name}**\n\n`;

  if (game.cards.length > 0) {
    description += '**cards dealt:**\n';
    game.cards.forEach((card, index) => {
      description += `${index + 1}. ${busManager.formatCard(card)}`;
      if (index < game.choices.length) {
        description += ` (guessed: ${game.choices[index]})`;
      }
      description += '\n';
    });
    description += '\n';
  }

  if (game.currentStage === 'finished') {
    if (game.result === 'win') {
      const winnings = game.bet * 20;
      description += `**YOU MADE IT!** 🎉\n\n`;
      description += `you successfully rode the bus!\n`;
      description += `winnings: ${currency.emoji} **${winnings.toLocaleString()} ${currency.name}**`;
    } else if (game.result === 'cashout') {
      const winnings = game.bet * (game.currentMultiplier || 0);
      description += `## GAME OVER !\n\n`;
      description += `you cashed out at stage ${game.cards.length}!\n`;
      description += `winnings: ${currency.emoji} **${winnings.toLocaleString()} ${currency.name}**`;
    } else {
      description += `## GAME OVER !\n\n`;
      description += `you lost at stage ${game.cards.length}!\n`;
      description += `better luck next time!`;
    }
  } else {
    const stages = [
      '**stage 1:** red or black? (2x)',
      '**stage 2:** higher or lower than the first card? (3x)',
      '**stage 3:** between or outside the first two cards? (5x)',
      '**stage 4:** guess the suit! (20x)',
    ];
    description += stages[game.currentStage - 1];

    if (game.currentMultiplier && game.currentStage > 1) {
      description += `\n\ncurrent multiplier: **${game.currentMultiplier}x**`;
    }
  }

  embed.setDescription(description);
  return embed;
}

function createButtons(
  stage: number | 'finished',
  canCashout: boolean = false,
  currentMultiplier?: number
): ActionRowBuilder<ButtonBuilder>[] {
  if (stage === 'finished') return [];

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  switch (stage) {
    case 1:
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('bus_red')
            .setLabel('red')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('bus_black')
            .setLabel('black')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;

    case 2:
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('bus_higher')
            .setLabel('higher')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('bus_lower')
            .setLabel('lower')
            .setStyle(ButtonStyle.Primary)
        )
      );
      break;

    case 3:
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('bus_between')
            .setLabel('between')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('bus_outside')
            .setLabel('outside')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;

    case 4:
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('bus_♠')
            .setLabel('♠')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('bus_♥')
            .setLabel('♥')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('bus_♦')
            .setLabel('♦')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('bus_♣')
            .setLabel('♣')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;
  }

  if (canCashout && stage > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('bus_cashout')
          .setLabel(`cashout (${currentMultiplier || 0}x)`)
          .setStyle(ButtonStyle.Success)
      )
    );
  }

  return rows;
}

async function handleGameInteraction(
  interaction: ChatInputCommandInteraction,
  game: RideTheBusGame,
  currency: { emoji: string; name: string }
): Promise<void> {
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== game.userId) {
      await i.reply({
        content: "this isn't your game!",
        flags: ['Ephemeral'],
      });
      return;
    }

    const economyService = serviceManager.getEconomyService();

    if (i.customId === 'bus_cashout') {
      busManager.cashout(game);
      collector.stop();

      const winnings = game.bet * (game.currentMultiplier || 0);
      await economyService.addBalance(
        game.guildId,
        interaction.guild!.name,
        game.userId,
        winnings,
        'ride the bus cashout'
      );
    } else {
      const choiceMap: Record<string, string> = {
        bus_red: 'red',
        bus_black: 'black',
        bus_higher: 'higher',
        bus_lower: 'lower',
        bus_between: 'between',
        bus_outside: 'outside',
        'bus_♠': '♠',
        'bus_♥': '♥',
        'bus_♦': '♦',
        'bus_♣': '♣',
      };

      const choice = choiceMap[i.customId];
      if (!choice) return;

      const correct = busManager.processChoice(game, choice);

      if (game.currentStage === 'finished') {
        collector.stop();

        if (game.result === 'win') {
          const winnings = game.bet * 20;
          await economyService.addBalance(
            game.guildId,
            interaction.guild!.name,
            game.userId,
            winnings,
            'ride the bus win'
          );
        }
      }
    }

    const embed = createGameEmbed(
      game,
      currency,
      i.user.username,
      i.user.displayAvatarURL()
    );
    const components = createButtons(
      game.currentStage,
      game.cards.length > 0,
      game.currentMultiplier
    );

    await i.update({ embeds: [embed], components });
  });

  collector.on('end', () => {
    if (game.currentStage !== 'finished') {
      busManager.deleteGame(game.userId, game.guildId);
    }
  });
}

const ridethebus: Command = {
  data: new SlashCommandBuilder()
    .setName('ridethebus')
    .setDescription(
      'play ride the bus - guess your way through 4 card challenges'
    )
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('amount to bet')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const bet = interaction.options.getInteger('bet', true);
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
          content: `you don't have enough ${currency.name}! you only have ${currency.emoji} **${userBalance.balance.toLocaleString()}**`,
          flags: ['Ephemeral'],
        });
        return;
      }

      const existingGame = busManager.getGame(userId, guildId);
      if (existingGame && existingGame.currentStage !== 'finished') {
        await interaction.reply({
          content: 'you already have a ride the bus game in progress!',
          flags: ['Ephemeral'],
        });
        return;
      }

      await economyService.addBalance(
        guildId,
        guildName,
        userId,
        -bet,
        'ride the bus bet'
      );

      const game = busManager.createGame(userId, guildId, bet);

      const embed = createGameEmbed(
        game,
        currency,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );
      const components = createButtons(game.currentStage);

      await interaction.reply({ embeds: [embed], components });

      handleGameInteraction(interaction, game, currency);

      logger.info(
        `${interaction.user.username} started ride the bus with bet ${bet} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in ridethebus command:', error);

      const errorMessage = {
        content: 'an error occurred while boarding the bus!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default ridethebus;
