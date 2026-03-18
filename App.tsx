
import React, { useState, useEffect } from 'react';
import { FileWithPreview, ProcessingStatus, ParsedResult, ReconciliationReport } from './types';
import FileUploader from './components/FileUploader';
import ResultSection from './components/ResultSection';
import { processSingleStatement } from './services/geminiService';
import { parseGeminiResponse } from './utils/responseParser';
import { fileToBase64, base64ToFile } from './utils/fileHelpers';
import { Shield, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

const COA_STORAGE_KEY = 'auto_bookkeeper_coa';

function App() {
  const [statements, setStatements] = useState<FileWithPreview[]>([]);
  const [coa, setCoa] = useState<FileWithPreview[]>([]); 
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [currentStep, setCurrentStep] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coaLoaded, setCoaLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COA_STORAGE_KEY);
    if (saved) {
      try {
        const { content, name, type, id } = JSON.parse(saved);
        setCoa([{ file: base64ToFile(content, name, type), id, preview: undefined }]);
      } catch (e) { localStorage.removeItem(COA_STORAGE_KEY); }
    }
    setCoaLoaded(true);
  }, []);

  const handleCoaChange = async (files: FileWithPreview[]) => {
    setCoa(files);
    if (files.length > 0) {
      if (files[0].file.size > 4 * 1024 * 1024) return;
      try {
        const base64 = await fileToBase64(files[0].file);
        localStorage.setItem(COA_STORAGE_KEY, JSON.stringify({ name: files[0].file.name, type: files[0].file.type, content: base64, id: files[0].id }));
      } catch (e) {}
    } else {
      localStorage.removeItem(COA_STORAGE_KEY);
    }
  };

  const handleProcess = async () => {
    if (statements.length === 0) return;
    setStatus('processing'); 
    setError(null); 
    setResult(null);
    setCurrentStep({ current: 0, total: statements.length });

    const masterResult: ParsedResult = {
      checklist: [],
      csvRaw: "",
      csvData: [],
      issues: "",
      sources: [],
      reconciliationReports: [],
      businessName: ""
    };

    try {
      const coaFile = coa.length > 0 ? coa[0] : null;
      let masterCsvRows: string[][] = [];
      let masterIssues = "";

      for (let i = 0; i < statements.length; i++) {
        setCurrentStep({ current: i + 1, total: statements.length });
        const rawText = await processSingleStatement(statements[i], coaFile);
        const parsed = parseGeminiResponse(rawText, statements[i].file.name);

        // Merge Business Name (from first successful extraction)
        if (parsed.businessName && !masterResult.businessName) {
          masterResult.businessName = parsed.businessName;
        }

        // Merge CSV Data
        if (parsed.csvData.length > 0) {
          if (masterCsvRows.length === 0) {
            masterCsvRows = parsed.csvData; // Include headers from first
          } else {
            masterCsvRows = [...masterCsvRows, ...parsed.csvData.slice(1)]; // Skip headers
          }
        }

        // Merge Issues
        if (parsed.issues && parsed.issues !== "No issues detected.") {
          masterIssues += `\n--- [${statements[i].file.name}] ---\n${parsed.issues}\n`;
        }

        // Collect Checklist & Sources (unique)
        masterResult.checklist = Array.from(new Set([...masterResult.checklist, ...parsed.checklist]));
        masterResult.sources = Array.from(new Set([...(masterResult.sources || []), ...(parsed.sources || [])]));
        
        // Collect Reconciliation Reports
        masterResult.reconciliationReports.push(...parsed.reconciliationReports);
      }

      // Finalize CSV Raw from masterCsvRows
      masterResult.csvData = masterCsvRows;
      masterResult.csvRaw = masterCsvRows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      masterResult.issues = masterIssues.trim() || "No issues detected.";

      setResult(masterResult);
      setStatus('success');
    } catch (err: any) {
      setError(err.message || "Error processing documents.");
      setStatus('error');
    } finally {
      setCurrentStep(null);
    }
  };

  const handleReset = () => {
    setStatements([]);
    setResult(null);
    setStatus('idle');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-[#0e4e78] shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-white fill-white/10" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-white tracking-tight">MMTI Bookkeeping Assistant</h1>
          </div>
          <div className="hidden md:block text-blue-100 text-sm font-medium bg-white/10 px-3 py-1 rounded-full">
            Gemini 3.1 Pro Sequential Engine
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center">
                <div className="bg-[#0e4e78] text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-sm mr-3 font-semibold">1</div>
                Upload Documents
              </h2>
              <FileUploader label="Bank Statements" description="PDF, CSV, Excel or Images." accept=".pdf,.csv,.xlsx,.xls,image/*" multiple={true} files={statements} onFilesChange={setStatements} />
              {coaLoaded && ( <FileUploader label="Chart of Accounts" description="Saved locally." accept=".csv,.xlsx,.xls" multiple={false} files={coa} onFilesChange={handleCoaChange} /> )}

              <button onClick={handleProcess} disabled={statements.length === 0 || status === 'processing'} className={`w-full py-4 px-4 rounded-lg font-bold text-lg text-white shadow-md transition-all duration-200 flex items-center justify-center space-x-2 mt-6 ${statements.length === 0 || status === 'processing' ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-[#00c65e] hover:bg-[#00b054] hover:shadow-lg text-white'}`}>
                {status === 'processing' ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /><span>Processing {currentStep?.current}/{currentStep?.total}...</span></>
                ) : (
                  <><CheckCircle2 className="w-6 h-6" /><span>Start Processing</span></>
                )}
              </button>
              
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
             {status === 'idle' && (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
                 <h2 className="text-5xl font-extrabold text-[#0f172a] mb-2 tracking-tight leading-tight">Process Bank Statements</h2>
                 <div className="text-5xl font-extrabold mb-8 tracking-tight">
                   <span className="text-blue-600">Reconciled</span> <span className="text-[#0f172a]">&</span> <span className="text-[#00c65e]">Unified</span>
                 </div>
                 <div className="max-w-2xl bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-300">
                   <p className="text-slate-800 text-lg font-semibold mb-3">Sequential Multi-File Processing Enabled:</p>
                   <p className="text-slate-600 text-base leading-relaxed">Each statement is processed independently to ensure 100% extraction accuracy and individual reconciliation checks.</p>
                 </div>
               </div>
             )}

             {status === 'processing' && (
                <div className="h-96 flex flex-col items-center justify-center text-[#0e4e78] bg-white rounded-xl shadow-sm border border-slate-200">
                  <Loader2 className="w-16 h-16 mb-6 animate-spin" />
                  <p className="text-2xl font-bold animate-pulse">Processing Statement {currentStep?.current} of {currentStep?.total}</p>
                  <p className="text-slate-500 mt-3 font-medium">Reconciling transactions in real-time...</p>
                </div>
             )}

             {status === 'success' && result && <ResultSection result={result} onReset={handleReset} />}

             {status === 'error' && !result && (
                <div className="h-96 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-red-200 rounded-xl bg-red-50/10">
                  <AlertCircle className="w-16 h-16 mb-4 text-red-300" />
                  <p className="text-xl font-bold text-slate-600">Processing Failed</p>
                </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
