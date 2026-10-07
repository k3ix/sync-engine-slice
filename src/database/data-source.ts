import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.options.js';

if (existsSync('.env')) {
  process.loadEnvFile();
}
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}

export default new DataSource(databaseOptions(url));
