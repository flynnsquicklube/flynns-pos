export interface TerminalPaymentRequest { ticketId: string; amount: number; methodHint?: string; }
export interface TerminalPaymentResult { approved: boolean; reference?: string; message: string; }
export interface PaymentTerminalProvider { collectPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResult>; }

export interface TerminalCheckoutRequest {
  ticketId: string;
  amount: number;
  idempotencyKey: string;
}

export interface TerminalCheckoutStatus {
  ok: boolean;
  status: "disabled" | "not_configured" | "pending" | "completed" | "canceled" | "error";
  message: string;
  requestId?: string;
}
