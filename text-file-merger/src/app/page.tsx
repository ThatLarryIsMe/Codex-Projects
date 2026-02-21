"use client";

import { useState, useCallback, useRef } from "react";
import FileUploader from "@/components/FileUploader";
import DocumentPreview from "@/components/DocumentPreview";

interface FileData {
  name: string;
  content: string;
}

interface FormattedEntry {
  name: string;
  html: string;
}

interface UploadBatch {
  id: string;
  folderName: string | null;
  files: FileData[];
  status: "pending" | "formatting" | "done" | "error";
  error?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState(
    "Formatted like a daily devotional with bold headings and italicized subheadings"
  );
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [formattedEntries, setFormattedEntries] = useState<FormattedEntry[]>(
    []
  );
  const [isFormatting, setIsFormatting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleFilesLoaded = useCallback(
    (files: FileData[], folderName: string | null) => {
      const batch: UploadBatch = {
        id: Date.now().toString(),
        folderName,
        files,
        status: "pending",
      };
      setBatches((prev) => [...prev, batch]);
    },
    []
  );

  const removeBatch = useCallback((id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const formatAll = useCallback(async () => {
    const pendingBatches = batches.filter((b) => b.status === "pending");
    if (pendingBatches.length === 0) return;

    setIsFormatting(true);
    const totalFiles = pendingBatches.reduce(
      (sum, b) => sum + b.files.length,
      0
    );
    setProgress({ current: 0, total: totalFiles });

    let filesProcessed = 0;

    for (const batch of pendingBatches) {
      // Mark batch as formatting
      setBatches((prev) =>
        prev.map((b) => (b.id === batch.id ? { ...b, status: "formatting" } : b))
      );

      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/format", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: batch.files, prompt }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        setFormattedEntries((prev) => [...prev, ...data.entries]);
        filesProcessed += batch.files.length;
        setProgress({ current: filesProcessed, total: totalFiles });

        // Mark batch as done
        setBatches((prev) =>
          prev.map((b) => (b.id === batch.id ? { ...b, status: "done" } : b))
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") break;
        const message = err instanceof Error ? err.message : "Unknown error";
        setBatches((prev) =>
          prev.map((b) =>
            b.id === batch.id ? { ...b, status: "error", error: message } : b
          )
        );
      }
    }

    setIsFormatting(false);
  }, [batches, prompt]);

  const cancelFormatting = useCallback(() => {
    abortRef.current?.abort();
    setIsFormatting(false);
    setBatches((prev) =>
      prev.map((b) =>
        b.status === "formatting" ? { ...b, status: "pending" } : b
      )
    );
  }, []);

  const downloadPdf = useCallback(async () => {
    setPdfGenerating(true);
    try {
      // Dynamic import to keep bundle small
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("pdf-content");
      if (!element) return;

      await html2pdf()
        .set({
          margin: [0.75, 0.75, 0.75, 0.75],
          filename: "merged-document.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], before: ".entry-separator" },
        })
        .from(element)
        .save();
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    }
    setPdfGenerating(false);
  }, []);

  const clearAll = useCallback(() => {
    setBatches([]);
    setFormattedEntries([]);
    setProgress({ current: 0, total: 0 });
  }, []);

  const pendingCount = batches.filter((b) => b.status === "pending").length;
  const pendingFileCount = batches
    .filter((b) => b.status === "pending")
    .reduce((sum, b) => sum + b.files.length, 0);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Text File Merger
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload .txt files, format with AI, combine into a single PDF
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Controls */}
          <div className="lg:col-span-1 space-y-5">
            {/* Formatting Prompt */}
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Formatting Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={isFormatting}
                placeholder='e.g., "Formatted like a daily devotional with bold headings and italicized subheadings"'
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Tell the AI how to style each entry
              </p>
            </section>

            {/* File Upload */}
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Upload Files
              </h2>
              <FileUploader
                onFilesLoaded={handleFilesLoaded}
                disabled={isFormatting}
              />
            </section>

            {/* Upload Batches */}
            {batches.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Upload Batches
                  </h2>
                  {!isFormatting && (
                    <button
                      onClick={clearAll}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                        batch.status === "done"
                          ? "bg-green-50 text-green-700"
                          : batch.status === "formatting"
                            ? "bg-indigo-50 text-indigo-700"
                            : batch.status === "error"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">
                          {batch.folderName || "Files"}
                        </span>
                        <span className="text-xs opacity-75">
                          {batch.files.length} file
                          {batch.files.length !== 1 ? "s" : ""}
                          {batch.status === "formatting" && " - formatting..."}
                          {batch.status === "done" && " - done"}
                          {batch.status === "error" &&
                            ` - error: ${batch.error}`}
                        </span>
                      </div>
                      {batch.status === "pending" && !isFormatting && (
                        <button
                          onClick={() => removeBatch(batch.id)}
                          className="ml-2 text-gray-400 hover:text-red-500"
                          title="Remove"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {isFormatting ? (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <svg
                        className="h-5 w-5 text-indigo-600 spinner"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">
                        Formatting with AI...
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {progress.current} / {progress.total} files processed
                    </p>
                  </div>
                  <button
                    onClick={cancelFormatting}
                    className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {pendingCount > 0 && (
                    <button
                      onClick={formatAll}
                      className="w-full px-4 py-3 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Format {pendingFileCount} File
                      {pendingFileCount !== 1 ? "s" : ""} with AI
                    </button>
                  )}

                  {formattedEntries.length > 0 && (
                    <button
                      onClick={downloadPdf}
                      disabled={pdfGenerating}
                      className="w-full px-4 py-3 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {pdfGenerating
                        ? "Generating PDF..."
                        : `Download PDF (${formattedEntries.length} entries)`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Tip:</strong> You can upload files in multiple batches.
                Add a folder, then add more folders &mdash; each batch will be
                formatted and appended to the document. The AI processes 5 files
                at a time to ensure quality.
              </p>
            </div>
          </div>

          {/* Right panel: Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 min-h-[600px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700">
                  Document Preview
                </h2>
                {formattedEntries.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {formattedEntries.length} entr
                    {formattedEntries.length !== 1 ? "ies" : "y"}
                  </span>
                )}
              </div>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <DocumentPreview entries={formattedEntries} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
