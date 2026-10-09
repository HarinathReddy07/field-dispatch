import { Module } from '@nestjs/common';
import { MockPaymentProvider, PAYMENT_PROVIDER } from './payment/payment.provider';
import { SettlementService } from './settlement.service';

/** Mock settlement ledger (one row per request, idempotent). No real payment-provider calls. */
@Module({
  providers: [
    SettlementService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }, // MOCK: no real payment gateway in the trial
  ],
  exports: [SettlementService],
})
export class SettlementModule {}
