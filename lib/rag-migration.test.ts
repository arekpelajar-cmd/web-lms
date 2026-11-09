import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/0018_rag_chatbot.sql"),
  "utf8",
);

describe("chatbot RAG migration", () => {
  it("uses the same 768-dimensional pgvector size as the embedding client", () => {
    expect(migration).toMatch(/create extension if not exists vector/i);
    expect(migration).toMatch(/embedding extensions\.vector\(768\)/i);
    expect(migration).toMatch(/query_embedding extensions\.vector\(768\)/i);
    expect(migration).toMatch(/vector_cosine_ops/i);
  });

  it("keeps retrieval subject to RLS and material unlock rules", () => {
    expect(migration).toMatch(/alter table public\.modul_embeddings enable row level security/i);
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/class_id = public\.my_class_id\(\)[\s\S]*public\.can_access_material\(material_id\)/i);
    expect(migration).toMatch(/revoke all on function public\.match_modul[\s\S]*from public, anon/i);
  });
});
