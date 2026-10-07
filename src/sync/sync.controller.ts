import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChangesService } from './changes.service.js';
import { PushChangesDto } from './push-changes.dto.js';
import { SyncWorker } from './sync.worker.js';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly changes: ChangesService,
    private readonly worker: SyncWorker,
  ) {}

  @Post('changes')
  @HttpCode(HttpStatus.ACCEPTED)
  async push(@Body() dto: PushChangesDto): Promise<void> {
    await this.changes.insertBatch(dto.changes);
    void this.worker.drain();
  }
}
