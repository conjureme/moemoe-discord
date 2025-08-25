import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';
import { AutoresponderProcessor } from '../services/autoresponder/AutoresponderProcessor';

import { logger } from '../utils/logger';

const greet: Command = {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('manage welcome greetings for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('set the greeting message')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('the greeting message with placeholders')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('test')
        .setDescription('test the greeting message on yourself or another user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('user to test the greeting on (defaults to you)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('show the current greeting message')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('remove the greeting entirely')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildIcon = interaction.guild!.iconURL({ size: 256 }) || undefined;

    const greetService = serviceManager.getGreetService();

    try {
      switch (subcommand) {
        case 'set': {
          const message = interaction.options.getString('message', true);

          const result = greetService.setGreeting(
            guildId,
            guildName,
            message,
            interaction.user.id
          );

          if (!result.success) {
            await interaction.reply({
              content: result.message,
              flags: ['Ephemeral'],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ greeting set !')
            .setDescription('new members will be greeted with your message')
            .addFields({
              name: 'message preview',
              value:
                message.length > 1000
                  ? message.substring(0, 1000) + '...'
                  : message,
              inline: false,
            })
            .setFooter({
              text: 'use /greet test to preview how it looks',
            });

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `greeting set in ${guildName} by ${interaction.user.username}`
          );
          break;
        }

        case 'test': {
          const targetUser =
            interaction.options.getUser('user') || interaction.user;
          const targetMember =
            (interaction.options.getMember('user') as GuildMember) ||
            (interaction.member as GuildMember);

          const greeting = greetService.getGreeting(guildId);

          if (!greeting) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setTitle('there are no greetings !')
              .setDescription(`create a greeting message using \`/greet set\``);
            await interaction.reply({
              embeds: [embed],
            });
            return;
          }

          // create a mock message for the processor
          const mockMessage = {
            author: targetUser,
            member: targetMember,
            guild: interaction.guild,
            guildId: guildId,
            channelId: interaction.channelId,
            channel: interaction.channel,
            client: interaction.client,
            content: '', // empty since this is a join event
          } as any;

          const processor = AutoresponderProcessor.getInstance();

          try {
            const processedMessage = await processor.processReply(
              greeting.message,
              mockMessage,
              []
            );

            await interaction.reply({
              content: 'your greet message should have been sent!',
            });

            if (typeof processedMessage === 'string') {
              await interaction.followUp(processedMessage);
            } else if (processedMessage && 'embeds' in processedMessage) {
              await interaction.followUp(processedMessage);
            }

            logger.info(
              `tested greeting in ${guildName} for ${targetUser.username}`
            );
          } catch (error) {
            logger.error('error testing greeting:', error);
            await interaction.reply({
              content:
                'error processing greeting: ' +
                (error instanceof Error ? error.message : 'unknown error'),
              flags: ['Ephemeral'],
            });
          }
          break;
        }

        case 'show': {
          const greeting = greetService.getGreeting(guildId);

          if (!greeting) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setTitle('there are no greetings !')
              .setDescription(`create a greeting message using \`/greet set\``);
            await interaction.reply({
              embeds: [embed],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ current greeting !')
            .addFields({
              name: 'message',
              value:
                greeting.message.length > 1000
                  ? greeting.message.substring(0, 1000) + '...'
                  : greeting.message,
              inline: false,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'remove': {
          const result = greetService.removeGreeting(guildId);

          if (!result.success) {
            await interaction.reply({
              content: result.message,
              flags: ['Ephemeral'],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ greeting removed !')
            .setDescription('the greeting has been completely removed');

          await interaction.reply({ embeds: [embed] });
          logger.info(`greeting removed in ${guildName}`);
          break;
        }
      }
    } catch (error) {
      logger.error('error in greet command:', error);

      const errorMessage = {
        content: 'an error occurred while executing this command',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default greet;
