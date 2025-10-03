import * as fs from 'fs';
import * as path from 'path';
import {
  GuildEconomy,
  UserBalance,
  EconomyTransaction,
} from '../../types/economy';

import { logger } from '../../utils/logger';
import { GuildDataService } from '../base/GuildDataService';

export class EconomyService extends GuildDataService<GuildEconomy> {
  private economyPath: string;

  constructor() {
    super('economy/guilds');
    this.economyPath = path.join(process.cwd(), 'data', 'economy');
    this.ensureEconomyDirectories();
  }

  protected getServiceName(): string {
    return 'guild economies';
  }

  private ensureEconomyDirectories(): void {
    const dirs = [
      path.join(this.economyPath, 'transactions'),
      path.join(this.economyPath, 'global'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`created directory: ${dir}`);
      }
    }
  }

  private initializeGuildEconomy(
    guildId: string,
    guildName: string
  ): GuildEconomy {
    const economy: GuildEconomy = {
      guildId,
      guildName,
      currency: {
        name: 'curds',
        emoji: '🧀',
      },
      users: {},
      settings: {
        startingBalance: 0,
        patMinReward: 20,
        patMaxReward: 60,
        patCooldownMinutes: 60,
        fishBaseReward: 40,
        fishCooldownMinutes: 60,
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    this.dataCache.set(guildId, economy);
    this.queueSave(guildId);

    logger.info(`initialized economy for guild ${guildId}`);
    return economy;
  }

  private ensureUserExists(economy: GuildEconomy, userId: string): UserBalance {
    if (!economy.users[userId]) {
      economy.users[userId] = {
        userId,
        balance: economy.settings.startingBalance,
        lastUpdated: new Date().toISOString(),
      };
      economy.lastModified = new Date().toISOString();
    }
    return economy.users[userId];
  }

  async getBalance(
    guildId: string,
    guildName: string,
    userId: string
  ): Promise<UserBalance> {
    let economy = this.dataCache.get(guildId);

    if (!economy) {
      economy = this.initializeGuildEconomy(guildId, guildName);
    }

    const userBalance = this.ensureUserExists(economy, userId);
    return { ...userBalance };
  }

  async addBalance(
    guildId: string,
    guildName: string,
    userId: string,
    amount: number,
    description: string = 'earned'
  ): Promise<UserBalance> {
    let economy = this.dataCache.get(guildId);

    if (!economy) {
      economy = this.initializeGuildEconomy(guildId, guildName);
    }

    const userBalance = this.ensureUserExists(economy, userId);
    const balanceBefore = userBalance.balance;

    userBalance.balance += amount;
    userBalance.lastUpdated = new Date().toISOString();

    economy.lastModified = new Date().toISOString();
    this.queueSave(guildId);

    // log transaction
    await this.logTransaction({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      guildId,
      amount,
      type: amount > 0 ? 'earn' : 'spend',
      description,
      timestamp: new Date().toISOString(),
      balanceBefore,
      balanceAfter: userBalance.balance,
    });

    return { ...userBalance };
  }

  async setBalance(
    guildId: string,
    guildName: string,
    userId: string,
    newBalance: number
  ): Promise<UserBalance> {
    let economy = this.dataCache.get(guildId);

    if (!economy) {
      economy = this.initializeGuildEconomy(guildId, guildName);
    }

    const userBalance = this.ensureUserExists(economy, userId);
    const balanceBefore = userBalance.balance;

    userBalance.balance = newBalance;
    userBalance.lastUpdated = new Date().toISOString();

    economy.lastModified = new Date().toISOString();
    this.queueSave(guildId);

    // log transaction
    await this.logTransaction({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      guildId,
      amount: newBalance - balanceBefore,
      type: 'admin',
      description: 'balance set by admin',
      timestamp: new Date().toISOString(),
      balanceBefore,
      balanceAfter: userBalance.balance,
    });

    return { ...userBalance };
  }

  async getTopBalances(
    guildId: string,
    limit: number = 10
  ): Promise<UserBalance[]> {
    const economy = this.dataCache.get(guildId);
    if (!economy) return [];

    const balances = Object.values(economy.users)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    return balances.map((balance) => ({ ...balance }));
  }

  getGuildEconomy(guildId: string): GuildEconomy | undefined {
    const economy = this.dataCache.get(guildId);
    return economy ? { ...economy } : undefined;
  }

  updateGuildSettings(
    guildId: string,
    settings: Partial<GuildEconomy['settings']>
  ): void {
    const economy = this.dataCache.get(guildId);
    if (!economy) return;

    economy.settings = { ...economy.settings, ...settings };
    economy.lastModified = new Date().toISOString();
    this.queueSave(guildId);
  }

  updateCurrency(
    guildId: string,
    currency: Partial<GuildEconomy['currency']>
  ): void {
    const economy = this.dataCache.get(guildId);
    if (!economy) return;

    economy.currency = { ...economy.currency, ...currency };
    economy.lastModified = new Date().toISOString();
    this.queueSave(guildId);
  }

  private async logTransaction(transaction: EconomyTransaction): Promise<void> {
    // log to console, long-term logging to be implemented
    logger.debug(
      `transaction: ${transaction.userId} ${transaction.type} ${transaction.amount} in ${transaction.guildId}`
    );
  }

  getStats(): {
    totalGuilds: number;
    totalUsers: number;
    totalBalance: number;
  } {
    let totalUsers = 0;
    let totalBalance = 0;

    for (const economy of this.dataCache.values()) {
      const users = Object.values(economy.users);
      totalUsers += users.length;
      totalBalance += users.reduce((sum, user) => sum + user.balance, 0);
    }

    return {
      totalGuilds: this.dataCache.size,
      totalUsers,
      totalBalance,
    };
  }
}
