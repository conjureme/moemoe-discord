export interface UserBalance {
  userId: string;
  balance: number;
  lastUpdated: string;
}

export interface GuildEconomy {
  guildId: string;
  guildName: string;
  currency: {
    name: string;
    emoji: string;
  };
  users: Record<string, UserBalance>;
  settings: {
    startingBalance: number;
  };
  createdAt: string;
  lastModified: string;
}

export interface EconomyTransaction {
  id: string;
  userId: string;
  guildId: string;
  amount: number;
  type: 'earn' | 'spend' | 'transfer' | 'admin';
  description: string;
  timestamp: string;
  balanceBefore: number;
  balanceAfter: number;
}

// to be added
export interface GlobalUserBalance {}
