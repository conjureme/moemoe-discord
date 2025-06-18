import { ExtendedClient } from './client';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

// load environment variables
dotenv.config();

const { BOT_TOKEN } = process.env;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required in environment variables');
  process.exit(1);
}

// create the client
const client = new ExtendedClient();

// handle process events for graceful shutdown
process.on('SIGINT', () => {
  logger.info('received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error('unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception:', error);
  // give the logger time to write
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// start the bot
async function startBot() {
  logger.info('starting bot...');

  try {
    // initialize client (load commands and events)
    await client.initialize();

    // login to discord
    await client.login(BOT_TOKEN);
  } catch (error) {
    logger.error('failed to start bot:', error);
    process.exit(1);
  }
}

// run the bot
startBot();
