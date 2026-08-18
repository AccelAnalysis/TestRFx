export interface ReferralTrackingRecord {
  id: string;
  status: string;
  direction: "sent" | "received";
  senderOrganization: string;
  recipientOrganization: string;
  recordId?: string;
  recordTitle?: string;
  recordType?: string;
  message?: string;
  policySummary?: string;
  feeSummary?: string;
  createdAt: string;
}
