export interface TerminalPaymentRequest { ticketId: string; amount: number; methodHint?: string; }
export interface TerminalPaymentResult { approved: boolean; reference?: string; message: string; }
export interface PaymentTerminalProvider { collectPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResult>; }

