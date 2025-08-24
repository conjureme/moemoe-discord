import { Message, Guild, GuildMember } from 'discord.js';
import { EconomyService } from '../../economy/EconomyService';
import { AIService } from '../../ai/AIService';

export interface ProcessorContext {
  message: Message;
  guild?: Guild;
  member?: GuildMember;
  triggerArgs: string[];
  services: {
    economy?: EconomyService;
    ai?: AIService;
  };
  // for recursive processing of nested placeholders
  processNested?: (text: string) => Promise<string>;
  // metadata for action processors to communicate
  metadata?: {
    sendAsDM?: boolean;
    useEmbed?: boolean;
    embedName?: string;
    sendToChannel?: string;
    addedBalance?: number;
    [key: string]: any;
  };
}

export abstract class BaseProcessor {
  abstract name: string;
  abstract pattern: RegExp;

  abstract process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> | string;

  canProcess(text: string): boolean {
    const regex = new RegExp(this.pattern.source, this.pattern.flags);
    return regex.test(text);
  }

  getFreshPattern(): RegExp {
    return new RegExp(this.pattern.source, this.pattern.flags);
  }
}

// custom error for constraints that should cancel the response
export class ConstraintNotMetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintNotMetError';
  }
}
