import { ISmsStatusProvider, SmsStatusResponse } from "./types";
import { SmsStatus } from "@/types/orderflow";

/**
 * Mock Ping4SMS Provider for testing and local development
 * Returns realistic simulated Ping4SMS responses without external network dependencies.
 */
export class MockSmsStatusProvider implements ISmsStatusProvider {
  name = "Mock Ping4SMS Provider (Development)";

  async fetchStatus(messageId: string): Promise<SmsStatusResponse> {
    // Artificial slight network latency
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (messageId.includes("ERR") || messageId.endsWith("9")) {
      return {
        messageId,
        status: "FAILED" as SmsStatus,
        mobile: "+91 98401 23456",
        providerCode: "UNDELIV_DND_REJECTED",
        rawResponse: {
          code: 4001,
          status: "FAILED",
          error: "Mobile number registered on National DND registry",
          operator: "Airtel",
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (messageId.includes("REQ") || messageId.endsWith("7")) {
      return {
        messageId,
        status: "PENDING" as SmsStatus,
        mobile: "+91 98402 34567",
        providerCode: "AWAITING_TELCO_DLR",
        rawResponse: {
          code: 1002,
          status: "QUEUED",
          operator: "Jio",
          timestamp: new Date().toISOString(),
        },
      };
    }

    return {
      messageId,
      status: "SENT" as SmsStatus,
      mobile: "+91 98403 45678",
      deliveredAt: new Date().toISOString(),
      providerCode: "DELIVRD_ACK",
      rawResponse: {
        code: 2000,
        status: "DELIVRD",
        operator: "Vodafone Idea",
        timestamp: new Date().toISOString(),
      },
    };
  }

  async fetchBatchStatuses(messageIds: string[]): Promise<SmsStatusResponse[]> {
    return Promise.all(messageIds.map((id) => this.fetchStatus(id)));
  }
}
