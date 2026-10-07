import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { databaseOptions } from './database/database.options.js';
import { HealthController } from './health.controller.js';
import { IssuesModule } from './issues/issues.module.js';
import { MembersModule } from './members/members.module.js';
import { ProjectsModule } from './projects/projects.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config.getOrThrow<string>('DATABASE_URL')),
        migrationsRun: true,
      }),
    }),
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
        }),
      ],
    }),
    ProjectsModule,
    MembersModule,
    IssuesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
