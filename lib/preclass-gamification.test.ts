import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/0017_preclass_and_gamification.sql",
  ),
  "utf8",
);

describe("Pra-kelas dan gamifikasi", () => {
  it("membuka materi pra-kelas hanya setelah memastikan siswa terdaftar", () => {
    expect(migration).toMatch(
      /where e\.student_id = auth\.uid\(\) and e\.class_id = v_class_id[\s\S]*?if v_is_pre_class then\s+return true/i,
    );
    expect(migration).toMatch(
      /add column if not exists is_pre_class boolean not null default false/i,
    );
  });

  it("mencatat poin secara idempoten dan memberi poin dari trigger database", () => {
    expect(migration).toMatch(/unique \(student_id, event_key\)/i);
    expect(migration).toMatch(
      /on conflict \(student_id, event_key\) do nothing/i,
    );
    expect(migration).toMatch(/after insert on public\.material_completions/i);
    expect(migration).toMatch(
      /after insert or update of status, score, passed on public\.quiz_attempts/i,
    );
    expect(migration).toMatch(
      /'preclass_material_completed',\s*5/i,
    );
    expect(migration).toMatch(/'pretest_submitted',\s*10/i);
  });

  it("membatasi pembacaan poin dan badge serta memvalidasi akses leaderboard", () => {
    expect(migration).toMatch(
      /alter table public\.gamification_events enable row level security/i,
    );
    expect(migration).toMatch(
      /revoke all on public\.gamification_events, public\.student_badges from anon, authenticated/i,
    );
    expect(migration).toMatch(
      /where e\.student_id = auth\.uid\(\) and e\.class_id = p_class_id/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.get_class_gamification\(p_class_id uuid\)/i,
    );
  });
});
