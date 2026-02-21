import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

interface FileEntry {
  name: string;
  content: string;
}

interface FormatRequest {
  files: FileEntry[];
  prompt: string;
}

function markdownToHtml(md: string): string {
  let html = md;

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");
  html = html.replace(/^\*\*\*+$/gm, "<hr>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic combined
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((<li>.+<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Paragraphs: wrap lines that aren't already HTML tags
  const lines = html.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<hr") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("</")
    ) {
      result.push(line);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return result.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body: FormatRequest = await req.json();
    const { files, prompt } = body;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!prompt || prompt.trim() === "") {
      return NextResponse.json(
        { error: "No formatting prompt provided" },
        { status: 400 }
      );
    }

    // Process files in batches of 5 to stay within context limits
    const batchSize = 5;
    const formattedEntries: { name: string; html: string }[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const filesContext = batch
        .map(
          (f, idx) =>
            `--- FILE ${i + idx + 1}: "${f.name}" ---\n${f.content}\n--- END FILE ---`
        )
        .join("\n\n");

      const stream = client.messages.stream({
        model: "claude-opus-4-6",
        max_tokens: 16000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        thinking: { type: "adaptive" } as any,
        system: `You are a document formatter. The user will provide raw text files and a formatting instruction. Your job is to format EACH file according to the instruction and return them as clean Markdown.

IMPORTANT RULES:
- Format each file separately, clearly separated by "---ENTRY_SEPARATOR---" on its own line between entries.
- Preserve ALL original content - do not summarize or omit text.
- Apply the formatting style consistently across all entries.
- Use Markdown formatting: # for main headings, ## for subheadings, ### for sub-subheadings, **bold**, *italic*, > for quotes, etc.
- Do NOT wrap output in code fences. Output raw Markdown only.
- Each entry should start with its heading (day number, title, date, etc. as appropriate).`,
        messages: [
          {
            role: "user",
            content: `Formatting instruction: ${prompt}

Here are the text files to format:

${filesContext}`,
          },
        ],
      });

      let fullText = "";
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullText += event.delta.text;
        }
      }

      // Split by separator and pair with file names
      const entries = fullText
        .split("---ENTRY_SEPARATOR---")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      for (let j = 0; j < batch.length; j++) {
        const entryMd = entries[j] || batch[j].content;
        formattedEntries.push({
          name: batch[j].name,
          html: markdownToHtml(entryMd),
        });
      }
    }

    return NextResponse.json({ entries: formattedEntries });
  } catch (error: unknown) {
    console.error("Format API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
