import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  ColorResolvable,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const embed: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('create and manage custom embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('create a new embed')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('unique name for the embed')
            .setRequired(true)
            .setMaxLength(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('edit an existing embed')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('name of the embed to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('remove an embed')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('name of the embed to remove')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('list all embeds in this server')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('preview')
        .setDescription('preview an embed')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('name of the embed to preview')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('send an embed to a channel')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('name of the embed to send')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription(
              'channel to send the embed to (defaults to current)'
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('json')
        .setDescription('create an embed from JSON')
        .addStringOption((option) =>
          option
            .setName('data')
            .setDescription('embed data in JSON format')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('optional: save with this name')
            .setRequired(false)
            .setMaxLength(50)
        )
    ),

  async autocomplete(interaction: any) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const embedService = serviceManager.getEmbedService();
    const guildEmbeds = embedService.getGuildEmbeds(guildId);

    if (!guildEmbeds || guildEmbeds.size === 0) {
      await interaction.respond([]);
      return;
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();

    const choices = Array.from(guildEmbeds.keys())
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map((name) => ({
        name: name.length > 100 ? name.substring(0, 97) + '...' : name,
        value: name,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildIcon = interaction.guild!.iconURL({ size: 256 }) || undefined;

    const embedService = serviceManager.getEmbedService();

    try {
      switch (subcommand) {
        case 'create': {
          const name = interaction.options
            .getString('name', true)
            .toLowerCase();

          const result = embedService.createEmbed(
            guildId,
            guildName,
            name,
            interaction.user.id
          );

          if (!result.success) {
            await interaction.reply({
              content: result.message,
            });
            return;
          }

          const storedEmbed = embedService.getEmbed(guildId, name)!;
          const previewEmbed = embedService.buildDiscordEmbed(storedEmbed);

          const buttons = createEditButtons(name);

          await interaction.reply({
            content: `created embed **"${name}"** - use the buttons below to edit it!`,
            embeds: [previewEmbed],
            components: buttons,
          });

          handleEditButtons(interaction, name);
          break;
        }

        case 'edit': {
          const name = interaction.options
            .getString('name', true)
            .toLowerCase();

          const storedEmbed = embedService.getEmbed(guildId, name);
          if (!storedEmbed) {
            await interaction.reply({
              content: `embed **"${name}"** not found`,
            });
            return;
          }

          const previewEmbed = embedService.buildDiscordEmbed(storedEmbed);
          const buttons = createEditButtons(name);

          await interaction.reply({
            content: `editing embed **"${name}"**`,
            embeds: [previewEmbed],
            components: buttons,
          });

          handleEditButtons(interaction, name);
          break;
        }

        case 'remove': {
          const name = interaction.options
            .getString('name', true)
            .toLowerCase();

          const result = embedService.removeEmbed(guildId, name);

          if (!result.success) {
            await interaction.reply({
              content: result.message,
            });
            return;
          }

          await interaction.reply({
            content: `removed embed **"${name}"**`,
          });

          logger.info(`removed embed "${name}" in ${guildName}`);
          break;
        }

        case 'list': {
          const guildEmbeds = embedService.getGuildEmbeds(guildId);

          if (guildEmbeds.size === 0) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildIcon,
              })
              .setTitle('there are no embeds here !')
              .setDescription('you can make one using `/embed create`!');

            await interaction.reply({ embeds: [embed] });
            return;
          }

          const listEmbed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('stored embeds')
            .setDescription(
              Array.from(guildEmbeds.keys())
                .map((name) => `• **${name}**`)
                .join('\n')
            )
            .setFooter({
              text: `${guildEmbeds.size} embed${guildEmbeds.size !== 1 ? 's' : ''}`,
            });

          await interaction.reply({
            embeds: [listEmbed],
          });
          break;
        }

        case 'preview': {
          const name = interaction.options
            .getString('name', true)
            .toLowerCase();

          const storedEmbed = embedService.getEmbed(guildId, name);
          if (!storedEmbed) {
            await interaction.reply({
              content: `embed **"${name}"** not found`,
            });
            return;
          }

          const previewEmbed = embedService.buildDiscordEmbed(storedEmbed);

          await interaction.reply({
            content: `preview of **"${name}"**:`,
            embeds: [previewEmbed],
          });
          break;
        }

        case 'send': {
          const name = interaction.options
            .getString('name', true)
            .toLowerCase();
          const targetChannel = interaction.options.getChannel('channel');

          const storedEmbed = embedService.getEmbed(guildId, name);
          if (!storedEmbed) {
            await interaction.reply({
              content: `embed **"${name}"** not found`,
            });
            return;
          }

          const channel = targetChannel || interaction.channel;

          if (!channel || !('send' in channel)) {
            await interaction.reply({
              content: 'unable to send to this channel type',
            });
            return;
          }

          const embedToSend = embedService.buildDiscordEmbed(storedEmbed);

          await channel.send({ embeds: [embedToSend] });

          await interaction.reply({
            content: `sent embed **"${name}"** to ${channel}`,
          });

          logger.info(`sent embed "${name}" to channel ${channel.id}`);
          break;
        }

        case 'json': {
          const jsonString = interaction.options.getString('data', true);
          const saveName = interaction.options.getString('name')?.toLowerCase();

          try {
            let data = JSON.parse(jsonString);

            // handle different json formats
            if (
              data.embeds &&
              Array.isArray(data.embeds) &&
              data.embeds.length > 0
            ) {
              data = data.embeds[0];
            } else if (data.embed && typeof data.embed === 'object') {
              data = data.embed;
            }

            const hasContent = !!(
              data.title ||
              data.description ||
              data.author?.name ||
              data.footer?.text ||
              (data.fields &&
                Array.isArray(data.fields) &&
                data.fields.length > 0)
            );

            if (!hasContent) {
              await interaction.reply({
                content:
                  'embed must have at least one of: title, description, author, footer, or fields',
              });
              return;
            }

            const testEmbed = EmbedBuilder.from(data);

            if (saveName) {
              const result = embedService.createEmbed(
                guildId,
                guildName,
                saveName,
                interaction.user.id,
                data
              );

              if (!result.success) {
                await interaction.reply({
                  content: result.message,
                });
                return;
              }

              await interaction.reply({
                content: `created embed **"${saveName}"** from JSON`,
                embeds: [testEmbed],
              });

              logger.info(
                `created embed "${saveName}" from JSON in ${guildName}`
              );
            } else {
              await interaction.reply({
                embeds: [testEmbed],
              });
            }
          } catch (error) {
            logger.error('error parsing embed JSON:', error);
            await interaction.reply({
              content: 'invalid JSON format or embed structure',
            });
          }
          break;
        }
      }
    } catch (error) {
      logger.error('error in embed command:', error);

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

function createEditButtons(
  embedName: string
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_edit_basic_${embedName}`)
      .setLabel('title & description')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_edit_color_${embedName}`)
      .setLabel('color')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_edit_author_${embedName}`)
      .setLabel('author')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_edit_footer_${embedName}`)
      .setLabel('footer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_edit_images_${embedName}`)
      .setLabel('images')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_edit_fields_${embedName}`)
      .setLabel('fields')
      .setStyle(ButtonStyle.Primary)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_edit_json_${embedName}`)
      .setLabel('paste JSON')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_edit_done_${embedName}`)
      .setLabel('done')
      .setStyle(ButtonStyle.Success)
  );

  return [row1, row2, row3];
}

async function handleEditButtons(
  interaction: ChatInputCommandInteraction,
  embedName: string
): Promise<void> {
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: "you can't edit someone else's embed!",
      });
      return;
    }

    const embedService = serviceManager.getEmbedService();
    const [, , action, name] = i.customId.split('_');

    if (name !== embedName) return;

    try {
      switch (action) {
        case 'basic': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_basic_${embedName}`)
            .setTitle('edit title & description');

          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );

          const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setValue(storedEmbed?.data.title || '');

          const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000)
            .setValue(storedEmbed?.data.description || '');

          const urlInput = new TextInputBuilder()
            .setCustomId('url')
            .setLabel('url (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.url || '');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              descriptionInput
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput)
          );

          await i.showModal(modal);
          break;
        }

        case 'color': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_color_${embedName}`)
            .setTitle('edit color');

          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );
          const currentColor = storedEmbed?.data.color
            ? `#${storedEmbed.data.color.toString(16).padStart(6, '0')}`
            : '';

          const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('color (hex code like #FF5733 or color name)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(20)
            .setValue(currentColor)
            .setPlaceholder('#FF5733 or "red"');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput)
          );

          await i.showModal(modal);
          break;
        }

        case 'author': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_author_${embedName}`)
            .setTitle('edit author');

          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('author name')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setValue(storedEmbed?.data.author?.name || '');

          const iconInput = new TextInputBuilder()
            .setCustomId('icon_url')
            .setLabel('author icon url')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.author?.icon_url || '');

          const urlInput = new TextInputBuilder()
            .setCustomId('url')
            .setLabel('author url')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.author?.url || '');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput)
          );

          await i.showModal(modal);
          break;
        }

        case 'footer': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_footer_${embedName}`)
            .setTitle('edit footer');

          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );

          const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('footer text')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048)
            .setValue(storedEmbed?.data.footer?.text || '');

          const iconInput = new TextInputBuilder()
            .setCustomId('icon_url')
            .setLabel('footer icon url')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.footer?.icon_url || '');

          const timestampInput = new TextInputBuilder()
            .setCustomId('timestamp')
            .setLabel('add timestamp? (yes/no)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(3)
            .setValue(storedEmbed?.data.timestamp ? 'yes' : 'no');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              timestampInput
            )
          );

          await i.showModal(modal);
          break;
        }

        case 'images': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_images_${embedName}`)
            .setTitle('edit images');

          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );

          const imageInput = new TextInputBuilder()
            .setCustomId('image')
            .setLabel('main image url')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.image?.url || '');

          const thumbnailInput = new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel('thumbnail url (small image)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(storedEmbed?.data.thumbnail?.url || '');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              thumbnailInput
            )
          );

          await i.showModal(modal);
          break;
        }

        case 'fields': {
          const storedEmbed = embedService.getEmbed(
            interaction.guildId!,
            embedName
          );
          const currentFields = storedEmbed?.data.fields || [];

          if (currentFields.length >= 25) {
            await i.reply({
              content: 'this embed already has the maximum of 25 fields!',
            });
            return;
          }

          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_field_${embedName}`)
            .setTitle('add field');

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('field name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256);

          const valueInput = new TextInputBuilder()
            .setCustomId('value')
            .setLabel('field value')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1024);

          const inlineInput = new TextInputBuilder()
            .setCustomId('inline')
            .setLabel('inline? (yes/no)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(3)
            .setValue('no');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(inlineInput)
          );

          await i.showModal(modal);
          break;
        }

        case 'json': {
          const modal = new ModalBuilder()
            .setCustomId(`embed_modal_json_${embedName}`)
            .setTitle('paste JSON (overwrites all)');

          const jsonInput = new TextInputBuilder()
            .setCustomId('json')
            .setLabel('embed JSON data')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('{"title": "example", "description": "..."}');

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(jsonInput)
          );

          await i.showModal(modal);
          break;
        }

        case 'done': {
          await i.update({
            content: `finished editing embed **"${embedName}"**`,
            components: [],
          });
          collector.stop();
          break;
        }
      }
    } catch (error) {
      logger.error('error handling embed button:', error);
      if (!i.replied && !i.deferred) {
        await i.reply({
          content: 'an error occurred',
        });
      }
    }
  });

  collector.on('end', () => {
    logger.debug(`embed edit session ended for ${embedName}`);
  });
}

