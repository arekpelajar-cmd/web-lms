import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModulesManager } from "./modules-manager";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ subject?: string }>;
}

export default async function TeacherClassModulesPage({
  params,
  searchParams,
}: PageProps) {
  const profile = await requireRole("teacher");
  const { id: classId } = await params;
  const { subject: subjectParam } = await searchParams;

  const supabase = await createClient();

  // 1. Ambil informasi kelas
  const { data: classData } = await supabase
    .from("classes")
    .select("id, name, referral_code")
    .eq("id", classId)
    .maybeSingle();

  if (!classData) {
    redirect("/teacher");
  }

  // 2. Verifikasi penugasan guru di kelas ini dan ambil daftar mapel yang diajarkan guru ini
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("subject_id, subjects (id, name)")
    .eq("teacher_id", profile.id)
    .eq("class_id", classId);

  if (!assignments || assignments.length === 0) {
    // Guru tidak mengajar di kelas ini
    redirect("/teacher");
  }

  const taughtSubjects = assignments
    .map((a: any) => ({
      id: a.subject_id,
      name: a.subjects?.name ?? "Mata Pelajaran",
    }))
    .filter((s, idx, arr) => arr.findIndex((item) => item.id === s.id) === idx);

  // 3. Ambil daftar modul, materi, dan kuis di kelas ini
  const { data: modules } = await supabase
    .from("modules")
    .select(
      `
      id,
      class_id,
      subject_id,
      title,
      description,
      order_index,
      created_at,
      subjects:subject_id (id, name),
      materials (
        id,
        module_id,
        title,
        content,
        video_url,
        is_pre_class,
        pre_class_due_at,
        order_index,
        created_at,
        simulations (
          id,
          material_id,
          title,
          type,
          config,
          order_index,
          created_at
        ),
        material_audios (
          id,
          material_id,
          title,
          file_path,
          duration_seconds,
          transcript,
          order_index,
          created_at
        )
      ),
      quizzes (
        id,
        module_id,
        class_id,
        subject_id,
        type,
        purpose,
        title,
        description,
        passing_score,
        open_at,
        due_at,
        close_at,
        allow_late,
        max_attempts,
        sound_effects,
        feedback_mode,
        review_at,
        order_index,
        created_at,
        shuffle_questions,
        shuffle_options,
        questions (
          id,
          quiz_id,
          question_text,
          options,
          order_index,
          created_at,
          question_keys (
            correct_option,
            explanation
          )
        )
      )
    `,
    )
    .eq("class_id", classId)
    .order("order_index", { ascending: true });

  // Format and sort materials and quizzes
  const formattedModules = (modules ?? []).map((m: any) => ({
    id: m.id,
    class_id: m.class_id,
    subject_id: m.subject_id,
    title: m.title,
    description: m.description,
    order_index: m.order_index,
    created_at: m.created_at,
    subjects: m.subjects,
    materials: (m.materials ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((mat: any) => ({
        ...mat,
        simulations: (mat.simulations ?? []).sort(
          (a: any, b: any) => a.order_index - b.order_index,
        ),
        material_audios: (mat.material_audios ?? []).sort(
          (a: any, b: any) => a.order_index - b.order_index,
        ),
      })),
    quizzes: (m.quizzes ?? []).map((qz: any) => ({
      id: qz.id,
      module_id: qz.module_id,
      class_id: qz.class_id,
      subject_id: qz.subject_id,
      type: qz.type ?? "chapter",
      purpose: qz.purpose ?? "practice",
      title: qz.title,
      description: qz.description,
      passing_score: qz.passing_score,
      open_at: qz.open_at,
      due_at: qz.due_at,
      close_at: qz.close_at,
      allow_late: Boolean(qz.allow_late),
      max_attempts: qz.max_attempts,
      sound_effects: Boolean(qz.sound_effects),
      feedback_mode:
        qz.feedback_mode ?? (qz.type === "chapter" ? "per_question" : "none"),
      review_at: qz.review_at,
      order_index: qz.order_index,
      created_at: qz.created_at,
      shuffle_questions: Boolean(qz.shuffle_questions),
      shuffle_options: Boolean(qz.shuffle_options),
      questions: (qz.questions ?? [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((q: any) => ({
          id: q.id,
          quiz_id: q.quiz_id,
          question_text: q.question_text,
          options: q.options ?? [],
          order_index: q.order_index,
          created_at: q.created_at,
          correct_option: Array.isArray(q.question_keys)
            ? q.question_keys[0]?.correct_option
            : (q.question_keys?.correct_option ?? ""),
          explanation: Array.isArray(q.question_keys)
            ? (q.question_keys[0]?.explanation ?? null)
            : (q.question_keys?.explanation ?? null),
        })),
    })),
  }));

  return (
    <ModulesManager
      classId={classId}
      className={classData.name}
      referralCode={classData.referral_code}
      taughtSubjects={taughtSubjects}
      initialModules={formattedModules}
      initialSelectedSubject={subjectParam}
    />
  );
}
