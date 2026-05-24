import type { MessageRequest, MessageResult, MessagingProvider } from "./messaging.types";

export class TwilioProvider implements MessagingProvider {
  async sendMessage(request: MessageRequest): Promise<MessageResult> {
    void request;
    return { sent: false, message: "Twilio messaging is not configured." };
  }
}
