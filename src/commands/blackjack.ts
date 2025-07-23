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
}

interface BlackjackGame {
  userId: string;
  guildId: string;
  bet: number;
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  state: 'playing' | 'standing' | 'finished';
  result?: 'win' | 'lose' | 'push' | 'blackjack';
}

class BlackjackManager {
  private games: Map<string, BlackjackGame> = new Map();

  private getGameKey(userId: string, guildId: string): string {
    return `${guildId}:${userId}`;
  }

  createGame(userId: string, guildId: string, bet: number): BlackjackGame {
    const deck = this.createDeck();
    this.shuffleDeck(deck);

    const game: BlackjackGame = {
      userId,
      guildId,
      bet,
      playerHand: [],
      dealerHand: [],
      deck,
      state: 'playing',
    };

    // initial deal
    game.playerHand.push(this.drawCard(game.deck));
    game.dealerHand.push(this.drawCard(game.deck));
    game.playerHand.push(this.drawCard(game.deck));
    game.dealerHand.push(this.drawCard(game.deck));

    const key = this.getGameKey(userId, guildId);
    this.games.set(key, game);

    return game;
  }

  getGame(userId: string, guildId: string): BlackjackGame | undefined {
    const key = this.getGameKey(userId, guildId);
    return this.games.get(key);
  }

  deleteGame(userId: string, guildId: string): void {
    const key = this.getGameKey(userId, guildId);
    this.games.delete(key);
  }

  private createDeck(): Card[] {
    const suits: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
    const ranks = [
      'A',
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
    ];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (isNaN(value)) {
          if (rank === 'A') value = 11;
          else value = 10; // J, Q, K
        }

        deck.push({ suit, rank, value });
      }
    }

    return deck;
  }

  private shuffleDeck(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  private drawCard(deck: Card[]): Card {
    return deck.pop()!;
  }

  hit(game: BlackjackGame): void {
    game.playerHand.push(this.drawCard(game.deck));
  }

  stand(game: BlackjackGame): void {
    game.state = 'standing';

    while (this.calculateHandValue(game.dealerHand) < 17) {
      game.dealerHand.push(this.drawCard(game.deck));
    }

    const playerValue = this.calculateHandValue(game.playerHand);
    const dealerValue = this.calculateHandValue(game.dealerHand);

    if (dealerValue > 21) {
      game.result = 'win';
    } else if (playerValue > dealerValue) {
      game.result = 'win';
    } else if (playerValue < dealerValue) {
      game.result = 'lose';
    } else {
      game.result = 'push';
    }

    game.state = 'finished';
  }

  calculateHandValue(hand: Card[]): number {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
      if (card.rank === 'A') {
        aces++;
      }
      value += card.value;
    }

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  isBlackjack(hand: Card[]): boolean {
    return hand.length === 2 && this.calculateHandValue(hand) === 21;
  }

  formatHand(hand: Card[], hideSecond: boolean = false): string {
    if (hideSecond && hand.length >= 2) {
      return `${hand[0].rank}${hand[0].suit} ??`;
    }
    return hand.map((card) => `${card.rank}${card.suit}`).join(' ');
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, game] of this.games.entries()) {
      if (game.state === 'finished') {
        this.games.delete(key);
      }
    }
  }
}

const blackjackManager = new BlackjackManager();

setInterval(
  () => {
    blackjackManager.cleanup();
  },
  5 * 60 * 1000
);

function createGameEmbed(
  game: BlackjackGame,
  currency: { emoji: string; name: string },
  username: string,
  avatarUrl: string
): EmbedBuilder {
  const playerValue = blackjackManager.calculateHandValue(game.playerHand);
  const dealerValue = blackjackManager.calculateHandValue(game.dealerHand);
  const hideDealer = game.state === 'playing';

  const embed = new EmbedBuilder()
    .setColor(
      game.state === 'finished' ? getResultColor(game.result!) : 0x141413
    )
    .setTitle('✦ blackjack time !')
    .addFields(
      {
        name: `dealer ${hideDealer ? '' : `(${dealerValue})`}`,
        value: blackjackManager.formatHand(game.dealerHand, hideDealer),
        inline: false,
      },
      {
        name: `you (${playerValue})`,
        value: blackjackManager.formatHand(game.playerHand),
        inline: false,
      }
    )
    .setFooter({
      text: username,
      iconURL: avatarUrl,
    });

  let description = `bet: ${currency.emoji} **${game.bet.toLocaleString()} ${currency.name}**`;

  if (game.state === 'finished') {
    let resultText = '';
    switch (game.result) {
      case 'blackjack':
        resultText = `\n\n**BLACKJACK!** you won ${currency.emoji} **${Math.floor(
          game.bet * 1.5
        ).toLocaleString()} ${currency.name}**!`;
        break;
      case 'win':
        resultText = `\n\n**you won!** +${currency.emoji} **${game.bet.toLocaleString()} ${
          currency.name
        }**`;
        break;
      case 'lose':
        resultText =
          playerValue > 21 ? '\n\n**bust!** you lost!' : '\n\n**you lost!**';
        break;
      case 'push':
        resultText = `\n\n**push!** bet returned`;
        break;
    }
    description += resultText;
  }

  embed.setDescription(description);

  return embed;
}

