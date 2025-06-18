import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';

const messageCreate: Event = {
  name: Events.MessageCreate,
  once: false,

  async execute(message: Message) {
    // ignore bot messages
    if (message.author.bot) return;

    // check if bot is mentioned or if this is a DM
    const isMentioned = message.mentions.has(message.client.user!);
    const isDM = message.channel.type === ChannelType.DM;

    if (!isMentioned && !isDM) return;

    try {
      if ('send' in message.channel) {
        // set typing indicator
        message.channel.sendTyping();
      }

      // placeholder for AI response - will be implemented when AI service is ready
      logger.info(
        `message received from [${message.author.tag}|${message.author.id}]: ${message.content}`
      );

      // temporary response
      await message.reply(
        "hey! i'm still being set up. check back soon for actual conversations!"
      );
    } catch (error) {
      logger.error('error handling message:', error);

      try {
        await message.reply(
          'sorry, i encountered an error while processing your message.'
        );
      } catch (replyError) {
        logger.error('failed to send error message:', replyError);
      }
    }
  },
};

export default messageCreate;
