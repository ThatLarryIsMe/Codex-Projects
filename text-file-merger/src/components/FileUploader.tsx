"use client";

import { useCallback, useRef } from "react";

interface FileData {
  name: string;
  content: string;
}

interface FileUploaderProps {
  onFilesLoaded: (files: FileData[], folderName: string | null) => void;
  disabled?: boolean;
}

export default function FileUploader({
  onFilesLoaded,
  disabled,
}: FileUploaderProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const readFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const txtFiles = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith(".txt")
      );

      if (txtFiles.length === 0) return;

      // Try to extract folder name from webkitRelativePath
      let folderName: string | null = null;
      const first = txtFiles[0] as File & { webkitRelativePath?: string };
      if (first.webkitRelativePath) {
        folderName = first.webkitRelativePath.split("/")[0] || null;
      }

      // Sort by filename naturally (Day 1 before Day 10)
      txtFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      const loaded: FileData[] = await Promise.all(
        txtFiles.map(
          (file) =>
            new Promise<FileData>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ name: file.name, content: reader.result as string });
              reader.readAsText(file);
            })
        )
      );

      onFilesLoaded(loaded, folderName);
    },
    [onFilesLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      const items = e.dataTransfer.items;
      if (items) {
        const filePromises: Promise<File>[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) filePromises.push(Promise.resolve(file));
          }
        }
        Promise.all(filePromises).then((files) => readFiles(files));
      } else {
        readFiles(e.dataTransfer.files);
      }
    },
    [readFiles, disabled]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-3">
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer"
        }`}
      >
        <div className="space-y-3">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-600">
            Drag & drop .txt files here, or use the buttons below
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Individual files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && readFiles(e.target.files)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Select Files
        </button>

        {/* Folder upload */}
        <input
          ref={folderInputRef}
          type="file"
          accept=".txt"
          multiple
          className="hidden"
          /* @ts-expect-error webkitdirectory is non-standard */
          webkitdirectory=""
          onChange={(e) => e.target.files && readFiles(e.target.files)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Select Folder
        </button>
      </div>
    </div>
  );
}
