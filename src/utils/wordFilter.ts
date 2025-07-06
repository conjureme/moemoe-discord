import { logger } from './logger';

export interface FilterConfig {
  blacklistedWords: string[];
  replaceWithTag?: string;
}

export class WordFilter {
  private blacklistedWords: Set<string>;
  private replaceWithTag: string;

  constructor(config: FilterConfig) {
    this.replaceWithTag = config.replaceWithTag || '[filtered]';

    this.blacklistedWords = new Set(
      config.blacklistedWords.map((word) => word.toLowerCase())
    );

    logger.debug(
      `word filter initialized with ${this.blacklistedWords.size} words`
    );
  }

  checkMessage(content: string): {
    isFiltered: boolean;
    filteredContent?: string;
    matchedWords?: string[];
  } {
    const words = content.split(/\s+/);
    const matchedWords: string[] = [];

    for (const word of words) {
      const noPuncWord = word.replace(
        /^[.,!?;:"'`()[\]{}]+|[.,!?;:"'`()[\]{}]+$/g,
        ''
      );
      const checkWord = noPuncWord.toLowerCase();

      if (this.blacklistedWords.has(checkWord)) {
        matchedWords.push(noPuncWord);
      }
    }

    if (matchedWords.length > 0) {
      logger.info(
        `filtered ${matchedWords.length} blacklisted: ${matchedWords.join(', ')}`
      );
      return {
        isFiltered: true,
        filteredContent: this.replaceWithTag,
        matchedWords,
      };
    }

    return { isFiltered: false };
  }

  addWord(word: string): void {
    const lowerWord = word.toLowerCase();
    this.blacklistedWords.add(lowerWord);

    logger.debug(`added word to filter blacklist: ${lowerWord}`);
  }

  removeWord(word: string): void {
    const lowerWord = word.toLowerCase();
    this.blacklistedWords.delete(lowerWord);

    logger.debug(`removed word from filter blacklist: ${lowerWord}`);
  }

  getBlacklistedWords(): string[] {
    return Array.from(this.blacklistedWords);
  }

  updateConfig(config: Partial<FilterConfig>): void {
    if (config.replaceWithTag !== undefined) {
      this.replaceWithTag = config.replaceWithTag;
    }

    if (config.blacklistedWords !== undefined) {
      this.blacklistedWords = new Set(
        config.blacklistedWords.map((word) => word.toLowerCase())
      );
    }
  }
}

// singleton
let filterInstance: WordFilter | null = null;

export function initializeWordFilter(config: FilterConfig): WordFilter {
  filterInstance = new WordFilter(config);
  return filterInstance;
}

export function getWordFilter(): WordFilter | null {
  return filterInstance;
}
