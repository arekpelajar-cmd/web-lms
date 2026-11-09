import { GoogleGenAI } from "@google/genai";
import { sanitizeHtml } from "@/lib/sanitize";

export const EMBEDDING_DIMENSIONS = 768;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 160;
const MAX_CHUNKS_PER_MATERIAL = 80;

let genAI: GoogleGenAI | undefined;

function getGenAI() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY belum dikonfigurasi.");
  }
  genAI ??= new GoogleGenAI({ apiKey });
  return genAI;
}

export function htmlToPlainText(html: string) {
  const safeHtml = sanitizeHtml(html);
  return safeHtml
    .replace(/<\/(p|h[1-6]|li|br|div|tr|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) =>
      String.fromCodePoint(Number(value)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

export function chunkText(text: string) {
  const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    let remaining = paragraph;
    while (remaining) {
      const separator = current ? "\n\n" : "";
      const available = CHUNK_SIZE - current.length - separator.length;
      if (remaining.length <= available) {
        current = `${current}${separator}${remaining}`;
        break;
      }

      if (available <= 0) {
        chunks.push(current);
        current = current.slice(-CHUNK_OVERLAP);
        continue;
      }

      let splitAt = remaining.lastIndexOf(" ", available);
      if (splitAt < available / 2) splitAt = available;
      current = `${current}${separator}${remaining.slice(0, splitAt)}`.trim();
      chunks.push(current);
      remaining = remaining.slice(splitAt).trimStart();
      current = remaining ? current.slice(-CHUNK_OVERLAP) : "";
    }
  }

  if (current) chunks.push(current);
  if (chunks.length > MAX_CHUNKS_PER_MATERIAL) {
    throw new Error(
      `Materi terlalu panjang untuk diindeks (maksimal ${MAX_CHUNKS_PER_MATERIAL} bagian).`,
    );
  }
  return chunks;
}

async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  title?: string,
) {
  const result = await getGenAI().models.embedContent({
    model: process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-001",
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
      ...(title ? { title } : {}),
    },
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      "Google AI mengembalikan embedding dengan dimensi yang tidak valid.",
    );
  }
  return values;
}

export async function embedQuery(text: string) {
  return embedText(text, "RETRIEVAL_QUERY");
}

export async function prepareMaterialEmbeddings(title: string, html: string) {
  const text = htmlToPlainText(html);
  if (!text) return [];

  const chunks = chunkText(text);
  const embeddedChunks: {
    chunk_index: number;
    content: string;
    embedding: number[];
  }[] = [];

  for (let index = 0; index < chunks.length; index += 4) {
    const batch = await Promise.all(
      chunks.slice(index, index + 4).map(async (content, batchIndex) => ({
        chunk_index: index + batchIndex,
        content,
        embedding: await embedText(content, "RETRIEVAL_DOCUMENT", title),
      })),
    );
    embeddedChunks.push(...batch);
  }

  return embeddedChunks;
}
