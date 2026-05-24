import { notConfigured } from "../integrationTypes";
import type { PaymentTerminalProvider, TerminalPaymentRequest, TerminalPaymentResult } from "./paymentTerminal.types";

export class StripeTerminalProvider implements PaymentTerminalProvider {
  async collectPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResult> {
    void request;
    const result = notConfigured<TerminalPaymentResult>("Stripe Terminal is not configured. Use manual payment recording.");
    return { approved: false, message: result.message };
  }
}
