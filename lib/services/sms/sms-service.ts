import { ISmsStatusProvider } from "./types";
import { Ping4SmsProvider } from "./ping4sms-provider";
import { MockSmsStatusProvider } from "./mock-sms-provider";

class Ping4SmsService {
  private provider: ISmsStatusProvider;

  constructor() {
    // If PING4SMS_API_KEY is present and not dummy, use real provider; otherwise mock
    const hasLiveKey = Boolean(process.env.PING4SMS_API_KEY && process.env.PING4SMS_API_KEY !== "mock_key");
    this.provider = hasLiveKey ? new Ping4SmsProvider() : new MockSmsStatusProvider();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async getStatus(messageId: string) {
    return this.provider.fetchStatus(messageId);
  }

  async getBatchStatuses(messageIds: string[]) {
    return this.provider.fetchBatchStatuses(messageIds);
  }
}

export const smsService = new Ping4SmsService();
