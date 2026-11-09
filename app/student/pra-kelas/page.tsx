import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Medal,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDateTimeWib } from "@/lib/assignment-utils";
import { createClient } from "@/lib/supabase/server";

type BadgeCode = "preclass_ready" | "pretest_pass" | "perfect_score";

type GamificationSummary = {
  my_points: number;
  my_rank: number | null;
  badges: { code: BadgeCode; earned_at: string }[];
  leaderboard: {
    student_id: string;
    name: string;
    points: number;
    rank: number;
  }[];
};

type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  score: number;
  passed: boolean;
  status: string;
  attempted_at: string;
};

const BADGES: Record<BadgeCode, { title: string; description: string }> = {
  preclass_ready: {
    title: "Siap Kelas",
    description: "Menyelesaikan semua materi pra-kelas dan pre-test.",
  },
  pretest_pass: {
    title: "Lulus Pre-test",
    description: "Mencapai nilai minimum pada pre-test.",
  },
  perfect_score: {
    title: "Skor Sempurna",
    description: "Meraih nilai 100 pada pre-test.",
  },
};

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function StudentPreClassPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("class_id, classes:class_id(name)")
    .eq("student_id", profile.id)
    .maybeSingle();

  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Persiapan Pra-kelas</CardTitle>
          <CardDescription>
            Anda belum terdaftar di kelas. Hubungi guru atau admin untuk
            mendapatkan kode kelas.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const classData = getRelation(enrollment.classes as { name: string } | { name: string }[] | null);
  const classId = enrollment.class_id;

  const [
    { data: materials, error: materialsError },
    { data: quizzes, error: quizzesError },
    { data: gamificationData, error: gamificationError },
  ] = await Promise.all([
    supabase
      .from("materials")
      .select(
        "id, title, pre_class_due_at, modules:modules!inner(id, title, class_id)",
      )
      .eq("is_pre_class", true)
      .eq("modules.class_id", classId)
      .order("order_index", { ascending: true }),
    supabase
      .from("quizzes")
      .select(
        "id, title, passing_score, due_at, modules:module_id!inner(id, title, class_id)",
      )
      .eq("purpose", "pre_test")
      .eq("modules.class_id", classId)
      .order("order_index", { ascending: true }),
    supabase.rpc("get_class_gamification", { p_class_id: classId }),
  ]);

  if (materialsError) throw new Error(materialsError.message);
  if (quizzesError) throw new Error(quizzesError.message);
  if (gamificationError) throw new Error(gamificationError.message);

  const materialIds = (materials ?? []).map((material) => material.id);
  const quizIds = (quizzes ?? []).map((quiz) => quiz.id);

  const [
    { data: completions, error: completionsError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    materialIds.length
      ? supabase
          .from("material_completions")
          .select("material_id")
          .eq("student_id", profile.id)
          .in("material_id", materialIds)
      : Promise.resolve({ data: [], error: null }),
    quizIds.length
      ? supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, passed, status, attempted_at")
          .eq("student_id", profile.id)
          .in("quiz_id", quizIds)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (completionsError) throw new Error(completionsError.message);
  if (attemptsError) throw new Error(attemptsError.message);

  const completedMaterialIds = new Set(
    (completions ?? []).map((completion) => completion.material_id),
  );
  const attemptsByQuiz = new Map<string, QuizAttemptRow[]>();
  for (const attempt of attempts ?? []) {
    const quizAttempts = attemptsByQuiz.get(attempt.quiz_id) ?? [];
    quizAttempts.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, quizAttempts);
  }

  const completedMaterials = materialIds.filter((id) =>
    completedMaterialIds.has(id),
  ).length;
  const completedQuizzes = quizIds.filter((id) =>
    (attemptsByQuiz.get(id) ?? []).some((attempt) => attempt.status === "submitted"),
  ).length;
  const totalItems = materialIds.length + quizIds.length;
  const completedItems = completedMaterials + completedQuizzes;
  const gamification = gamificationData as GamificationSummary;
  const earnedBadges = new Set(gamification.badges.map((badge) => badge.code));

  if (!classData) redirect("/student");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Persiapan Pra-kelas</h1>
          <Badge variant="outline">Kelas {classData.name}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pelajari materi dan kerjakan pre-test sebelum pertemuan. Guru
          menyarankan persiapan selesai paling lambat H-2.
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.07]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Progres persiapan Anda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {completedItems} dari {totalItems} aktivitas selesai
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-36 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${totalItems ? Math.round((completedItems / totalItems) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="text-lg font-bold">
              {totalItems ? Math.round((completedItems / totalItems) * 100) : 0}%
            </span>
          </div>
        </CardContent>
      </Card>

      {totalItems === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Belum ada persiapan yang ditugaskan</CardTitle>
            <CardDescription>
              Guru akan menampilkan materi dan pre-test di sini setelah
              menandainya sebagai pra-kelas.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BookOpenCheck className="h-5 w-5 text-primary" />
                Materi pra-kelas
              </h2>
              {(materials ?? []).length === 0 ? (
                <Card className="border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada materi pra-kelas.
                </Card>
              ) : (
                (materials ?? []).map((material) => {
                  const moduleData = getRelation(
                    material.modules as
                      | { title: string }
                      | { title: string }[]
                      | null,
                  );
                  const isComplete = completedMaterialIds.has(material.id);
                  return (
                    <Card key={material.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <BookOpenCheck className="h-4 w-4 shrink-0 text-primary" />
                            )}
                            <p className="truncate font-medium">{material.title}</p>
                          </div>
                          <p className="mt-1 pl-6 text-xs text-muted-foreground">
                            {moduleData?.title ?? "Materi"}
                            {material.pre_class_due_at && (
                              <>
                                {" · "}
                                <Clock3 className="mr-1 inline h-3 w-3" />
                                Target: {formatDateTimeWib(material.pre_class_due_at)}
                              </>
                            )}
                          </p>
                        </div>
                        <Button asChild size="sm" variant={isComplete ? "outline" : "default"}>
                          <Link href={`/student/materi/${material.id}`}>
                            {isComplete ? "Buka kembali" : "Pelajari"}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Pre-test
              </h2>
              {(quizzes ?? []).length === 0 ? (
                <Card className="border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada pre-test yang ditugaskan.
                </Card>
              ) : (
                (quizzes ?? []).map((quiz) => {
                  const quizAttempts = attemptsByQuiz.get(quiz.id) ?? [];
                  const inProgressAttempt = quizAttempts.find(
                    (attempt) => attempt.status === "in_progress",
                  );
                  const submittedAttempt = quizAttempts.find(
                    (attempt) => attempt.status === "submitted",
                  );
                  const moduleData = getRelation(
                    quiz.modules as { title: string } | { title: string }[],
                  );
                  return (
                    <Card key={quiz.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{quiz.title}</p>
                            <Badge
                              variant={
                                inProgressAttempt || submittedAttempt
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {inProgressAttempt
                                ? "Sedang dikerjakan"
                                : submittedAttempt
                                  ? "Dikerjakan"
                                  : "Belum dikerjakan"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {moduleData?.title ?? "Kelas"} · KKM {quiz.passing_score}%
                            {quiz.due_at && (
                              <> · Target {formatDateTimeWib(quiz.due_at)}</>
                            )}
                          </p>
                          {submittedAttempt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Nilai terakhir: {submittedAttempt.score}%{" "}
                              {submittedAttempt.passed ? "· Lulus" : "· Belum lulus"}
                            </p>
                          )}
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant={submittedAttempt ? "outline" : "default"}
                        >
                          <Link href={`/student/kuis/${quiz.id}`}>
                            {inProgressAttempt
                              ? "Lanjutkan pre-test"
                              : submittedAttempt
                                ? "Lihat hasil"
                                : "Mulai pre-test"}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Poin kelas
                </CardTitle>
                <CardDescription>
                  Materi +5, selesai pre-test +10, lulus +10, nilai 100 +10.
                  Poin tiap capaian hanya dihitung sekali.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between rounded-lg bg-muted/40 p-4">
                  <div>
                    <p className="text-3xl font-bold">{gamification.my_points}</p>
                    <p className="text-xs text-muted-foreground">total poin</p>
                  </div>
                  <p className="text-sm font-medium">
                    Peringkat #{gamification.my_rank ?? "—"}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Papan peringkat</h3>
                  {gamification.leaderboard.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada siswa pada papan peringkat.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {gamification.leaderboard.map((student) => (
                        <li
                          key={student.student_id}
                          className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm ${
                            student.student_id === profile.id
                              ? "bg-primary/10 font-semibold"
                              : "bg-muted/30"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {student.rank <= 3 ? (
                              <Medal className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                              <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
                                {student.rank}
                              </span>
                            )}
                            <span className="truncate">{student.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {student.points} poin
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 text-primary" />
                  Lencana
                </CardTitle>
                <CardDescription>
                  Lencana didapat otomatis dari aktivitas pra-kelas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.entries(BADGES) as [BadgeCode, (typeof BADGES)[BadgeCode]][]).map(
                  ([code, badge]) => {
                    const earned = earnedBadges.has(code);
                    return (
                      <div
                        key={code}
                        className={`rounded-lg border p-3 ${
                          earned ? "border-amber-500/30 bg-amber-500/[0.05]" : "opacity-55"
                        }`}
                      >
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Award className="h-4 w-4 text-amber-500" />
                          {badge.title}
                          {earned && <Badge variant="secondary">Didapat</Badge>}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {badge.description}
                        </p>
                      </div>
                    );
                  },
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
