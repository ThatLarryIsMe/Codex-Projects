"use client";

interface FormattedEntry {
  name: string;
  html: string;
}

interface DocumentPreviewProps {
  entries: FormattedEntry[];
}

export default function DocumentPreview({ entries }: DocumentPreviewProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No formatted entries yet</p>
        <p className="text-sm mt-1">
          Upload files and click &quot;Format with AI&quot; to get started
        </p>
      </div>
    );
  }

  return (
    <div className="pdf-content" id="pdf-content">
      {entries.map((entry, i) => (
        <div
          key={`${entry.name}-${i}`}
          className={i > 0 ? "entry-separator" : ""}
        >
          <div dangerouslySetInnerHTML={{ __html: entry.html }} />
        </div>
      ))}
    </div>
  );
}