function getResultColor(result: string): number {
  switch (result) {
    case 'blackjack':
    case 'win':
      return 0xd4e6d4;
    case 'lose':
      return 0xf87171;
    case 'push':
      return 0xfaf0e7;
    default:
      return 0x141413;
  }
}

function createButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('blackjack_hit')
      .setLabel('hit')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('blackjack_stand')
      .setLabel('stand')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

async function handleGameInteraction(
  interaction: ChatInputCommandInteraction,
  game: BlackjackGame,
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

    if (i.customId === 'blackjack_hit') {
      blackjackManager.hit(game);
      const playerValue = blackjackManager.calculateHandValue(game.playerHand);

      if (playerValue > 21) {
        game.state = 'finished';
        game.result = 'lose';
        collector.stop();
      }
    } else if (i.customId === 'blackjack_stand') {
      blackjackManager.stand(game);
      collector.stop();

      if (game.result === 'win') {
        await economyService.addBalance(
          game.guildId,
          interaction.guild!.name,
          game.userId,
          game.bet * 2,
          'blackjack win'
        );
      } else if (game.result === 'push') {
        await economyService.addBalance(
          game.guildId,
          interaction.guild!.name,
          game.userId,
          game.bet,
          'blackjack push'
        );
      }
    }

    const embed = createGameEmbed(
      game,
      currency,
      i.user.username,
      i.user.displayAvatarURL()
    );
    const components = game.state === 'playing' ? createButtons() : [];

    await i.update({ embeds: [embed], components });
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'time' && game.state === 'playing') {
      // auto-stand on timeout
      blackjackManager.stand(game);

      const economyService = serviceManager.getEconomyService();
      if (game.result === 'win') {
        await economyService.addBalance(
          game.guildId,
          interaction.guild!.name,
          game.userId,
          game.bet * 2,
          'blackjack win (timeout)'
        );
      } else if (game.result === 'push') {
        await economyService.addBalance(
          game.guildId,
          interaction.guild!.name,
          game.userId,
          game.bet,
          'blackjack push (timeout)'
        );
      }

      const embed = createGameEmbed(
        game,
        currency,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );
      embed.setFooter({
        text: `${interaction.user.username} | game timed out`,
        iconURL: interaction.user.displayAvatarURL(),
      });

      await interaction.editReply({ embeds: [embed], components: [] });
    }

    blackjackManager.deleteGame(game.userId, game.guildId);
  });
}

const blackjack: Command = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('play blackjack against the dealer')
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

      const existingGame = blackjackManager.getGame(userId, guildId);
      if (existingGame && existingGame.state !== 'finished') {
        await interaction.reply({
          content: 'you already have a blackjack game in progress!',
          flags: ['Ephemeral'],
        });
        return;
      }

      await economyService.addBalance(
        guildId,
        guildName,
        userId,
        -bet,
        'blackjack bet'
      );

      const game = blackjackManager.createGame(userId, guildId, bet);

      const playerBlackjack = blackjackManager.isBlackjack(game.playerHand);
      const dealerBlackjack = blackjackManager.isBlackjack(game.dealerHand);

      if (playerBlackjack || dealerBlackjack) {
        if (playerBlackjack && !dealerBlackjack) {
          game.result = 'blackjack';
          game.state = 'finished';
          const winnings = Math.floor(bet * 2.5);
          await economyService.addBalance(
            guildId,
            guildName,
            userId,
            winnings,
            'blackjack win (natural)'
          );
        } else if (!playerBlackjack && dealerBlackjack) {
          game.result = 'lose';
          game.state = 'finished';
        } else {
          game.result = 'push';
          game.state = 'finished';
          await economyService.addBalance(
            guildId,
            guildName,
            userId,
            bet,
            'blackjack push'
          );
        }
      }

      const embed = createGameEmbed(
        game,
        currency,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );
      const components = game.state === 'playing' ? createButtons() : [];

      await interaction.reply({ embeds: [embed], components });

      if (game.state === 'playing') {
        handleGameInteraction(interaction, game, currency);
      }

      logger.info(
        `${interaction.user.username} started blackjack with bet ${bet} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in blackjack command:', error);

      const errorMessage = {
        content: 'an error occurred while starting blackjack!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default blackjack;
