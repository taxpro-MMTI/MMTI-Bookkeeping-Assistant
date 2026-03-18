
import { ParsedResult, ReconciliationReport } from "../types";
import { parseCSV } from "./fileHelpers";

export const parseGeminiResponse = (text: string, fileName: string): ParsedResult => {
  const result: ParsedResult = { 
    checklist: [], 
    csvRaw: "", 
    csvData: [], 
    issues: "", 
    sources: [], 
    reconciliationReports: [] 
  };
  
  if (!text) return result;

  const lines = text.split('\n');
  const checklist: string[] = [];
  let inChecklist = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().includes('checklist')) { inChecklist = true; continue; }
    if (inChecklist) {
        if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
            checklist.push(line.replace(/^[-*\d\.]+\s*/, ''));
        } else if (line === '' && checklist.length > 0) { inChecklist = false; }
    }
  }
  result.checklist = checklist;

  // Extract Sources
  const sourcesMatch = text.match(/\[Research Sources\]([\s\S]*)/i);
  if (sourcesMatch) {
    result.sources = sourcesMatch[1].trim().split('\n').map(s => s.trim()).filter(s => s);
  }

  // Extract CSV
  const headerSignature = '"Bank Account Name/Number","Date"';
  const headerIndex = text.indexOf(headerSignature);
  if (headerIndex !== -1) {
    const textAfterHeader = text.substring(headerIndex);
    const issuesIndexRelative = textAfterHeader.search(/\n\s*(\[Reconciliation|\[Issues|Issues|Unresolved)/i);
    let csvBlock = issuesIndexRelative !== -1 ? textAfterHeader.substring(0, issuesIndexRelative).trim() : textAfterHeader.trim();
    result.csvRaw = csvBlock;
    result.csvData = parseCSV(csvBlock);
  }

  // Extract Reconciliation Status and Business Name
  const reconMatch = text.match(/\[Reconciliation Status\]\s*([\s\S]*?)(?=\[Issues|$)/i);
  if (reconMatch) {
    const reconText = reconMatch[1].trim();
    const isPassed = reconText.toUpperCase().includes('STATUS: PASSED');
    
    // Extract business name for file naming
    const bizMatch = reconText.match(/Business:\s*(.*?)(?:,|$)/i);
    if (bizMatch) {
      result.businessName = bizMatch[1].trim();
    }

    const report: ReconciliationReport = {
      statementName: fileName,
      status: isPassed ? 'PASSED' : 'FAILED',
    };

    if (!isPassed) {
      const bankInfo = reconText.match(/Bank:\s*(.*?),/i)?.[1];
      const diff = reconText.match(/Diff:\s*(.*?),/i)?.[1];
      const reason = reconText.match(/Reason:\s*(.*)$/i)?.[1];
      report.bankInfo = bankInfo;
      report.difference = diff;
      report.reason = reason;
    }
    result.reconciliationReports.push(report);
  }

  // Extract Issues
  const issuesMatch = text.match(/\[Issues Section\]([\s\S]*)/i);
  if (issuesMatch) {
    result.issues = issuesMatch[1].trim();
  }

  return result;
};
