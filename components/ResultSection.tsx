
import React from 'react';
import { ParsedResult } from '../types';
import { Download, AlertTriangle, CheckCircle, Table as TableIcon, ListChecks, Globe, RotateCcw, ClipboardCheck, XCircle } from 'lucide-react';

interface ResultSectionProps { 
  result: ParsedResult;
  onReset: () => void;
}

const ResultSection: React.FC<ResultSectionProps> = ({ result, onReset }) => {
  const { checklist, csvData, csvRaw, issues, sources, reconciliationReports, businessName } = result;

  const downloadCSV = () => {
    // Determine file name parts: Business Name, Bank Name, Last 4
    const biz = businessName || "Business";
    
    // Extract bank info from the first data row if available (formatted as "BankName ****1234")
    const bankInfoFull = csvData.length > 1 ? csvData[1][0] : "";
    
    // Sanitize values for safe filenames
    const sanitize = (str: string) => str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    
    const sanitizedBiz = sanitize(biz);
    const sanitizedBankInfo = bankInfoFull ? sanitize(bankInfoFull.replace(/\*/g, '')) : "Statements";
    
    let filename = `${sanitizedBiz}_${sanitizedBankInfo}.csv`;
    
    const blob = new Blob([csvRaw], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); 
    link.href = url; 
    link.setAttribute('download', filename);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Reconciliation Summary Table */}
      {reconciliationReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#0e4e78] px-6 py-4 border-b border-blue-900 flex items-center justify-between">
            <div className="flex items-center">
              <ClipboardCheck className="w-5 h-5 text-blue-100 mr-2" />
              <h3 className="font-semibold text-white">Reconciliation Report</h3>
            </div>
            <span className="text-blue-100 text-xs font-bold uppercase tracking-wider">Per-Statement Verification</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-3 border-b">Document</th>
                  <th className="px-6 py-3 border-b text-center">Status</th>
                  <th className="px-6 py-3 border-b">Difference</th>
                  <th className="px-6 py-3 border-b">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationReports.map((report, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700 truncate max-w-[200px]">{report.statementName}</td>
                    <td className="px-6 py-4 text-center">
                      {report.status === 'PASSED' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          <CheckCircle className="w-3 h-3 mr-1" /> PASSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          <XCircle className="w-3 h-3 mr-1" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      {report.difference || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 italic">
                      {report.reason || (report.status === 'PASSED' ? 'All balances match extracted data.' : 'Unspecified discrepancy.')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center"><ListChecks className="w-5 h-5 text-blue-600 mr-2" /><h3 className="font-semibold text-blue-900">Task Checklist</h3></div>
          <div className="p-6"><ul className="space-y-2">{checklist.map((item, idx) => (<li key={idx} className="flex items-start text-slate-700 text-sm"><CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" /><span>{item}</span></li>))}</ul></div>
        </div>
      )}

      {csvData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center"><TableIcon className="w-5 h-5 text-slate-600 mr-2" /><h3 className="font-semibold text-slate-800">Unified Transaction List</h3><span className="ml-3 bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">{csvData.length - 1} total rows</span></div>
            <div className="flex items-center space-x-3">
              <button onClick={onReset} className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                <RotateCcw className="w-4 h-4" /><span>Clear Results</span>
              </button>
              <button onClick={downloadCSV} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"><Download className="w-4 h-4" /><span>Export Master CSV</span></button>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="bg-slate-100 text-slate-800 font-semibold uppercase text-xs"><tr>{csvData[0].map((header, i) => (<th key={i} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">{header}</th>))}</tr></thead><tbody className="divide-y divide-slate-100">{csvData.slice(1).map((row, rowIndex) => (<tr key={rowIndex} className="hover:bg-slate-50 transition-colors">{row.map((cell, cellIndex) => (<td key={cellIndex} className="px-4 py-3 whitespace-nowrap max-w-xs truncate">{cell}</td>))}</tr>))}</tbody></table></div>
        </div>
      )}

      {issues && issues.toLowerCase() !== 'no issues detected.' ? (
        <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden"><div className="px-6 py-4 border-b border-amber-100 flex items-center"><AlertTriangle className="w-5 h-5 text-amber-600 mr-2" /><h3 className="font-semibold text-amber-900">Flagged Issues (Merged)</h3></div><div className="p-6 text-amber-900 text-sm whitespace-pre-wrap leading-relaxed">{issues}</div></div>
      ) : issues && (
         <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4 flex items-center justify-center text-green-800 text-sm font-medium"><CheckCircle className="w-5 h-5 mr-2" />System checks: No significant discrepancies detected across processed files.</div>
      )}

      {sources && sources.length > 0 && (
        <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="px-6 py-4 border-b border-slate-200 flex items-center"><Globe className="w-5 h-5 text-slate-600 mr-2" /><h3 className="font-semibold text-slate-800">Research Sources</h3></div><div className="p-6"><ul className="space-y-1">{sources.map((link, idx) => (<li key={idx} className="text-sm truncate"><a href={link.replace(/^- /, '')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>{link.replace(/^- /, '')}</a></li>))}</ul></div></div>
      )}
    </div>
  );
};
export default ResultSection;
