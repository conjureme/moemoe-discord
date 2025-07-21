import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

interface FishCooldown {
  userId: string;
  guildId: string;
  lastUsed: number;
}

class FishCooldownManager {
  private cooldowns: Map<string, FishCooldown> = new Map();

  private getCooldownKey(userId: string, guildId: string): string {
    return `${guildId}:${userId}`;
  }

  isOnCooldown(userId: string, guildId: string, cooldownMs: number): boolean {
    const key = this.getCooldownKey(userId, guildId);
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) return false;

    const now = Date.now();
    return now - cooldown.lastUsed < cooldownMs;
  }

  getRemainingCooldown(
    userId: string,
    guildId: string,
    cooldownMs: number
  ): number {
    const key = this.getCooldownKey(userId, guildId);
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) return 0;

    const now = Date.now();
    const elapsed = now - cooldown.lastUsed;
    return Math.max(0, cooldownMs - elapsed);
  }

  setCooldown(userId: string, guildId: string): void {
    const key = this.getCooldownKey(userId, guildId);
    this.cooldowns.set(key, {
      userId,
      guildId,
      lastUsed: Date.now(),
    });
  }

  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [key, cooldown] of this.cooldowns.entries()) {
      if (now - cooldown.lastUsed > maxAge) {
        this.cooldowns.delete(key);
      }
    }
  }
}

const fishCooldowns = new FishCooldownManager();

setInterval(
  () => {
    fishCooldowns.cleanup();
  },
  60 * 60 * 1000
);

interface FishResult {
  rarity: 'junk' | 'common' | 'uncommon' | 'rare' | 'legendary';
  name: string;
  rewardMultiplier: number;
  chance: number;
  responses: string[];
}

const fishResults: FishResult[] = [
  {
    rarity: 'junk',
    name: 'junk',
    rewardMultiplier: 0,
    chance: 15,
    responses: [
      'you caught an old boot... it stinks!',
      'awwww, just some trash.',
      'yep, even more trash. better luck next cast!',
      'an old tin can surfaces...',
      'you reeled in some seaweed.',
    ],
  },
  {
    rarity: 'common',
    name: 'small fish',
    rewardMultiplier: 1,
    chance: 45,
    responses: [
      "you caught a tiny fish! here's {{reward}} for it!",
      'a tiny little fish on your hook! earned {{reward}}!',
      'nice catch! this small guy is worth {{reward}}!',
      `you pulled up a common fish! you deserve {{reward}} !`,
    ],
  },
  {
    rarity: 'uncommon',
    name: 'medium fish',
    rewardMultiplier: 2,
    chance: 25,
    responses: [
      'nice catch! a decent sized fish nets you {{reward}}!',
      'holy moly, this fish is pretty cool! this thing is worth {{reward}}!',
      'you hooked an uncommon fish! impressive! {{reward}}!',
    ],
  },
  {
    rarity: 'rare',
    name: 'big fish',
    rewardMultiplier: 4,
    chance: 12,
    responses: [
      'whoa! you pulled up a big fish worth {{reward}}!',
      'incredible! this rare catch earned you {{reward}}!',
      'amazing catch! this big fish is worth {{reward}}!',
    ],
  },
  {
    rarity: 'legendary',
    name: 'legendary fish',
    rewardMultiplier: 10,
    chance: 3,
    responses: [
      'LEGENDARY CATCH! this mythical fish is worth {{reward}}!',
      'this is the stuff of legends! you earned {{reward}}!',
      'everyone gather round! this legendary catch earned {{reward}}!',
    ],
  },
];

function getFishResult(): FishResult {
  const roll = Math.random() * 100;
  let cumulativeChance = 0;

  for (const result of fishResults) {
    cumulativeChance += result.chance;
    if (roll <= cumulativeChance) {
      return result;
    }
  }

  // fallback to common if something goes wrong
  return fishResults.find((r) => r.rarity === 'common')!;
}

const fish: Command = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('cast your line and see what you catch!'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
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

      const guildEconomy = economyService.getGuildEconomy(guildId);
      const currency = guildEconomy?.currency || { emoji: '🧀', name: 'curds' };

      const defaultFishSettings = {
        baseReward: 40,
        cooldownMinutes: 60,
      };

      const fishSettings = {
        baseReward:
          guildEconomy?.settings?.fishBaseReward ??
          defaultFishSettings.baseReward,
        cooldownMinutes:
          guildEconomy?.settings?.fishCooldownMinutes ??
          defaultFishSettings.cooldownMinutes,
      };

      const cooldownMs = fishSettings.cooldownMinutes * 60 * 1000;

      if (fishCooldowns.isOnCooldown(userId, guildId, cooldownMs)) {
        const remainingMs = fishCooldowns.getRemainingCooldown(
          userId,
          guildId,
          cooldownMs
        );
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

        const embed = new EmbedBuilder()
          .setColor(0xfaf0e7)
          .setDescription(
            `### HEY!!! the fish aren't ready yet... try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
          );

        await interaction.reply({
          embeds: [embed],
        });
        return;
      }

      const result = getFishResult();
      const reward = Math.floor(
        fishSettings.baseReward * result.rewardMultiplier
      );

      if (result.rewardMultiplier > 0) {
        await economyService.addBalance(
          guildId,
          guildName,
          userId,
          reward,
          `fishing - caught ${result.name}`
        );
      }

      fishCooldowns.setCooldown(userId, guildId);

      const randomResponse =
        result.responses[Math.floor(Math.random() * result.responses.length)];
      const finalResponse = randomResponse.replace(
        '{{reward}}',
        `${currency.emoji} **${reward} ${currency.name}**`
      );

      const rarityColors = {
        junk: 0x5b4513,
        common: 0x90bf90,
        uncommon: 0x5dceeb,
        rare: 0x9382db,
        legendary: 0xffee00,
      };

      const embed = new EmbedBuilder()
        .setColor(rarityColors[result.rarity])
        .setAuthor({
          name: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(`✧･ﾟ fishing results !`)
        .setDescription(`**${result.name}**\n\n${finalResponse}`)
        .setFooter({
          text: `next fishing trip available in ${fishSettings.cooldownMinutes} minutes`,
        });

      await interaction.reply({ embeds: [embed] });

      logger.info(
        `${interaction.user.username} caught ${result.name} (${result.rarity}) and received ${reward} ${currency.name} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in fish command:', error);

      const errorMessage = {
        content: 'an error occurred while fishing!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default fish;
