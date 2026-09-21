import { ISmsStatusProvider, SmsStatusResponse } from "./types";
import { SmsStatus } from "@/types/orderflow";

/**
 * Ping4SMS Live Status Provider
 * Strictly read-only delivery report retrieval from Ping4SMS HTTP API.
 * NO SMS SENDING CAPABILITIES.
 */
export class Ping4SmsProvider implements ISmsStatusProvider {
  name = "Ping4SMS Live API Provider";

  private apiKey: string;
  private username: string;
  private senderId: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.PING4SMS_API_KEY || "";
    this.username = process.env.PING4SMS_USERNAME || "";
    this.senderId = process.env.PING4SMS_SENDER_ID || "";
    this.apiUrl = process.env.PING4SMS_API_URL || "https://api.ping4sms.com/api/v2/dlr";
  }

  async fetchStatus(messageId: string): Promise<SmsStatusResponse> {
    if (!this.apiKey) {
      throw new Error("Ping4SMS API key is not configured. Set PING4SMS_API_KEY in environment variables.");
    }

    const url = new URL(this.apiUrl);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("username", this.username);
    url.searchParams.set("msgid", messageId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Ping4SMS status inquiry failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const rawStatus = (data.status || data.delivery_status || "").toUpperCase();

    let status: SmsStatus = "PENDING";
    if (rawStatus === "DELIVRD" || rawStatus === "DELIVERED" || rawStatus === "SUCCESS") {
      status = "SENT";
    } else if (rawStatus === "FAILED" || rawStatus === "UNDELIV" || rawStatus === "REJECTED") {
      status = "FAILED";
    }

    return {
      messageId,
      status,
      mobile: data.mobile || data.destination || "",
      deliveredAt: data.delivered_at || (status === "SENT" ? new Date().toISOString() : undefined),
      providerCode: rawStatus,
      rawResponse: data,
    };
  }

  async fetchBatchStatuses(messageIds: string[]): Promise<SmsStatusResponse[]> {
    return Promise.all(messageIds.map((id) => this.fetchStatus(id)));
  }
}
