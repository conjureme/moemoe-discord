import { ConfigService } from './config/ConfigService';
import { MemoryService } from './memory/MemoryService';
import { AIService } from './ai/AIService';
import { EconomyService } from './economy/EconomyService';

import { logger } from '../utils/logger';

class ServiceManager {
  private static instance: ServiceManager;
  private configService: ConfigService | null = null;
  private memoryService: MemoryService | null = null;
  private aiService: AIService | null = null;
  private economyService: EconomyService | null = null;

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

  // reset services when needed
  public resetServices(): void {
    this.configService = null;
    this.memoryService = null;
    this.aiService = null;
    this.economyService = null;
    logger.info('reset all services');
  }
}

export const serviceManager = ServiceManager.getInstance();
