import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

interface PatCooldown {
  userId: string;
  guildId: string;
  lastUsed: number;
}

class PatCooldownManager {
  private cooldowns: Map<string, PatCooldown> = new Map();

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

const patCooldowns = new PatCooldownManager();

setInterval(
  () => {
    patCooldowns.cleanup();
  },
  60 * 60 * 1000
);

const pat: Command = {
  data: new SlashCommandBuilder()
    .setName('pat')
    .setDescription("pat the bot's head for some currency!"),

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

      const defaultPatSettings = {
        minReward: 20,
        maxReward: 60,
        cooldownMinutes: 60,
      };

      const patSettings = {
        minReward:
          guildEconomy?.settings?.patMinReward ?? defaultPatSettings.minReward,
        maxReward:
          guildEconomy?.settings?.patMaxReward ?? defaultPatSettings.maxReward,
        cooldownMinutes:
          guildEconomy?.settings?.patCooldownMinutes ??
          defaultPatSettings.cooldownMinutes,
      };

      const cooldownMs = patSettings.cooldownMinutes * 60 * 1000;

      if (patCooldowns.isOnCooldown(userId, guildId, cooldownMs)) {
        const remainingMs = patCooldowns.getRemainingCooldown(
          userId,
          guildId,
          cooldownMs
        );
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

        const embed = new EmbedBuilder()
          .setColor(0xfaf0e7)
          .setDescription(
            `### STOP IT ${interaction.user.displayName}! you recently pat my head... try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
          );

        await interaction.reply({
          embeds: [embed],
        });
        return;
      }

      const reward =
        Math.floor(
          Math.random() * (patSettings.maxReward - patSettings.minReward + 1)
        ) + patSettings.minReward;

      await economyService.addBalance(
        guildId,
        guildName,
        userId,
        reward,
        'head pat reward'
      );

      patCooldowns.setCooldown(userId, guildId);

      const responses = [
        `thanks for the head pat! here's ${currency.emoji} **${reward} ${currency.name}** !`,
        `what the...? ${currency.emoji} **${reward} ${currency.name}** was smacked out!`,
        `you were given ${currency.emoji} **${reward} ${currency.name}** in exchange for the head pats!`,
        `:333333333333333 take these! ${currency.emoji} **${reward} ${currency.name}**`,
      ];

      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];

      const embed = new EmbedBuilder()
        .setColor(0xfaf0e7)
        .setAuthor({
          name: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle('✧･ﾟ head pats !')
        .setDescription(randomResponse)
        .setFooter({
          text: `next pat available in ${patSettings.cooldownMinutes} minutes`,
        });

      await interaction.reply({ embeds: [embed] });

      logger.info(
        `${interaction.user.username} received ${reward} ${currency.name} from head pats in ${guildName}`
      );
    } catch (error) {
      logger.error('error in pat command:', error);

      const errorMessage = {
        content: 'an error occurred while giving head pats!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default pat;
