"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { QuizSubmissionResult } from "@/lib/types";
import { questionExplanationSchema, quizSchema } from "@/lib/quiz-validator";
import { parseDateTimeLocalWib } from "@/lib/assignment-utils";

export type ActionState = {
  success?: boolean;
  error?: string | null;
  data?: any;
};

// ==============================================================================
// 1. MANAJEMEN KUIS OLEH GURU
// ==============================================================================

export async function createQuizAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const type = ((formData.get("type") as string)?.trim() || "chapter") as
      | "chapter"
      | "assessment";
    const purpose = (formData.get("purpose") as string)?.trim() || "practice";
    if (purpose !== "practice" && purpose !== "pre_test") {
      return { error: "Tujuan kuis tidak valid." };
    }
    const classId = (formData.get("class_id") as string)?.trim() || null;
    const subjectId = (formData.get("subject_id") as string)?.trim() || null;
    const moduleId = (formData.get("module_id") as string)?.trim() || null;
    const materialId = (formData.get("material_id") as string)?.trim() || null;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const passingScore = parseInt(
      (formData.get("passing_score") as string) || "70",
      10,
    );
    const feedbackMode = ((formData.get("feedback_mode") as string)?.trim() ||
      (type === "chapter" ? "per_question" : "none")) as
      | "none"
      | "after_submit"
      | "per_question";
    const shuffleQuestions = formData.get("shuffle_questions") === "true";
    const shuffleOptions = formData.get("shuffle_options") === "true";
    const soundEffects = formData.get("sound_effects") === "true";

    const openAtRaw = (formData.get("open_at") as string)?.trim();
    const dueAtRaw = (formData.get("due_at") as string)?.trim();
    const closeAtRaw = (formData.get("close_at") as string)?.trim();
    const reviewAtRaw = (formData.get("review_at") as string)?.trim();
    const allowLate = formData.get("allow_late") === "true";
    const maxAttemptsRaw = (formData.get("max_attempts") as string)?.trim();
    const maxAttempts = maxAttemptsRaw ? parseInt(maxAttemptsRaw, 10) : null;

    const openAtDate = openAtRaw ? parseDateTimeLocalWib(openAtRaw) : null;
    const dueAtDate = dueAtRaw ? parseDateTimeLocalWib(dueAtRaw) : null;
    const closeAtDate = closeAtRaw ? parseDateTimeLocalWib(closeAtRaw) : null;
    const reviewAtDate = reviewAtRaw ? parseDateTimeLocalWib(reviewAtRaw) : null;
    if (
      (openAtRaw && !openAtDate) ||
      (dueAtRaw && !dueAtDate) ||
      (closeAtRaw && !closeAtDate) ||
      (reviewAtRaw && !reviewAtDate)
    ) {
      return { error: "Format waktu kuis tidak valid." };
    }

    const openAt = openAtDate?.toISOString() ?? null;
    const dueAt = dueAtDate?.toISOString() ?? null;
    const closeAt = closeAtDate?.toISOString() ?? null;
    const reviewAt = reviewAtDate?.toISOString() ?? null;

    const parsed = quizSchema.safeParse({
      type,
      class_id: classId,
      subject_id: subjectId,
      module_id: moduleId,
      material_id: materialId,
      title,
      description,
      passing_score: isNaN(passingScore) ? 70 : passingScore,
      feedback_mode: feedbackMode,
      review_at: reviewAt,
      sound_effects: soundEffects,
      open_at: openAt,
      due_at: dueAt,
      close_at: closeAt,
      allow_late: allowLate,
      max_attempts: maxAttempts,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Data kuis tidak valid.",
      };
    }

    const { error } = await supabase.from("quizzes").insert({
      ...parsed.data,
      purpose,
    });

    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath("/student/pra-kelas");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function updateQuizAction(
  quizId: string,
  classId: string,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const purpose = (formData.get("purpose") as string)?.trim() || "practice";
    if (purpose !== "practice" && purpose !== "pre_test") {
      return { error: "Tujuan kuis tidak valid." };
    }
    const passingScore = parseInt(
      (formData.get("passing_score") as string) || "70",
      10,
    );
    const feedbackMode = ((formData.get("feedback_mode") as string)?.trim() ||
      "none") as "none" | "after_submit" | "per_question";
    const shuffleQuestions = formData.get("shuffle_questions") === "true";
    const shuffleOptions = formData.get("shuffle_options") === "true";
    const soundEffects = formData.get("sound_effects") === "true";

    const openAtRaw = (formData.get("open_at") as string)?.trim();
    const dueAtRaw = (formData.get("due_at") as string)?.trim();
    const closeAtRaw = (formData.get("close_at") as string)?.trim();
    const reviewAtRaw = (formData.get("review_at") as string)?.trim();
    const allowLate = formData.get("allow_late") === "true";
    const maxAttemptsRaw = (formData.get("max_attempts") as string)?.trim();
    const maxAttempts = maxAttemptsRaw ? parseInt(maxAttemptsRaw, 10) : null;

    if (!title) return { error: "Judul kuis wajib diisi." };
    if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
      return {
        error: "Nilai kelulusan (passing score) harus antara 0 dan 100.",
      };
    }

    const openAtDate = openAtRaw ? parseDateTimeLocalWib(openAtRaw) : null;
    const dueAtDate = dueAtRaw ? parseDateTimeLocalWib(dueAtRaw) : null;
    const closeAtDate = closeAtRaw ? parseDateTimeLocalWib(closeAtRaw) : null;
    const reviewAtDate = reviewAtRaw ? parseDateTimeLocalWib(reviewAtRaw) : null;
    if (
      (openAtRaw && !openAtDate) ||
      (dueAtRaw && !dueAtDate) ||
      (closeAtRaw && !closeAtDate) ||
      (reviewAtRaw && !reviewAtDate)
    ) {
      return { error: "Format waktu kuis tidak valid." };
    }

    const openAt = openAtDate?.toISOString() ?? null;
    const dueAt = dueAtDate?.toISOString() ?? null;
    const closeAt = closeAtDate?.toISOString() ?? null;
    const reviewAt = reviewAtDate?.toISOString() ?? null;

    const { data: existingQuiz } = await supabase
      .from("quizzes")
      .select("type")
      .eq("id", quizId)
      .maybeSingle();
    const parsed = quizSchema.safeParse({
      type: existingQuiz?.type ?? "chapter",
      class_id: (formData.get("class_id") as string)?.trim() || null,
      subject_id: (formData.get("subject_id") as string)?.trim() || null,
      module_id: (formData.get("module_id") as string)?.trim() || null,
      material_id: (formData.get("material_id") as string)?.trim() || null,
      title,
      description,
      passing_score: passingScore,
      feedback_mode: feedbackMode,
      review_at: reviewAt,
      sound_effects: soundEffects,
      open_at: openAt,
      due_at: dueAt,
      close_at: closeAt,
      allow_late: allowLate,
      max_attempts: maxAttempts,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Data kuis tidak valid.",
      };
    }

    if (openAt && dueAt && new Date(openAt) >= new Date(dueAt)) {
      return {
        error:
          "Waktu buka kuis harus lebih awal dari tenggat waktu (due date).",
      };
    }
    if (dueAt && closeAt && new Date(closeAt) < new Date(dueAt)) {
      return {
        error:
          "Batas akhir (tutup kuis) tidak boleh lebih awal dari tenggat waktu.",
      };
    }
    if (maxAttempts !== null && (isNaN(maxAttempts) || maxAttempts <= 0)) {
      return {
        error: "Batas percobaan (max attempts) harus berupa angka positif.",
      };
    }

    const updatePayload: Record<string, any> = {
      title,
      description,
      purpose,
      passing_score: passingScore,
      feedback_mode: feedbackMode,
      review_at: reviewAt,
      sound_effects: soundEffects,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      open_at: openAt,
      due_at: dueAt,
      close_at: closeAt,
      allow_late: allowLate,
      max_attempts: maxAttempts,
    };

    const { error } = await supabase
      .from("quizzes")
      .update(updatePayload)
      .eq("id", quizId);

    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath("/student/pra-kelas");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function deleteQuizAction(
  quizId: string,
  classId: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

// ==============================================================================
// 2. MANAJEMEN SOAL & KUNCI JAWABAN (QUESTION_KEYS)
// ==============================================================================

export async function createQuestionAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const classId = (formData.get("class_id") as string)?.trim();
    const quizId = (formData.get("quiz_id") as string)?.trim();
    const questionText = (formData.get("question_text") as string)?.trim();
    const optA = (formData.get("option_a") as string)?.trim();
    const optB = (formData.get("option_b") as string)?.trim();
    const optC = (formData.get("option_c") as string)?.trim();
    const optD = (formData.get("option_d") as string)?.trim();
    const correctOption = (formData.get("correct_option") as string)
      ?.trim()
      .toUpperCase();
    const explanation = (formData.get("explanation") as string)?.trim() || null;
    const parsedExplanation = questionExplanationSchema.safeParse(explanation);
    if (!parsedExplanation.success) {
      return { error: parsedExplanation.error.issues[0]?.message };
    }

    if (!quizId) return { error: "Kuis wajib ditentukan." };
    if (!questionText) return { error: "Teks pertanyaan wajib diisi." };
    if (!optA || !optB || !optC || !optD) {
      return { error: "Semua pilihan jawaban (A, B, C, D) wajib diisi." };
    }
    if (!["A", "B", "C", "D"].includes(correctOption)) {
      return {
        error: "Kunci jawaban harus berupa salah satu dari A, B, C, atau D.",
      };
    }

    const options = [
      { key: "A", text: optA },
      { key: "B", text: optB },
      { key: "C", text: optC },
      { key: "D", text: optD },
    ];

    // 1. Simpan soal ke tabel questions
    const { data: newQuestion, error: qError } = await supabase
      .from("questions")
      .insert({
        quiz_id: quizId,
        question_text: questionText,
        options,
      })
      .select("id")
      .single();

    if (qError || !newQuestion) {
      return { error: qError?.message || "Gagal menyimpan pertanyaan." };
    }

    // 2. Simpan kunci jawaban ke tabel rahasia question_keys
    const { error: keyError } = await supabase.from("question_keys").insert({
      question_id: newQuestion.id,
      correct_option: correctOption,
      explanation: parsedExplanation.data,
    });

    if (keyError) {
      // Rollback pertanyaan jika kunci gagal disimpan
      await supabase.from("questions").delete().eq("id", newQuestion.id);
      return { error: `Gagal menyimpan kunci jawaban: ${keyError.message}` };
    }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function updateQuestionAction(
  questionId: string,
  classId: string,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const questionText = (formData.get("question_text") as string)?.trim();
    const optA = (formData.get("option_a") as string)?.trim();
    const optB = (formData.get("option_b") as string)?.trim();
    const optC = (formData.get("option_c") as string)?.trim();
    const optD = (formData.get("option_d") as string)?.trim();
    const correctOption = (formData.get("correct_option") as string)
      ?.trim()
      .toUpperCase();
    const explanation = (formData.get("explanation") as string)?.trim() || null;
    const parsedExplanation = questionExplanationSchema.safeParse(explanation);
    if (!parsedExplanation.success) {
      return { error: parsedExplanation.error.issues[0]?.message };
    }

    if (!questionText) return { error: "Teks pertanyaan wajib diisi." };
    if (!optA || !optB || !optC || !optD) {
      return { error: "Semua pilihan jawaban (A, B, C, D) wajib diisi." };
    }
    if (!["A", "B", "C", "D"].includes(correctOption)) {
      return {
        error: "Kunci jawaban harus berupa salah satu dari A, B, C, atau D.",
      };
    }

    const options = [
      { key: "A", text: optA },
      { key: "B", text: optB },
      { key: "C", text: optC },
      { key: "D", text: optD },
    ];

    // 1. Update questions
    const { error: qError } = await supabase
      .from("questions")
      .update({
        question_text: questionText,
        options,
      })
      .eq("id", questionId);

    if (qError) return { error: qError.message };

    // 2. Update question_keys
    const { error: keyError } = await supabase.from("question_keys").upsert({
      question_id: questionId,
      correct_option: correctOption,
      explanation: parsedExplanation.data,
    });

    if (keyError) return { error: keyError.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function deleteQuestionAction(
  questionId: string,
  classId: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);
    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

// ==============================================================================
// 3. PENGERJAAN KUIS OLEH SISWA (RPC submit_quiz)
// ==============================================================================

export async function submitQuizAction(
  quizId: string,
  answers: Record<string, string>,
): Promise<{
  success: boolean;
  result?: QuizSubmissionResult;
  error?: string;
}> {
  try {
    await requireRole("student");
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("submit_quiz", {
      p_quiz_id: quizId,
      p_answers: answers,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/student");
    revalidatePath("/student/pra-kelas");
    revalidatePath(`/student/kuis/${quizId}`);
    return { success: true, result: data as QuizSubmissionResult };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengumpulkan kuis.",
    };
  }
}

export type PerQuestionAnswerFeedback = {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
};

export async function startQuizAction(quizId: string): Promise<{
  success: boolean;
  attemptId?: string;
  answers?: Record<string, string>;
  error?: string;
}> {
  try {
    const profile = await requireRole("student");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_quiz", {
      p_quiz_id: quizId,
    });
    if (error) return { success: false, error: error.message };

    const attemptId = (data as { attempt_id?: string } | null)?.attempt_id;
    if (!attemptId)
      return { success: false, error: "Percobaan kuis gagal dimulai." };

    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .select("answers")
      .eq("id", attemptId)
      .eq("student_id", profile.id)
      .maybeSingle();
    if (attemptError || !attempt) {
      return { success: false, error: "Jawaban tersimpan gagal dimuat." };
    }

    const answers =
      attempt.answers && typeof attempt.answers === "object"
        ? (attempt.answers as Record<string, string>)
        : {};
    return { success: true, attemptId, answers };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memulai kuis.",
    };
  }
}

export async function answerQuestionAction(
  attemptId: string,
  questionId: string,
  answer: string,
): Promise<{
  success: boolean;
  feedback?: PerQuestionAnswerFeedback;
  error?: string;
}> {
  try {
    await requireRole("student");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("answer_question", {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_answer: answer,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, feedback: data as PerQuestionAnswerFeedback };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Jawaban gagal dikirim.",
    };
  }
}

export async function finishQuizAction(
  quizId: string,
  attemptId: string,
): Promise<{
  success: boolean;
  result?: QuizSubmissionResult;
  error?: string;
}> {
  try {
    await requireRole("student");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finish_quiz", {
      p_attempt_id: attemptId,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/student");
    revalidatePath("/student/pra-kelas");
    revalidatePath(`/student/kuis/${quizId}`);
    return { success: true, result: data as QuizSubmissionResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Kuis gagal diselesaikan.",
    };
  }
}
