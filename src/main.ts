import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';

const DEFAULT_PORT = 3000;

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
setupApp(app);
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? DEFAULT_PORT), '0.0.0.0');
