export interface MessageRequest { to: string; body: string; channel: "sms" | "email"; }
export interface MessageResult { sent: boolean; message: string; providerReference?: string; }
export interface MessagingProvider { sendMessage(request: MessageRequest): Promise<MessageResult>; }

