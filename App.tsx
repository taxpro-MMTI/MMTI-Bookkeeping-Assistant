
import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { FileWithPreview, ProcessingStatus, ParsedResult, ReconciliationReport } from './types';
import FileUploader from './components/FileUploader';
import ResultSection from './components/ResultSection';
import { processSingleStatement } from './services/geminiService';
import { parseGeminiResponse } from './utils/responseParser';
import { fileToBase64, base64ToFile } from './utils/fileHelpers';
import { Shield, Loader2, CheckCircle2, AlertCircle, FileText, LogOut, Lock, Mail, Key } from 'lucide-react';
import { auth, loginWithEmail, logout, updateUserProfile, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const COA_STORAGE_KEY = 'auto_bookkeeper_coa';
const ADMIN_EMAIL = 'taxpro@managemytaxes.com';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const [statements, setStatements] = useState<FileWithPreview[]>([]);
  const [coa, setCoa] = useState<FileWithPreview[]>([]); 
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [currentStep, setCurrentStep] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coaLoaded, setCoaLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsAuthLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const isUserAdmin = currentUser.email === ADMIN_EMAIL;
        setIsAdmin(isUserAdmin);
        await updateUserProfile(currentUser);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthProcessing(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setIsAuthProcessing(false);
    }
  };

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

        if (parsed.businessName && !masterResult.businessName) {
          masterResult.businessName = parsed.businessName;
        }

        if (parsed.csvData.length > 0) {
          if (masterCsvRows.length === 0) {
            masterCsvRows = parsed.csvData;
          } else {
            masterCsvRows = [...masterCsvRows, ...parsed.csvData.slice(1)];
          }
        }

        if (parsed.issues && parsed.issues !== "No issues detected.") {
          masterIssues += `\n--- [${statements[i].file.name}] ---\n${parsed.issues}\n`;
        }

        masterResult.checklist = Array.from(new Set([...masterResult.checklist, ...parsed.checklist]));
        masterResult.sources = Array.from(new Set([...(masterResult.sources || []), ...(parsed.sources || [])]));
        masterResult.reconciliationReports.push(...parsed.reconciliationReports);
      }

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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-[#0e4e78]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100">
          <div className="bg-[#0e4e78] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2 text-center tracking-tight">
            Secure Login
          </h1>
          <p className="text-slate-500 mb-8 text-center text-sm">
            Enter your credentials to access the assistant
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0e4e78] outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0e4e78] outline-none transition-all"
              />
            </div>
            
            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthProcessing}
              className="w-full py-3 bg-[#0e4e78] hover:bg-[#0a3a5a] text-white rounded-xl font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isAuthProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-[#0e4e78] shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-white fill-white/10" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-white tracking-tight">MMTI Bookkeeping Assistant</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-3 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs text-blue-100 font-bold uppercase tracking-wider leading-none mb-1">Authenticated</p>
                <p className="text-sm text-white font-medium leading-none">{user.email}</p>
              </div>
            </div>
            <button onClick={logout} className="text-white/70 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10" title="Sign Out">
              <LogOut className="w-6 h-6" />
            </button>
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


