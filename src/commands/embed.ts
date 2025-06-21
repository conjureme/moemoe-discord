import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ColorResolvable,
  PermissionFlagsBits,
} from 'discord.js';

import { Command } from '../types/discord';
import { logger } from '../utils/logger';

// helper function
function buildEmbed(embedData: any): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (embedData.title) embed.setTitle(embedData.title);
  if (embedData.description) embed.setDescription(embedData.description);
  if (embedData.url) embed.setURL(embedData.url);
  if (embedData.color) {
    let color: ColorResolvable;

    if (typeof embedData.color === 'string') {
      color = embedData.color.startsWith('#')
        ? parseInt(embedData.color.slice(1), 16)
        : parseInt(embedData.color, 16);
    } else if (typeof embedData.color === 'number') {
      color = embedData.color;
    } else {
      color = 0x5865f2;
    }

    embed.setColor(color);
  }

  if (embedData.author) {
    embed.setAuthor({
      name: embedData.author.name,
      iconURL: embedData.author.icon_url || embedData.author.iconURL,
      url: embedData.author.url,
    });
  }

  if (embedData.thumbnail) {
    embed.setThumbnail(embedData.thumbnail.url || embedData.thumbnail);
  }

  if (embedData.image) {
    embed.setImage(embedData.image.url || embedData.image);
  }

  if (embedData.footer) {
    embed.setFooter({
      text: embedData.footer.text || embedData.footer,
      iconURL: embedData.footer.icon_url || embedData.footer.iconURL,
    });
  }

  if (embedData.timestamp) {
    embed.setTimestamp(
      embedData.timestamp === true ? new Date() : new Date(embedData.timestamp)
    );
  }

  if (embedData.fields && Array.isArray(embedData.fields)) {
    for (const field of embedData.fields) {
      if (field.name && field.value) {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline || false,
        });
      }
    }
  }

  return embed;
}

const embed: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('create a custom embed from JSON')
    .addStringOption((option) =>
      option
        .setName('json')
        .setDescription('embed data in JSON format')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('channel to send the embed to (defaults to current)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction) {
    const jsonString = interaction.options.getString('json', true);
    const targetChannel = interaction.options.getChannel('channel');

    try {
      const data = JSON.parse(jsonString);

      let content: string | undefined;
      let embeds: EmbedBuilder[] = [];

      if (data.embeds && Array.isArray(data.embeds)) {
        // handle discord message format
        content = data.content;

        for (const embedData of data.embeds) {
          const embed = buildEmbed(embedData);
          embeds.push(embed);
        }
      } else {
        const embed = buildEmbed(data);
        embeds.push(embed);
      }

      const channel = targetChannel || interaction.channel;

      if (!channel || !('send' in channel)) {
        await interaction.reply({
          content: 'unable to send to this channel type',
          flags: ['Ephemeral'],
        });
        return;
      }

      const messagePayload: any = {};
      if (content) messagePayload.content = content;
      if (embeds.length > 0) messagePayload.embeds = embeds;

      await channel.send(messagePayload);

      await interaction.reply({
        content: `message sent to ${channel}!`,
        flags: ['Ephemeral'],
      });

      logger.info(`embed created by ${interaction.user.tag} in ${channel.id}`);
    } catch (error) {
      logger.error('error creating embed:', error);

      let errorMessage = 'failed to create embed: ';
      if (error instanceof SyntaxError) {
        errorMessage += 'invalid JSON format';
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'unknown error';
      }

      await interaction.reply({
        content: errorMessage,
        flags: ['Ephemeral'],
      });
    }
  },
};

export default embed;
