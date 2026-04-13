import { z } from 'zod';

export const AuditReportSchema = z.object({
  document_type: z.string(),          // "Invoice" | "ID" | "Contract" | "Unknown"
  confidence: z.number().min(0).max(1),
  extracted_fields: z.record(z.string()),  // { "total": "$1,200", "date": "2026-01-15" }
  anomalies: z.array(z.object({
    field: z.string(),
    issue: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })).optional(),
  summary: z.string(),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;
