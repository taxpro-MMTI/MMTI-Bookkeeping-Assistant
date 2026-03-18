
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { fileToBase64, readExcelAsText, readFileAsText } from "../utils/fileHelpers";
import { FileWithPreview } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY });

const BASE_PROMPT = `
Begin with a concise checklist (3-7 bullets) of what you will do.

Instructions for Transaction Review and Categorization:
1. Automobile Expenses:
   - Use the category "Automobile and Truck".
   - Select the subcategory exactly as listed in the COA file.
2. Meals Expenses:
   - If the total meal expense is less than $400, classify 50% as deductible.
   - If the total meal expense is $400 or more, classify 100% as deductible.
3. Recurring Vendor Payments:
   - If the vendor is a business and you see multiple payments (e.g., wire transfers) to the same vendor, categorize the expense as "Outside Services / Contractor".
4. Payroll Processing Rules:
   - IRS 941 payments: Categorize to the "941 Payable" account under CURRENT LIABILITIES from the provided COA.
   - State payroll tax payments: Categorize to the respective state payroll tax liability account under CURRENT LIABILITIES from the provided COA.
   - Salary / wages / net payroll payments: Categorize to the "Net Pay Payable" account under CURRENT LIABILITIES from the provided COA.
   - All payroll-related transactions: Set Column J ("Entity/Use") strictly to "Balance Sheet".
5. Minimize "Ask My Accountant":
   - Use "Ask My Accountant" only when absolutely necessary.
   - If you are unsure about a category, choose the category that best fits and add a comment: "Need review."
6. Vendor Duplications and Standardization:
   - Check for duplicate vendors. Keep standardized vendor name.
   - Checks: If a transaction is a check, set Vendor strictly to "Check". Do not include check number.

Reconciliation Protocol (CRITICAL):
1. Identify Statement Totals: Locate "Beginning Balance", "Ending Balance", "Total Debits", and "Total Credits" in this document.
2. Sum Verification: Perform an algebraic sum of all extracted "Amounts" (using the Negative=Out, Positive=In convention) and verify if (Start + Sum) equals "Ending Balance".
3. Mismatch Handling: If totals don't match, investigate:
   - OCR errors (e.g., 5 read as 6).
   - Missing transactions or duplicates.
   - Sign errors.
4. Reporting: 
   - After the CSV, include a section [Reconciliation Status].
   - Format: "Status: PASSED. Business: [Full Legal Business Name], Bank: [Bank Name], Last4: [Last 4 Digits], Period: [MM/YY], Diff: [Amount], Reason: [Reason]"

Strict Output Formatting Rules (UPGRADE):
1. Bank Account Name/Number Consistency:
   - Always use the format: "BankName ****[Last 4 Digits]" (e.g., Chase ****1234).
   - Normalize to this format across every transaction. Do not vary naming or formatting.
2. Debit/Credit and Amount Signage (CRITICAL FIX):
   - Column G ("Type") must strictly contain either "DEBIT" or "CREDIT" in all caps.
   - "DEBIT" represents money going out (expenses, purchases, withdrawals). 
   - Column H ("Amounts") for DEBIT transactions MUST always be a NEGATIVE number (e.g., -49.95).
   - "CREDIT" represents money coming in (deposits, payments received, refunds). 
   - Column H ("Amounts") for CREDIT transactions MUST always be a POSITIVE number (e.g., 1000.00).
   - Ensure this logic is applied correctly even if the source statement uses a different convention (like credit card statements showing expenses as positive).
3. No Mid-Month Notes in CSV:
   - The [CSV Section] must contain ONLY raw transaction rows.
   - Zero interruptions, no blank lines, no mid-table summaries, and no text notes between rows.
   - All reconciliation findings and errors MUST be placed in the designated metadata columns: "Reconciled", "Statement_Errors", and "Category_Notes".

Output Requirements:
1. Extract EVERY transaction from THIS statement.
2. Output an Excel-friendly CSV table. Wrap every field in double quotes.
3. Columns (Exact Order): "Bank Account Name/Number","Date","Description","Vendor","MMit COA","QBD Amounts","Type","Amounts","Tax Multiple","Entity/Use","Comments","Reconciled","Statement_Errors","Category_Notes"

Output Format:
[Checklist Section]
... bullets ...

[CSV Section]
"Bank Account Name/Number","Date","Description","Vendor","MMit COA","QBD Amounts","Type","Amounts","Tax Multiple","Entity/Use","Comments","Reconciled","Statement_Errors","Category_Notes"
... rows ...

[Reconciliation Status]
Status: ...

[Issues Section]
(Issues or "No issues detected.")
`;

const getFilePart = async (file: File) => {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const isExcel = file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  if (isImage || isPdf) {
    const base64Data = await fileToBase64(file);
    return { inlineData: { mimeType: file.type, data: base64Data } };
  } else if (isExcel) {
    const text = await readExcelAsText(file);
    return { text: `[File Content: ${file.name}]\n${text}` };
  } else {
    try {
      const text = await readFileAsText(file);
      return { text: `[File Content: ${file.name}]\n${text}` };
    } catch (e) {
       throw new Error(`Unsupported file type: ${file.type}`);
    }
  }
};

export const processSingleStatement = async (statement: FileWithPreview, coa: FileWithPreview | null): Promise<string> => {
  try {
    const parts: any[] = [{ text: BASE_PROMPT }];
    parts.push(await getFilePart(statement.file));

    if (coa) {
      parts.push({ text: "\n\nA Chart of Accounts (COA) is below. Use it for 'MMit COA'." });
      parts.push(await getFilePart(coa.file));
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "";
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = response.candidates[0].groundingMetadata.groundingChunks;
      const links = [...new Set(chunks.map((c: any) => c.web?.uri).filter((uri: string) => uri))];
      if (links.length > 0) text += `\n\n[Research Sources]\n${links.join('\n')}`;
    }

    return text;
  } catch (error) {
    console.error(`Error processing ${statement.file.name}:`, error);
    throw error;
  }
};
