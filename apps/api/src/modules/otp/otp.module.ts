import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { RequestsModule } from '../requests/requests.module';
import { OtpService } from './otp.service';

/** Generate / hash / store / verify the arrival OTP with TTL, single use and an attempt limit. Never persists the plain OTP. */
@Module({
  imports: [RequestsModule, DispatchModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
