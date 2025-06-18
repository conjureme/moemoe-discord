import { ClientEvents } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export class EventRegistry {
  private events: Map<keyof ClientEvents, Event> = new Map();

  async loadEvents(): Promise<Map<keyof ClientEvents, Event>> {
    const eventsPath = __dirname;

    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
      .filter((file) => file !== 'index.js' && file !== 'index.ts');

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = await import(pathToFileURL(filePath).href);

        const eventData = event.default || event[Object.keys(event)[0]];

        if (this.isValidEvent(eventData)) {
          this.events.set(eventData.name, eventData);
          logger.debug(`registered event: ${eventData.name}`);
        } else {
          logger.warn(`invalid event in ${file}`);
        }
      } catch (error) {
        logger.error(`failed to load event ${file}:`, error);
      }
    }

    return this.events;
  }

  private isValidEvent(event: any): event is Event {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.name === 'string' &&
      typeof event.execute === 'function'
    );
  }

  getEvent(name: keyof ClientEvents): Event | undefined {
    return this.events.get(name);
  }

  getAllEvents(): Map<keyof ClientEvents, Event> {
    return this.events;
  }

  getEventNames(): string[] {
    return Array.from(this.events.keys());
  }
}

export const eventRegistry = new EventRegistry();
