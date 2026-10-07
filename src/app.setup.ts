import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const DOCS_PATH = 'docs';

export function setupApp(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const config = new DocumentBuilder()
    .setTitle('sync-engine-slice')
    .setDescription('The write half of a Linear-style sync engine')
    .build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, config));
}
