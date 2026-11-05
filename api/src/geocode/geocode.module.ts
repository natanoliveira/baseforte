import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GeocodeController } from './geocode.controller';
import { GEOCODE_QUEUE, GeocodeProcessor } from './geocode.processor';
import { GeocodeService } from './geocode.service';
import { NominatimClient } from './nominatim.client';

const redis = () => {
  const u = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return { host: u.hostname, port: Number(u.port || 6379) };
};

@Module({
  imports: [BullModule.forRoot({ connection: redis() }), BullModule.registerQueue({ name: GEOCODE_QUEUE })],
  controllers: [GeocodeController],
  // GEOCODE_WORKER=off desliga o worker (testes não consomem a fila real).
  providers: [GeocodeService, NominatimClient, ...(process.env.GEOCODE_WORKER === 'off' ? [] : [GeocodeProcessor])],
})
export class GeocodeModule {}
