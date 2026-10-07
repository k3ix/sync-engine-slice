import type { DataSourceOptions, MixedList } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

type ClassList = MixedList<new (...args: never[]) => object>;

export const ENTITIES: ClassList = [];
export const MIGRATIONS: ClassList = [];

export function databaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  };
}
