import 'reflect-metadata';
import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
