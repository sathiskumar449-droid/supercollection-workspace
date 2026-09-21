import { SmsStatus } from "@/types/orderflow";

export interface SmsStatusResponse {
  messageId: string;
  status: SmsStatus;
  mobile: string;
  deliveredAt?: string;
  sentAt?: string;
  providerCode?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ISmsStatusProvider {
  name: string;
  fetchStatus(messageId: string): Promise<SmsStatusResponse>;
  fetchBatchStatuses(messageIds: string[]): Promise<SmsStatusResponse[]>;
}
