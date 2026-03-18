import React, { useRef, useState } from 'react';
import { FileText, X, UploadCloud } from 'lucide-react';
import { FileWithPreview } from '../types';
import { generateId } from '../utils/fileHelpers';

interface FileUploaderProps {
  label: string;
  accept: string;
  files: FileWithPreview[];
  onFilesChange: (files: FileWithPreview[]) => void;
  multiple?: boolean;
  description?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, accept, files, onFilesChange, multiple = false, description }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: FileWithPreview[] = Array.from(e.target.files).map((file: File) => ({ file, id: generateId() }));
      multiple ? onFilesChange([...files, ...newFiles]) : onFilesChange(newFiles);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent, dragging: boolean) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(dragging);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      const newFiles: FileWithPreview[] = Array.from(e.dataTransfer.files).map((file: File) => ({ file, id: generateId() }));
      multiple ? onFilesChange([...files, ...newFiles]) : onFilesChange([newFiles[0]]);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
          <label className="block text-sm font-bold text-slate-700">{label}</label>
          {description && <span className="text-xs text-slate-400 font-medium">{description}</span>}
      </div>
      
      <div 
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDragOver={(e) => handleDrag(e, true)}
        onDrop={handleDrop}
        className={`group border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer text-center relative overflow-hidden
          ${isDragging 
            ? 'border-blue-500 bg-blue-50/50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-slate-50/30'}`}
      >
        <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleFileChange} />
        
        <div className="flex flex-col items-center justify-center pointer-events-none relative z-10">
          <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
          
          <p className="text-sm text-slate-600 font-medium">
            <span className="text-blue-600 font-bold hover:underline">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wide">
             {accept.replace(/\./g, ' ').toUpperCase().replace(/IMAGE\/\*/, 'IMAGES')}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between bg-white border border-slate-200 pl-3 pr-2 py-2.5 rounded-lg text-sm shadow-sm hover:shadow-md transition-shadow">
              <span className="truncate flex-1 text-slate-700 flex items-center font-medium">
                <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                {f.file.name}
              </span>
              <button onClick={() => onFilesChange(files.filter(x => x.id !== f.id))} className="text-slate-400 hover:text-red-500 ml-3 p-1 rounded-md hover:bg-red-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
export default FileUploader;