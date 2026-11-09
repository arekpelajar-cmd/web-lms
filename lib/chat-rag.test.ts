import { describe, expect, it } from "vitest";
import { chunkText, htmlToPlainText } from "@/lib/chat-rag";

describe("chatbot RAG material preparation", () => {
  it("extracts safe text from TipTap HTML and decodes common entities", () => {
    const text = htmlToPlainText(
      "<h2>Hukum Ohm</h2><p>V &amp; I <script>alert(1)</script></p>",
    );

    expect(text).toContain("Hukum Ohm");
    expect(text).toContain("V & I");
    expect(text).not.toContain("alert");
  });

  it("splits long material into bounded chunks with overlap", () => {
    const chunks = chunkText("Rangkaian listrik ".repeat(200));
    const firstChunk = chunks[0] ?? "";
    const secondChunk = chunks[1] ?? "";

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1200)).toBe(true);
    expect(firstChunk).toContain("Rangkaian listrik");
    expect(secondChunk).toContain(firstChunk.slice(-80));
  });

  it("rejects materials exceeding the indexing chunk limit", () => {
    expect(() => chunkText("materi ".repeat(20_000))).toThrow(
      "maksimal 80 bagian",
    );
  });
});
