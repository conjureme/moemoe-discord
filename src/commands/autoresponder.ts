import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';
import { PlaceholderValidator } from '../utils/PlaceholderValidator';
import { logger } from '../utils/logger';

const autoresponder: Command = {
  data: new SlashCommandBuilder()
    .setName('autoresponder')
    .setDescription('manage server autoresponders')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('create a new autoresponder')
        .addStringOption((option) =>
          option
            .setName('trigger')
            .setDescription('the message that triggers the autoresponse')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((option) =>
          option
            .setName('reply')
            .setDescription('the response message')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('remove an existing autoresponder')
        .addStringOption((option) =>
          option
            .setName('trigger')
            .setDescription('the trigger to remove')
            .setRequired(true)
            .setMaxLength(200)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('edit an existing autoresponder')
        .addStringOption((option) =>
          option
            .setName('trigger')
            .setDescription('the trigger to edit')
            .setRequired(true)
            .setMaxLength(200)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('reply')
            .setDescription('the new response message')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('show all autoresponders or a specific one')
        .addStringOption((option) =>
          option
            .setName('trigger')
            .setDescription('specific trigger to show (optional)')
            .setRequired(false)
            .setMaxLength(200)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('matchmode')
        .setDescription('set the match mode for an autoresponder')
        .addStringOption((option) =>
          option
            .setName('trigger')
            .setDescription('the trigger to modify')
            .setRequired(true)
            .setMaxLength(200)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('how the trigger should be matched')
            .setRequired(true)
            .addChoices(
              { name: 'exact - must match exactly', value: 'exact' },
              {
                name: 'contains - message contains trigger',
                value: 'contains',
              },
              {
                name: 'startswith - message starts with trigger',
                value: 'startswith',
              },
              {
                name: 'endswith - message ends with trigger',
                value: 'endswith',
              },
              { name: 'default - message is only trigger', value: 'default' }
            )
        )
    ),

  async autocomplete(interaction: any) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const autoresponderService = serviceManager.getAutoresponderService();
    const guildAutoresponders =
      autoresponderService.getGuildAutoresponders(guildId);

    if (!guildAutoresponders || guildAutoresponders.size === 0) {
      await interaction.respond([]);
      return;
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();

    // filter and map triggers to choices
    const choices = Array.from(guildAutoresponders.keys())
      .filter((trigger) => trigger.includes(focusedValue))
      .slice(0, 25)
      .map((trigger) => ({
        name: trigger.length > 100 ? trigger.substring(0, 97) + '...' : trigger,
        value: trigger,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildIcon = interaction.guild!.iconURL({ size: 256 }) || undefined;

    const autoresponderService = serviceManager.getAutoresponderService();

    try {
      switch (subcommand) {
        case 'create': {
          const trigger = interaction.options
            .getString('trigger', true)
            .toLowerCase();
          const reply = interaction.options.getString('reply', true);

          const validation = PlaceholderValidator.validate(reply);
          if (!validation.valid) {
            const errorMessage =
              PlaceholderValidator.getErrorMessage(validation);
            await interaction.reply({
              content: errorMessage,
              flags: ['Ephemeral'],
            });
            return;
          }

          const result = autoresponderService.createAutoresponder(
            guildId,
            guildName,
            trigger,
            reply
          );

          if (!result.success) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('autoresponder already exists')
              .setDescription(
                `an autoresponder with trigger **"${trigger}"** already exists.\nuse \`/autoresponder edit\` to modify it.`
              );

            await interaction.reply({ embeds: [embed] });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ autoresponder created !')
            .addFields(
              {
                name: 'trigger',
                value: `\`${trigger}\``,
                inline: true,
              },
              {
                name: 'reply',
                value:
                  reply.length > 100 ? reply.substring(0, 100) + '...' : reply,
                inline: true,
              }
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `created autoresponder in ${guildName}: "${trigger}" -> "${reply}"`
          );
          break;
        }

        case 'remove': {
          const trigger = interaction.options
            .getString('trigger', true)
            .toLowerCase();

          const result = autoresponderService.removeAutoresponder(
            guildId,
            trigger
          );

          if (!result.success) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('autoresponder not found')
              .setDescription(
                `no autoresponder found with trigger **"${trigger}"**`
              );

            await interaction.reply({ embeds: [embed] });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ autoresponder removed !')
            .setDescription(
              `removed autoresponder with trigger **"${trigger}"**`
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(`removed autoresponder in ${guildName}: "${trigger}"`);
          break;
        }

        case 'edit': {
          const trigger = interaction.options
            .getString('trigger', true)
            .toLowerCase();
          const newReply = interaction.options.getString('reply', true);

          const validation = PlaceholderValidator.validate(newReply);
          if (!validation.valid) {
            const errorMessage =
              PlaceholderValidator.getErrorMessage(validation);
            await interaction.reply({
              content: errorMessage,
              flags: ['Ephemeral'],
            });
            return;
          }

          const result = autoresponderService.editAutoresponder(
            guildId,
            trigger,
            newReply
          );

          if (!result.success) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('autoresponder not found')
              .setDescription(
                `no autoresponder found with trigger **"${trigger}"**\nuse \`/autoresponder create\` to create it.`
              );

            await interaction.reply({ embeds: [embed] });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ autoresponder updated !')
            .addFields(
              {
                name: 'trigger',
                value: `\`${trigger}\``,
                inline: false,
              },
              {
                name: 'old reply',
                value:
                  result.oldReply!.length > 100
                    ? result.oldReply!.substring(0, 100) + '...'
                    : result.oldReply!,
                inline: false,
              },
              {
                name: 'new reply',
                value:
                  newReply.length > 100
                    ? newReply.substring(0, 100) + '...'
                    : newReply,
                inline: false,
              }
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(`edited autoresponder in ${guildName}: "${trigger}"`);
          break;
        }

        case 'show': {
          const specificTrigger = interaction.options
            .getString('trigger')
            ?.toLowerCase();

          if (specificTrigger) {
            // show specific autoresponder
            const autoresponder = autoresponderService.getAutoresponder(
              guildId,
              specificTrigger
            );

            if (!autoresponder) {
              const embed = new EmbedBuilder()
                .setColor(0xfaf0e7)
                .setAuthor({
                  name: guildName,
                  iconURL: guildIcon,
                })
                .setTitle('autoresponder not found !')
                .setDescription(
                  `no autoresponder found with trigger **"${specificTrigger}"**`
                );

              await interaction.reply({ embeds: [embed] });
              return;
            }

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('✦ autoresponder details !')
              .addFields(
                {
                  name: 'trigger',
                  value: `\`${specificTrigger}\``,
                  inline: false,
                },
                {
                  name: 'reply',
                  value: autoresponder.reply,
                  inline: false,
                }
              );

            await interaction.reply({ embeds: [embed] });
          } else {
            // show all autoresponders
            const guildAutoresponders =
              autoresponderService.getGuildAutoresponders(guildId);

            if (guildAutoresponders.size === 0) {
              const embed = new EmbedBuilder()
                .setColor(0xfaf0e7)
                .setAuthor({
                  name: guildName,
                  iconURL: guildIcon,
                })
                .setTitle('no autoresponders')
                .setDescription(
                  'this server has no autoresponders configured.\nuse `/autoresponder create` to add one!'
                );

              await interaction.reply({ embeds: [embed] });
              return;
            }

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle(`here are your autoresponders !`);

            let count = 0;
            for (const [trigger, autoresponder] of guildAutoresponders) {
              if (count >= 25) {
                embed.setDescription(
                  `showing first 25 of ${guildAutoresponders.size} autoresponders`
                );
                break;
              }

              embed.addFields({
                name: trigger,
                value: '​',
                inline: false,
              });

              count++;
            }

            await interaction.reply({ embeds: [embed] });
          }
          break;
        }
        case 'matchmode': {
          const trigger = interaction.options
            .getString('trigger', true)
            .toLowerCase();
          const mode = interaction.options.getString('mode', true) as
            | 'exact'
            | 'contains'
            | 'startswith'
            | 'endswith'
            | 'default';

          const result = autoresponderService.setMatchMode(
            guildId,
            trigger,
            mode
          );

          if (!result.success) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('autoresponder not found')
              .setDescription(
                `no autoresponder found with trigger **"${trigger}"**`
              );

            await interaction.reply({ embeds: [embed] });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ match mode updated !')
            .setDescription(
              `autoresponder **"${trigger}"** now uses **${mode}** matching`
            )
            .addFields({
              name: 'how it works',
              value: {
                exact: 'trigger message must be EXACT—capitalization and all',
                contains: 'trigger can appear anywhere in message',
                startswith: 'message must start with trigger',
                endswith: 'message must end with trigger',
                default:
                  'matches only the exact word as a standalone message. "fart" matches "fart" or "Fart" but not "fart lol"',
              }[mode]!,
              inline: false,
            });

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `updated match mode for autoresponder "${trigger}" to ${mode} in ${guildName}`
          );
          break;
        }
      }
    } catch (error) {
      logger.error('error in autoresponder command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xfaf0e7)
        .setAuthor({
          name: guildName,
          iconURL: guildIcon,
        })
        .setTitle('error')
        .setDescription('an error occurred while executing this command');

      const errorMessage = { embeds: [errorEmbed] };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default autoresponder;