async function handleModalSubmit(
  interaction: any,
  embedName: string,
  modalType: string
): Promise<void> {
  const embedService = serviceManager.getEmbedService();
  const guildId = interaction.guildId!;

  try {
    let updateResult: { success: boolean; message: string };

    switch (modalType) {
      case 'basic': {
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const url = interaction.fields.getTextInputValue('url');

        const storedEmbed = embedService.getEmbed(guildId, embedName)!;
        const updatedData = { ...storedEmbed.data };

        if (title) updatedData.title = title;
        else delete updatedData.title;

        if (description) updatedData.description = description;
        else delete updatedData.description;

        if (url) updatedData.url = url;
        else delete updatedData.url;

        updateResult = embedService.updateEmbed(
          guildId,
          embedName,
          updatedData,
          interaction.user.id
        );
        break;
      }

      case 'color': {
        const colorValue = interaction.fields.getTextInputValue('color');
        let color: ColorResolvable | undefined;

        if (colorValue) {
          if (colorValue.startsWith('#')) {
            color = parseInt(colorValue.slice(1), 16);
          } else {
            // try to parse as color name
            const colorNames: Record<string, number> = {
              red: 0xff0000,
              green: 0x00ff00,
              blue: 0x0000ff,
              yellow: 0xffff00,
              orange: 0xffa500,
              purple: 0x800080,
              pink: 0xffc0cb,
              black: 0x000000,
              white: 0xffffff,
              gray: 0x808080,
              grey: 0x808080,
            };
            color = colorNames[colorValue.toLowerCase()] || 0xfaf0e7;
          }
        }

        updateResult = embedService.updateEmbedField(
          guildId,
          embedName,
          'color',
          color,
          interaction.user.id
        );
        break;
      }

      case 'author': {
        const name = interaction.fields.getTextInputValue('name');
        const icon_url = interaction.fields.getTextInputValue('icon_url');
        const url = interaction.fields.getTextInputValue('url');

        const author = name ? { name, icon_url, url } : undefined;

        updateResult = embedService.updateEmbedField(
          guildId,
          embedName,
          'author',
          author,
          interaction.user.id
        );
        break;
      }

      case 'footer': {
        const text = interaction.fields.getTextInputValue('text');
        const icon_url = interaction.fields.getTextInputValue('icon_url');
        const timestampValue =
          interaction.fields.getTextInputValue('timestamp');

        const footer = text ? { text, icon_url } : undefined;

        const storedEmbed = embedService.getEmbed(guildId, embedName)!;
        const updatedData = { ...storedEmbed.data };

        if (footer) updatedData.footer = footer;
        else delete updatedData.footer;

        if (timestampValue?.toLowerCase() === 'yes') {
          updatedData.timestamp = new Date().toISOString();
        } else {
          delete updatedData.timestamp;
        }

        updateResult = embedService.updateEmbed(
          guildId,
          embedName,
          updatedData,
          interaction.user.id
        );
        break;
      }

      case 'images': {
        const imageUrl = interaction.fields.getTextInputValue('image');
        const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail');

        const storedEmbed = embedService.getEmbed(guildId, embedName)!;
        const updatedData = { ...storedEmbed.data };

        if (imageUrl) updatedData.image = { url: imageUrl };
        else delete updatedData.image;

        if (thumbnailUrl) updatedData.thumbnail = { url: thumbnailUrl };
        else delete updatedData.thumbnail;

        updateResult = embedService.updateEmbed(
          guildId,
          embedName,
          updatedData,
          interaction.user.id
        );
        break;
      }

      case 'field': {
        const name = interaction.fields.getTextInputValue('name');
        const value = interaction.fields.getTextInputValue('value');
        const inlineValue = interaction.fields.getTextInputValue('inline');

        const inline = inlineValue?.toLowerCase() === 'yes';

        updateResult = embedService.addEmbedField(
          guildId,
          embedName,
          { name, value, inline },
          interaction.user.id
        );
        break;
      }

      case 'json': {
        const jsonString = interaction.fields.getTextInputValue('json');

        try {
          let data = JSON.parse(jsonString);

          if (
            data.embeds &&
            Array.isArray(data.embeds) &&
            data.embeds.length > 0
          ) {
            data = data.embeds[0];
          } else if (data.embed && typeof data.embed === 'object') {
            data = data.embed;
          }

          const hasContent = !!(
            data.title ||
            data.description ||
            data.author?.name ||
            data.footer?.text ||
            (data.fields &&
              Array.isArray(data.fields) &&
              data.fields.length > 0)
          );

          if (!hasContent) {
            updateResult = {
              success: false,
              message:
                'embed must have at least one of: title, description, author, footer, or fields',
            };
          } else {
            updateResult = embedService.updateEmbed(
              guildId,
              embedName,
              data,
              interaction.user.id
            );
          }
        } catch (error) {
          updateResult = {
            success: false,
            message: 'invalid JSON format',
          };
        }
        break;
      }

      default:
        updateResult = { success: false, message: 'unknown modal type' };
    }

    if (updateResult.success) {
      const updatedEmbed = embedService.getEmbed(guildId, embedName)!;
      const preview = embedService.buildDiscordEmbed(updatedEmbed);

      await interaction.update({
        embeds: [preview],
      });
    } else {
      await interaction.reply({
        content: updateResult.message,
      });
    }
  } catch (error) {
    logger.error('error handling modal submit:', error);
    await interaction.reply({
      content: 'an error occurred while updating the embed',
    });
  }
}

// add modal handler to client events
export function setupModalHandler(client: any): void {
  client.on('interactionCreate', async (interaction: any) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('embed_modal_')) {
      const parts = interaction.customId.split('_');
      const modalType = parts[2];
      const embedName = parts.slice(3).join('_');

      await handleModalSubmit(interaction, embedName, modalType);
    }
  });
}

export default embed;
