import { sha256Hex } from '../../../domain/hash';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface CaptureInput {
  requestId: string;
  amountMinor: number;
  idempotencyKey: string;
}

export interface CaptureResult {
  providerRef: string;
  status: 'SETTLED';
}

/** Payment gateway boundary. Real capture/payout is out of scope for the trial. */
export interface PaymentProvider {
  readonly isMock: boolean;
  capture(input: CaptureInput): Promise<CaptureResult>;
}

/**
 * MOCK provider: deterministic and side-effect free. The same idempotency key always yields the same
 * reference, mirroring how a real gateway dedupes retries. No money moves.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly isMock = true;

  async capture(input: CaptureInput): Promise<CaptureResult> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)
      throw new RangeError('invalid amount');
    return {
      providerRef: `MOCK-${sha256Hex(input.idempotencyKey).slice(0, 12).toUpperCase()}`,
      status: 'SETTLED',
    };
  }
}
