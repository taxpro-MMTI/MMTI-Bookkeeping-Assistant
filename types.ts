
export interface FileWithPreview {
  file: File;
  preview?: string;
  id: string;
}

export interface ReconciliationReport {
  statementName: string;
  status: 'PASSED' | 'FAILED';
  difference?: string;
  reason?: string;
  bankInfo?: string;
}

export interface ParsedResult {
  checklist: string[];
  csvRaw: string;
  csvData: string[][];
  issues: string;
  sources?: string[];
  reconciliationReports: ReconciliationReport[];
  businessName?: string;
}

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';
