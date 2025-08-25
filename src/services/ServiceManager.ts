import { ConfigService } from './config/ConfigService';
import { MemoryService } from './memory/MemoryService';
import { AIService } from './ai/AIService';
import { EconomyService } from './economy/EconomyService';
import { AutoresponderService } from './autoresponder/AutoresponderService';
import { EmbedService } from './embed/EmbedService';
import { GreetService } from './greet/GreetService';

import { logger } from '../utils/logger';

class ServiceManager {
  private static instance: ServiceManager;
  private configService: ConfigService | null = null;
  private memoryService: MemoryService | null = null;
  private aiService: AIService | null = null;
  private economyService: EconomyService | null = null;
  private autoresponderService: AutoresponderService | null = null;
  private embedService: EmbedService | null = null;
  private greetService: GreetService | null = null;

  private constructor() {
    // private constructor for singleton
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
      logger.debug('created new ServiceManager instance');
    }
    return ServiceManager.instance;
  }

  public getConfigService(): ConfigService {
    if (!this.configService) {
      this.configService = new ConfigService();
      logger.debug('initialized ConfigService');
    }
    return this.configService;
  }

  public getMemoryService(): MemoryService {
    if (!this.memoryService) {
      this.memoryService = new MemoryService(this.getConfigService());
      logger.debug('initialized MemoryService');
    }
    return this.memoryService;
  }

  public getAIService(): AIService {
    if (!this.aiService) {
      this.aiService = new AIService(this.getConfigService());
      logger.debug('initialized AIService');
    }
    return this.aiService;
  }

  public getEconomyService(): EconomyService {
    if (!this.economyService) {
      this.economyService = new EconomyService();
      logger.debug('initialized EconomyService');
    }
    return this.economyService;
  }

  public getAutoresponderService(): AutoresponderService {
    if (!this.autoresponderService) {
      this.autoresponderService = new AutoresponderService();
      logger.debug('initialized AutoresponderService');
    }
    return this.autoresponderService;
  }

  public getEmbedService(): EmbedService {
    if (!this.embedService) {
      this.embedService = new EmbedService();
      logger.debug('initialized EmbedService');
    }
    return this.embedService;
  }

  public getGreetService(): GreetService {
    if (!this.greetService) {
      this.greetService = new GreetService();
      logger.debug('initialized GreetService');
    }
    return this.greetService;
  }

  // reset services when needed
  public resetServices(): void {
    this.configService = null;
    this.memoryService = null;
    this.aiService = null;
    this.economyService = null;
    this.autoresponderService = null;
    this.embedService = null;
    this.greetService = null;
    logger.info('reset all services');
  }
}

export const serviceManager = ServiceManager.getInstance();
