import * as fs from 'fs';
import * as path from 'path';

import { AIConfig } from '../../types/ai';
import { FilterConfig } from '../../utils/wordFilter';
import { BotConfig, MemoryConfig } from '../../types/config';
import { logger } from '../../utils/logger';

export class ConfigService {
  private configPath: string;
  private aiConfig!: AIConfig;
  private botConfig!: BotConfig;
  private memoryConfig!: MemoryConfig;
  private filterConfig!: FilterConfig;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config');
    this.loadConfigurations();
  }

  private loadConfigurations(): void {
    try {
      // load ai config
      const aiConfigPath = this.findConfigFile('ai.json');
      this.aiConfig = this.loadJsonFile(aiConfigPath);
      logger.debug('loaded ai configuration');

      // load bot config
      const botConfigPath = this.findConfigFile('bot.json');
      this.botConfig = this.loadJsonFile(botConfigPath);
      logger.debug('loaded bot configuration');

      // load memory config
      const memoryConfigPath = this.findConfigFile('memory.json');
      this.memoryConfig = this.loadJsonFile(memoryConfigPath);
      logger.debug('loaded memory configuration');

      const filterConfigPath = this.findConfigFile('filter.json');
      this.filterConfig = this.loadJsonFile(filterConfigPath);
      logger.debug('loaded filter configuration');

      // override with environment variables if set
      this.applyEnvironmentOverrides();

      logger.success('all configurations loaded successfully');
    } catch (error) {
      logger.error('failed to load configurations:', error);
      throw error;
    }
  }

  private findConfigFile(filename: string): string {
    // check user config first
    const userPath = path.join(this.configPath, filename);
    if (fs.existsSync(userPath)) {
      return userPath;
    }

    // fall back to default config
    const defaultPath = path.join(this.configPath, 'default', filename);
    if (fs.existsSync(defaultPath)) {
      logger.debug(`using default config for ${filename}`);
      return defaultPath;
    }

    throw new Error(`configuration file not found: ${filename}`);
  }

  private loadJsonFile<T>(filepath: string): T {
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`failed to load ${filepath}: ${error}`);
    }
  }

  private applyEnvironmentOverrides(): void {
    // override ai provider settings from environment
    if (process.env.AI_PROVIDER) {
      this.aiConfig.provider = process.env.AI_PROVIDER as 'local' | 'openai';
    }

    if (process.env.AI_API_URL) {
      this.aiConfig.apiUrl = process.env.AI_API_URL;
    }

    if (process.env.AI_API_KEY) {
      this.aiConfig.apiKey = process.env.AI_API_KEY;
    }
  }

  getAIConfig(): AIConfig {
    return { ...this.aiConfig };
  }

  getBotConfig(): BotConfig {
    return { ...this.botConfig };
  }

  getMemoryConfig(): MemoryConfig {
    return { ...this.memoryConfig };
  }

  getFilterConfig(): FilterConfig {
    return { ...this.filterConfig };
  }

  // update config methods for runtime changes
  updateAIConfig(updates: Partial<AIConfig>): void {
    this.aiConfig = { ...this.aiConfig, ...updates };
    logger.info('ai configuration updated');
  }

  updateBotConfig(updates: Partial<BotConfig>): void {
    this.botConfig = { ...this.botConfig, ...updates };
    logger.info('bot configuration updated');
  }

  updateMemoryConfig(updates: Partial<MemoryConfig>): void {
    this.memoryConfig = { ...this.memoryConfig, ...updates };
    logger.info('memory configuration updated');
  }

  updateFilterConfig(updates: Partial<FilterConfig>): void {
    this.filterConfig = { ...this.filterConfig, ...updates };
    logger.info('filter config updated!');
  }

  // save configurations back to files
  saveAIConfig(): void {
    const filepath = path.join(this.configPath, 'ai.json');
    fs.writeFileSync(filepath, JSON.stringify(this.aiConfig, null, 2));
    logger.info('ai configuration saved');
  }

  saveBotConfig(): void {
    const filepath = path.join(this.configPath, 'bot.json');
    fs.writeFileSync(filepath, JSON.stringify(this.botConfig, null, 2));
    logger.info('bot configuration saved');
  }

  saveMemoryConfig(): void {
    const filepath = path.join(this.configPath, 'memory.json');
    fs.writeFileSync(filepath, JSON.stringify(this.memoryConfig, null, 2));
    logger.info('memory configuration saved');
  }

  saveFilterConfig(): void {
    const filepath = path.join(this.configPath, 'filter.json');
    fs.writeFileSync(filepath, JSON.stringify(this.filterConfig, null, 2));
    logger.info('filter config saved!');
  }
}
