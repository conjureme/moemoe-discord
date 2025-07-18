import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

const settings: Command = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('view server settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('currency')
        .setDescription('view economy settings for this server')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const economyService = serviceManager.getEconomyService();

    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildImage = interaction.guild!.iconURL({ size: 256 }) || undefined;

    try {
      switch (subcommand) {
        case 'currency': {
          let economy = economyService.getGuildEconomy(guildId);

          if (!economy) {
            await economyService.getBalance(
              guildId,
              guildName,
              interaction.user.id
            );
            economy = economyService.getGuildEconomy(guildId)!;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildImage,
            })
            .setTitle(`✧･ﾟ currency settings !`)
            .addFields(
              {
                name: 'currency name',
                value: economy.currency.name,
                inline: true,
              },
              {
                name: 'currency emoji',
                value: economy.currency.emoji,
                inline: true,
              },
              {
                name: 'starting balance',
                value: economy.settings.startingBalance.toString(),
                inline: true,
              }
            )
            .setFooter({
              text: `you can use /currency to modify these settings!`,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      await interaction.reply({
        content: 'an error occurred while fetching settings',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default settings;
