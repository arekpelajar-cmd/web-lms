"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { TipTapViewer } from "@/components/editor/tiptap-viewer";
import { VideoEmbed } from "@/components/media/video-embed";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Cpu,
  Edit2,
  Eye,
  FileQuestion,
  FileText,
  FolderPlus,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Plus,
  Shuffle,
  Trash2,
  Upload,
  Music2,
  Video,
  Clock,
  Calendar,
  Sparkles,
} from "lucide-react";
import { formatDateTimeId } from "@/lib/assignment-utils";
import { SimulationManagerModal } from "@/components/teacher/simulation-manager-modal";
import type { SimulationItem } from "@/lib/types";
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createMaterialAction,
  updateMaterialAction,
  indexMaterialForChatAction,
  deleteMaterialAction,
  createMaterialAudioAction,
  deleteMaterialAudioAction,
  reorderMaterialAudioAction,
} from "@/lib/actions/teacher";
import {
  getMaterialAudioExtension,
  readMaterialAudioDuration,
  uploadMaterialAudioFile,
  validateMaterialAudioFile,
} from "@/lib/material-audio-upload";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  createQuizAction,
  updateQuizAction,
  deleteQuizAction,
  createQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
} from "@/lib/actions/quiz";

type SubjectInfo = { id: string; name: string };

type QuestionOption = { key: string; text: string };

type QuestionData = {
  id: string;
  quiz_id: string;
  question_text: string;
  options: QuestionOption[];
  order_index: number;
  created_at?: string;
  correct_option?: string;
  explanation?: string | null;
};

type QuizData = {
  id: string;
  module_id?: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  type?: "chapter" | "assessment";
  purpose?: "practice" | "pre_test";
  title: string;
  description?: string | null;
  passing_score: number;
  open_at?: string | null;
  due_at?: string | null;
  close_at?: string | null;
  allow_late?: boolean;
  max_attempts?: number | null;
  order_index: number;
  created_at?: string;
  feedback_mode?: "none" | "after_submit" | "per_question";
  review_at?: string | null;
  sound_effects?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  questions?: QuestionData[];
};

type MaterialData = {
  id: string;
  module_id: string;
  title: string;
  content?: string | null;
  video_url?: string | null;
  is_pre_class?: boolean;
  pre_class_due_at?: string | null;
  order_index: number;
  created_at?: string;
  simulations?: SimulationItem[];
  material_audios?: MaterialAudioData[];
};

type MaterialAudioData = {
  id: string;
  material_id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  transcript: string | null;
  order_index: number;
};

type ModuleData = {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  created_at?: string;
  subjects?: SubjectInfo | null;
  materials?: MaterialData[];
  quizzes?: QuizData[];
};

interface ModulesManagerProps {
  classId: string;
  className: string;
  referralCode: string;
  taughtSubjects: SubjectInfo[];
  initialModules: ModuleData[];
  initialSelectedSubject?: string;
}

export function ModulesManager({
  classId,
  className,
  referralCode,
  taughtSubjects,
  initialModules,
  initialSelectedSubject,
}: ModulesManagerProps) {
  const [modules] = useState<ModuleData[]>(initialModules);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSelectedSubject || taughtSubjects[0]?.id || "all",
  );

  // Module modal states
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editModuleTarget, setEditModuleTarget] = useState<ModuleData | null>(
    null,
  );
  const [deleteModuleTarget, setDeleteModuleTarget] =
    useState<ModuleData | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [moduleSubjectId, setModuleSubjectId] = useState(
    taughtSubjects[0]?.id || "",
  );

  // Material modal states
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialModuleTarget, setMaterialModuleTarget] =
    useState<ModuleData | null>(null);
  const [editMaterialTarget, setEditMaterialTarget] =
    useState<MaterialData | null>(null);
  const [deleteMaterialTarget, setDeleteMaterialTarget] =
    useState<MaterialData | null>(null);
  const [viewMaterialTarget, setViewMaterialTarget] =
    useState<MaterialData | null>(null);
  const [simulationMaterialTarget, setSimulationMaterialTarget] =
    useState<MaterialData | null>(null);
  const [matTitle, setMatTitle] = useState("");
  const [matVideoUrl, setMatVideoUrl] = useState("");
  const [matContent, setMatContent] = useState("");
  const [matIsPreClass, setMatIsPreClass] = useState(false);
  const [matPreClassDueAt, setMatPreClassDueAt] = useState("");
  const [materialAudios, setMaterialAudios] = useState<MaterialAudioData[]>([]);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioTranscript, setAudioTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUploadProgress, setAudioUploadProgress] = useState<number | null>(
    null,
  );
  const [audioSuccess, setAudioSuccess] = useState<string | null>(null);
  const [materialNeedsReload, setMaterialNeedsReload] = useState(false);
  const [indexingMaterialId, setIndexingMaterialId] = useState<string | null>(null);
  const [ragStatus, setRagStatus] = useState<{
    materialId: string;
    message: string;
    error: boolean;
  } | null>(null);
  const audioFileInput = useRef<HTMLInputElement>(null);

  // Quiz modal states
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizModuleTarget, setQuizModuleTarget] = useState<ModuleData | null>(
    null,
  );
  const [editQuizTarget, setEditQuizTarget] = useState<QuizData | null>(null);
  const [deleteQuizTarget, setDeleteQuizTarget] = useState<QuizData | null>(
    null,
  );
  const [quizType, setQuizType] = useState<"chapter" | "assessment">("chapter");
  const [quizPurpose, setQuizPurpose] = useState<"practice" | "pre_test">(
    "practice",
  );
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [quizOpenAt, setQuizOpenAt] = useState("");
  const [quizDueAt, setQuizDueAt] = useState("");
  const [quizCloseAt, setQuizCloseAt] = useState("");
  const [quizAllowLate, setQuizAllowLate] = useState(false);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState("1");
  const [feedbackMode, setFeedbackMode] = useState<
    "none" | "after_submit" | "per_question"
  >("per_question");
  const [quizReviewAt, setQuizReviewAt] = useState("");
  const [quizSoundEffects, setQuizSoundEffects] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // Question modal states
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionQuizTarget, setQuestionQuizTarget] = useState<QuizData | null>(
    null,
  );
  const [editQuestionTarget, setEditQuestionTarget] =
    useState<QuestionData | null>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] =
    useState<QuestionData | null>(null);
  const [viewQuestionsQuizTarget, setViewQuestionsQuizTarget] =
    useState<QuizData | null>(null);

  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOpt, setCorrectOpt] = useState("A");
  const [qExplanation, setQExplanation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter modules
  const filteredModules =
    selectedSubjectId === "all"
      ? modules
      : modules.filter((m) => m.subject_id === selectedSubjectId);

  // ====================================================================
  // MODUL HANDLERS
  // ====================================================================
  function openAddModule() {
    setEditModuleTarget(null);
    setModuleTitle("");
    setModuleDesc("");
    setModuleSubjectId(
      selectedSubjectId !== "all"
        ? selectedSubjectId
        : taughtSubjects[0]?.id || "",
    );
    setError(null);
    setIsModuleModalOpen(true);
  }

  function openEditModule(m: ModuleData) {
    setEditModuleTarget(m);
    setModuleTitle(m.title);
    setModuleDesc(m.description || "");
    setModuleSubjectId(m.subject_id);
    setError(null);
    setIsModuleModalOpen(true);
  }

  async function handleSaveModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("class_id", classId);
    formData.append("subject_id", moduleSubjectId);
    formData.append("title", moduleTitle);
    formData.append("description", moduleDesc);

    const res = editModuleTarget
      ? await updateModuleAction(editModuleTarget.id, classId, formData)
      : await createModuleAction(formData);

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setIsModuleModalOpen(false);
    window.location.reload();
  }

  async function handleDeleteModule() {
    if (!deleteModuleTarget) return;
    setLoading(true);
    setError(null);

    const res = await deleteModuleAction(deleteModuleTarget.id, classId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setDeleteModuleTarget(null);
    window.location.reload();
  }

  // ====================================================================
  // MATERI HANDLERS
  // ====================================================================
  function openAddMaterial(m: ModuleData) {
    setMaterialModuleTarget(m);
    setEditMaterialTarget(null);
    setMatTitle("");
    setMatVideoUrl("");
    setMatContent("");
    setMatIsPreClass(false);
    setMatPreClassDueAt("");
    setMaterialAudios([]);
    setAudioTitle("");
    setAudioTranscript("");
    setAudioFile(null);
    setAudioSuccess(null);
    setMaterialNeedsReload(false);
    setError(null);
    setIsMaterialModalOpen(true);
  }

  function openEditMaterial(m: ModuleData, mat: MaterialData) {
    setMaterialModuleTarget(m);
    setEditMaterialTarget(mat);
    setMatTitle(mat.title);
    setMatVideoUrl(mat.video_url || "");
    setMatContent(mat.content || "");
    setMatIsPreClass(Boolean(mat.is_pre_class));
    setMatPreClassDueAt(formatDateTimeForInput(mat.pre_class_due_at));
    setMaterialAudios(
      [...(mat.material_audios ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    );
    setAudioTitle("");
    setAudioTranscript("");
    setAudioFile(null);
    setAudioSuccess(null);
    setMaterialNeedsReload(false);
    setError(null);
    setIsMaterialModalOpen(true);
  }

  async function handleSaveMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!materialModuleTarget) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("class_id", classId);
    formData.append("module_id", materialModuleTarget.id);
    formData.append("title", matTitle);
    formData.append("video_url", matVideoUrl);
    formData.append("content", matContent);
    formData.append("is_pre_class", String(matIsPreClass));
    formData.append("pre_class_due_at", matPreClassDueAt);

    const isNewMaterial = !editMaterialTarget;
    const res = editMaterialTarget
      ? await updateMaterialAction(editMaterialTarget.id, classId, formData)
      : await createMaterialAction(formData);

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    if (isNewMaterial && res.materialId) {
      setEditMaterialTarget({
        id: res.materialId,
        module_id: materialModuleTarget.id,
        title: matTitle,
        content: matContent,
        video_url: matVideoUrl,
        is_pre_class: matIsPreClass,
        pre_class_due_at: matPreClassDueAt || null,
        order_index: 0,
        material_audios: [],
      });
      setMaterialAudios([]);
      setMaterialNeedsReload(true);
      setAudioSuccess(
        "Materi tersimpan. Audio pembelajaran kini dapat ditambahkan.",
      );
      return;
    }

    setMaterialNeedsReload(true);
    setIsMaterialModalOpen(false);
    window.location.reload();
  }

  function closeMaterialEditor() {
    setIsMaterialModalOpen(false);
    if (materialNeedsReload) window.location.reload();
  }

  function handleAudioFileChange(file: File | null) {
    setAudioSuccess(null);
    if (!file) {
      setAudioFile(null);
      return;
    }
    const validationError = validateMaterialAudioFile(file);
    if (validationError) {
      setAudioFile(null);
      setError(validationError);
      if (audioFileInput.current) audioFileInput.current.value = "";
      return;
    }
    setError(null);
    setAudioFile(file);
  }

  async function handleUploadMaterialAudio() {
    if (!editMaterialTarget) {
      setError("Simpan materi dulu, lalu edit untuk menambah audio.");
      return;
    }
    if (!audioTitle.trim()) {
      setError("Judul audio wajib diisi.");
      return;
    }
    if (!audioFile) {
      setError("Pilih berkas audio terlebih dahulu.");
      return;
    }
    const validationError = validateMaterialAudioFile(audioFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setAudioSuccess(null);
    setAudioUploadProgress(0);
    let filePath = "";
    try {
      const duration = await readMaterialAudioDuration(audioFile);
      const extension = getMaterialAudioExtension(audioFile.type);
      if (!extension) throw new Error("Format audio tidak didukung.");
      filePath = `${editMaterialTarget.id}/${crypto.randomUUID()}.${extension}`;
      await uploadMaterialAudioFile(
        audioFile,
        filePath,
        setAudioUploadProgress,
      );

      const formData = new FormData();
      formData.set("title", audioTitle);
      formData.set("transcript", audioTranscript);
      formData.set("file_path", filePath);
      formData.set("file_type", audioFile.type);
      formData.set("file_size", String(audioFile.size));
      formData.set("duration_seconds", String(duration));
      const result = await createMaterialAudioAction(
        editMaterialTarget.id,
        classId,
        formData,
      );
      if (result.error || !result.audioId) {
        const supabase = createBrowserSupabaseClient();
        await supabase.storage.from("material-audio").remove([filePath]);
        throw new Error(result.error || "Data audio gagal disimpan.");
      }

      setMaterialAudios((current) => [
        ...current,
        {
          id: result.audioId!,
          material_id: editMaterialTarget.id,
          title: audioTitle.trim(),
          file_path: filePath,
          duration_seconds: duration,
          transcript: audioTranscript.trim() || null,
          order_index: current.length,
        },
      ]);
      setMaterialNeedsReload(true);
      setAudioTitle("");
      setAudioTranscript("");
      setAudioFile(null);
      if (audioFileInput.current) audioFileInput.current.value = "";
      setAudioSuccess("Audio pembelajaran berhasil ditambahkan.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unggahan audio gagal.",
      );
    } finally {
      setLoading(false);
      setAudioUploadProgress(null);
    }
  }

  async function handleMoveMaterialAudio(audioId: string, newIndex: number) {
    if (
      !editMaterialTarget ||
      newIndex < 0 ||
      newIndex >= materialAudios.length
    )
      return;
    setLoading(true);
    setError(null);
    const result = await reorderMaterialAudioAction(
      audioId,
      editMaterialTarget.id,
      classId,
      newIndex,
    );
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMaterialAudios((current) => {
      const next = [...current];
      const oldIndex = next.findIndex((audio) => audio.id === audioId);
      if (oldIndex < 0) return current;
      const [audio] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, audio!);
      return next.map((item, index) => ({ ...item, order_index: index }));
    });
    setMaterialNeedsReload(true);
  }

  async function handleDeleteMaterialAudio(audio: MaterialAudioData) {
    if (!editMaterialTarget) return;
    setLoading(true);
    setError(null);
    const result = await deleteMaterialAudioAction(
      audio.id,
      editMaterialTarget.id,
      classId,
    );
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMaterialAudios((current) =>
      current
        .filter((item) => item.id !== audio.id)
        .map((item, index) => ({ ...item, order_index: index })),
    );
    setMaterialNeedsReload(true);
  }

  async function handleDeleteMaterial() {
    if (!deleteMaterialTarget) return;
    setLoading(true);
    setError(null);

    const res = await deleteMaterialAction(deleteMaterialTarget.id, classId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setDeleteMaterialTarget(null);
    window.location.reload();
  }

  // ====================================================================
  // KUIS HANDLERS & HELPERS
  // ====================================================================
  function getDefaultDueAtWib(): string {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T23:59`;
  }

  function formatDateTimeForInput(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function openAddQuiz(m: ModuleData) {
    setQuizModuleTarget(m);
    setEditQuizTarget(null);
    setQuizType("chapter");
    setQuizPurpose("practice");
    setQuizTitle("");
    setQuizDesc("");
    setPassingScore("70");
    setQuizOpenAt("");
    setQuizDueAt(getDefaultDueAtWib());
    setQuizCloseAt("");
    setQuizAllowLate(false);
    setQuizMaxAttempts("1");
    setFeedbackMode("per_question");
    setQuizReviewAt("");
    setQuizSoundEffects(false);
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setError(null);
    setIsQuizModalOpen(true);
  }

  function openEditQuiz(m: ModuleData, qz: QuizData) {
    setQuizModuleTarget(m);
    setEditQuizTarget(qz);
    setQuizType(qz.type ?? "chapter");
    setQuizPurpose(qz.purpose ?? "practice");
    setQuizTitle(qz.title);
    setQuizDesc(qz.description || "");
    setPassingScore(String(qz.passing_score));
    setQuizOpenAt(formatDateTimeForInput(qz.open_at));
    setQuizDueAt(
      formatDateTimeForInput(qz.due_at) ||
        (qz.type === "assessment" ? getDefaultDueAtWib() : ""),
    );
    setQuizCloseAt(formatDateTimeForInput(qz.close_at));
    setQuizAllowLate(qz.allow_late ?? false);
    setQuizMaxAttempts(qz.max_attempts ? String(qz.max_attempts) : "1");
    setFeedbackMode(
      qz.feedback_mode ?? (qz.type === "chapter" ? "per_question" : "none"),
    );
    setQuizReviewAt(formatDateTimeForInput(qz.review_at));
    setQuizSoundEffects(qz.sound_effects ?? false);
    setShuffleQuestions(qz.shuffle_questions ?? false);
    setShuffleOptions(qz.shuffle_options ?? false);
    setError(null);
    setIsQuizModalOpen(true);
  }

  function changeQuizType(nextType: "chapter" | "assessment") {
    setQuizType(nextType);
    setFeedbackMode(nextType === "chapter" ? "per_question" : "none");
    setQuizReviewAt("");
  }

  async function handleSaveQuiz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quizModuleTarget) return;

    setLoading(true);
    setError(null);

    // Validasi Tanggal / Zod di klien
    if (quizType === "assessment") {
      if (!quizDueAt) {
        setLoading(false);
        setError("Tenggat waktu (due date) wajib diisi untuk kuis penilaian.");
        return;
      }
      if (quizOpenAt && new Date(quizOpenAt) >= new Date(quizDueAt)) {
        setLoading(false);
        setError(
          "Waktu buka kuis harus lebih awal dari tenggat waktu (due date).",
        );
        return;
      }
      if (quizCloseAt && new Date(quizCloseAt) < new Date(quizDueAt)) {
        setLoading(false);
        setError(
          "Batas akhir (tutup kuis) tidak boleh lebih awal dari tenggat waktu.",
        );
        return;
      }
      if (
        quizReviewAt &&
        quizOpenAt &&
        new Date(quizReviewAt) < new Date(quizOpenAt)
      ) {
        setLoading(false);
        setError("Pembahasan tidak boleh dibuka sebelum waktu buka kuis.");
        return;
      }
    }

    const formData = new FormData();
    formData.append("type", quizType);
    formData.append("purpose", quizPurpose);
    formData.append("class_id", classId);
    formData.append("subject_id", quizModuleTarget.subject_id);
    formData.append("module_id", quizModuleTarget.id);
    formData.append("title", quizTitle);
    formData.append("description", quizDesc);
    formData.append("passing_score", passingScore);
    formData.append("feedback_mode", feedbackMode);
    formData.append("review_at", quizReviewAt);
    formData.append("sound_effects", String(quizSoundEffects));
    formData.append("shuffle_questions", String(shuffleQuestions));
    formData.append("shuffle_options", String(shuffleOptions));

    if (quizType === "chapter") {
      if (quizDueAt) formData.append("due_at", quizDueAt);
    } else {
      if (quizOpenAt) formData.append("open_at", quizOpenAt);
      if (quizDueAt) formData.append("due_at", quizDueAt);
      if (quizCloseAt) formData.append("close_at", quizCloseAt);
      formData.append("allow_late", String(quizAllowLate));
      if (quizMaxAttempts) formData.append("max_attempts", quizMaxAttempts);
    }

    const res = editQuizTarget
      ? await updateQuizAction(editQuizTarget.id, classId, formData)
      : await createQuizAction(formData);

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setIsQuizModalOpen(false);
    window.location.reload();
  }

  async function handleDeleteQuiz() {
    if (!deleteQuizTarget) return;
    setLoading(true);
    setError(null);

    const res = await deleteQuizAction(deleteQuizTarget.id, classId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setDeleteQuizTarget(null);
    window.location.reload();
  }

  // ====================================================================
  // QUESTION HANDLERS
  // ====================================================================
  function openAddQuestion(qz: QuizData) {
    setQuestionQuizTarget(qz);
    setEditQuestionTarget(null);
    setQText("");
    setOptA("");
    setOptB("");
    setOptC("");
    setOptD("");
    setCorrectOpt("A");
    setQExplanation("");
    setError(null);
    setIsQuestionModalOpen(true);
  }

  function openEditQuestion(qz: QuizData, q: QuestionData) {
    setQuestionQuizTarget(qz);
    setEditQuestionTarget(q);
    setQText(q.question_text);

    const a = q.options.find((o) => o.key === "A")?.text || "";
    const b = q.options.find((o) => o.key === "B")?.text || "";
    const c = q.options.find((o) => o.key === "C")?.text || "";
    const d = q.options.find((o) => o.key === "D")?.text || "";

    setOptA(a);
    setOptB(b);
    setOptC(c);
    setOptD(d);
    setCorrectOpt(q.correct_option || "A");
    setQExplanation(q.explanation || "");
    setError(null);
    setIsQuestionModalOpen(true);
  }

  async function handleSaveQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!questionQuizTarget) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("class_id", classId);
    formData.append("quiz_id", questionQuizTarget.id);
    formData.append("question_text", qText);
    formData.append("option_a", optA);
    formData.append("option_b", optB);
    formData.append("option_c", optC);
    formData.append("option_d", optD);
    formData.append("correct_option", correctOpt);
    formData.append("explanation", qExplanation);

    const res = editQuestionTarget
      ? await updateQuestionAction(editQuestionTarget.id, classId, formData)
      : await createQuestionAction(formData);

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setIsQuestionModalOpen(false);
    window.location.reload();
  }

  async function handleDeleteQuestion() {
    if (!deleteQuestionTarget) return;
    setLoading(true);
    setError(null);

    const res = await deleteQuestionAction(deleteQuestionTarget.id, classId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setDeleteQuestionTarget(null);
    window.location.reload();
  }

  async function handleIndexMaterial(mat: MaterialData) {
    setIndexingMaterialId(mat.id);
    setRagStatus(null);
    try {
      const result = await indexMaterialForChatAction(mat.id, classId);
      setRagStatus({
        materialId: mat.id,
        message: result.error ?? result.message ?? "Indeks materi diperbarui.",
        error: Boolean(result.error),
      });
    } catch (error) {
      setRagStatus({
        materialId: mat.id,
        message:
          error instanceof Error
            ? error.message
            : "Pengindeksan materi gagal. Silakan coba lagi.",
        error: true,
      });
    } finally {
      setIndexingMaterialId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/teacher"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Kelas Saya
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Kelas {className}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                Kode: {referralCode}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelola modul, materi pembelajaran, dan kuis pilihan ganda untuk
              kelas ini.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              asChild
              variant="outline"
              className="gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            >
              <Link href={`/teacher/kelas/${classId}/tugas`}>
                <FileText className="h-4 w-4" /> Kelola Tugas
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Link href={`/teacher/kelas/${classId}/nilai`}>
                <GraduationCap className="h-4 w-4" /> Rekap Nilai Siswa
              </Link>
            </Button>
            <Button onClick={openAddModule} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Modul
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Mapel */}
      {taughtSubjects.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-muted-foreground">
            Filter Mapel:
          </span>
          <Button
            size="sm"
            variant={selectedSubjectId === "all" ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setSelectedSubjectId("all")}
          >
            Semua ({modules.length})
          </Button>
          {taughtSubjects.map((s) => {
            const count = modules.filter((m) => m.subject_id === s.id).length;
            return (
              <Button
                key={s.id}
                size="sm"
                variant={selectedSubjectId === s.id ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setSelectedSubjectId(s.id)}
              >
                {s.name} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {ragStatus && (
        <p
          role={ragStatus.error ? "alert" : "status"}
          className={`text-sm ${ragStatus.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {ragStatus.message}
        </p>
      )}

      {/* Daftar Modul */}
      {filteredModules.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada modul pembelajaran</CardTitle>
            <CardDescription>
              Buat modul bab pertama untuk mulai mengisi materi teks, video, dan
              kuis pilihan ganda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openAddModule} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Buat Modul Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredModules.map((m, idx) => (
            <Card key={m.id} className="overflow-hidden border shadow-sm">
              <CardHeader className="bg-muted/20 pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Modul {idx + 1}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {m.subjects?.name ?? "Mata Pelajaran"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-semibold">
                      {m.title}
                    </CardTitle>
                    {m.description && (
                      <CardDescription className="text-sm">
                        {m.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openAddMaterial(m)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah Materi
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => openAddQuiz(m)}
                    >
                      <FileQuestion className="h-3.5 w-3.5" /> Buat Kuis
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditModule(m)}
                      title="Ubah Modul"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteModuleTarget(m)}
                      title="Hapus Modul"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-5">
                {/* Bagian Materi */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                    Materi Pembelajaran ({m.materials?.length || 0})
                  </h4>

                  {!m.materials || m.materials.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Belum ada materi teks/video di bab ini.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {m.materials.map((mat, matIdx) => (
                        <div
                          key={mat.id}
                          className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                              {matIdx + 1}
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {mat.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {mat.is_pre_class && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300"
                                  >
                                    Pra-kelas
                                  </Badge>
                                )}
                                {mat.simulations &&
                                  mat.simulations.length > 0 && (
                                    <span className="flex items-center gap-1 text-primary font-medium">
                                      <Cpu className="h-3 w-3" /> Simulasi (
                                      {mat.simulations.length})
                                    </span>
                                  )}
                                {mat.video_url && (
                                  <span className="flex items-center gap-1 text-primary">
                                    <Video className="h-3 w-3" /> Video Embed
                                  </span>
                                )}
                                {mat.content && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" /> Teks
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 self-end sm:self-auto">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={indexingMaterialId !== null}
                              onClick={() => handleIndexMaterial(mat)}
                            >
                              <Sparkles className="h-3 w-3" />
                              {indexingMaterialId === mat.id ? "Mengindeks..." : "Indeks AI"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => setSimulationMaterialTarget(mat)}
                            >
                              <Cpu className="h-3 w-3" /> Simulasi (
                              {mat.simulations?.length || 0})
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs gap-1"
                              onClick={() => setViewMaterialTarget(mat)}
                            >
                              <Eye className="h-3 w-3" /> Lihat
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => openEditMaterial(m, mat)}
                            >
                              <Edit2 className="h-3 w-3" /> Ubah
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteMaterialTarget(mat)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bagian Kuis Pilihan Ganda */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileQuestion className="h-3.5 w-3.5 text-primary" />
                      Kuis Evaluasi Bab ({m.quizzes?.length || 0})
                    </h4>
                  </div>

                  {!m.quizzes || m.quizzes.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                      Belum ada kuis pilihan ganda di bab ini. Klik tombol{" "}
                      <strong>&quot;Buat Kuis&quot;</strong> di atas untuk
                      membuat evaluasi.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {m.quizzes.map((qz) => (
                        <div
                          key={qz.id}
                          className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 transition-all hover:bg-primary/10"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {qz.title}
                                </span>
                                <Badge
                                  variant={
                                    qz.type === "assessment"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className={`text-[10px] ${
                                    qz.type === "assessment"
                                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                                      : ""
                                  }`}
                                >
                                  {qz.type === "assessment"
                                    ? "Kuis Penilaian"
                                    : "Kuis Bab"}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-mono"
                                >
                                  KKM: {qz.passing_score}%
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {qz.questions?.length || 0} Soal
                                </Badge>
                                {qz.purpose === "pre_test" && (
                                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                    Pre-test pra-kelas
                                  </Badge>
                                )}
                                {qz.due_at && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 text-muted-foreground"
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    {qz.type === "assessment"
                                      ? `Tenggat: ${formatDateTimeId(qz.due_at)}`
                                      : `Target: ${formatDateTimeId(qz.due_at)}`}
                                  </Badge>
                                )}
                                {qz.type === "assessment" &&
                                  qz.max_attempts && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-muted-foreground"
                                    >
                                      Batas: {qz.max_attempts}x
                                    </Badge>
                                  )}
                                {qz.shuffle_questions && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  >
                                    <Shuffle className="h-2.5 w-2.5" /> Acak
                                    Soal
                                  </Badge>
                                )}
                                {qz.shuffle_options && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                  >
                                    <Shuffle className="h-2.5 w-2.5" /> Acak
                                    Opsi A-D
                                  </Badge>
                                )}
                              </div>
                              {qz.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {qz.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs gap-1"
                                onClick={() => openAddQuestion(qz)}
                              >
                                <Plus className="h-3 w-3" /> Tambah Soal
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => setViewQuestionsQuizTarget(qz)}
                              >
                                <HelpCircle className="h-3 w-3" /> Kelola Soal
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditQuiz(m, qz)}
                                title="Ubah Kuis"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteQuizTarget(qz)}
                                title="Hapus Kuis"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: Tambah / Edit Modul */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        title={editModuleTarget ? "Ubah Modul" : "Tambah Modul Baru"}
        description="Buat bab atau topik pembelajaran untuk kelas ini."
      >
        <form onSubmit={handleSaveModule} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="m-subject">Mata Pelajaran</Label>
            <select
              id="m-subject"
              value={moduleSubjectId}
              onChange={(e) => setModuleSubjectId(e.target.value)}
              disabled={!!editModuleTarget}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              required
            >
              {taughtSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-title">Judul Modul</Label>
            <Input
              id="m-title"
              placeholder="Contoh: Bab 1: Persamaan Linear dan Kuadrat"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-desc">Deskripsi Singkat (Opsional)</Label>
            <Textarea
              id="m-desc"
              placeholder="Ringkasan kompetensi dasar atau materi yang dipelajari..."
              value={moduleDesc}
              onChange={(e) => setModuleDesc(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModuleModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Menyimpan..."
                : editModuleTarget
                  ? "Simpan Perubahan"
                  : "Buat Modul"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Hapus Modul */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!deleteModuleTarget}
        onClose={() => setDeleteModuleTarget(null)}
        title="Hapus Modul"
        description="Apakah Anda yakin ingin menghapus modul ini?"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <p className="text-sm">
            Modul <strong>{deleteModuleTarget?.title}</strong> beserta seluruh
            materi dan kuis di dalamnya akan dihapus secara permanen.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModuleTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteModule}
              disabled={loading}
            >
              {loading ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Tambah / Edit Materi */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isMaterialModalOpen}
        onClose={closeMaterialEditor}
        title={
          editMaterialTarget ? "Ubah Materi Pembelajaran" : "Tambah Materi Baru"
        }
        description={`Modul: ${materialModuleTarget?.title || ""}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveMaterial} className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mat-title">Judul Materi</Label>
            <Input
              id="mat-title"
              placeholder="Contoh: Pengenalan Konsep & Rumus Dasar"
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mat-video">
              URL Video Pembelajaran (YouTube / Google Drive)
            </Label>
            <Input
              id="mat-video"
              placeholder="Contoh: https://www.youtube.com/watch?v=... atau https://drive.google.com/file/d/.../view"
              value={matVideoUrl}
              onChange={(e) => setMatVideoUrl(e.target.value)}
            />
            {matVideoUrl && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Pratinjau Video:
                </p>
                <VideoEmbed url={matVideoUrl} title="Pratinjau Video" />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={matIsPreClass}
                onChange={(event) => {
                  setMatIsPreClass(event.target.checked);
                  if (!event.target.checked) setMatPreClassDueAt("");
                }}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block font-medium">Materi pra-kelas</span>
                <span className="block text-xs text-muted-foreground">
                  Materi ini muncul di daftar persiapan siswa sebelum pertemuan.
                </span>
              </span>
            </label>
            {matIsPreClass && (
              <div className="space-y-1.5">
                <Label htmlFor="mat-preclass-due" className="text-xs">
                  Target selesai (opsional, WIB)
                </Label>
                <Input
                  id="mat-preclass-due"
                  type="datetime-local"
                  value={matPreClassDueAt}
                  onChange={(event) => setMatPreClassDueAt(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Atur sekitar dua hari sebelum kelas dimulai (H-2).
                </p>
              </div>
            )}
          </div>

          <section
            className="space-y-3 rounded-md border p-4"
            aria-labelledby="material-audio-heading"
          >
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 id="material-audio-heading" className="text-sm font-semibold">
                Audio pembelajaran
              </h3>
            </div>

            {!editMaterialTarget ? (
              <p className="text-xs text-muted-foreground">
                Simpan materi dulu, lalu edit untuk menambah audio.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="material-audio-title">Judul audio</Label>
                  <Input
                    id="material-audio-title"
                    value={audioTitle}
                    onChange={(event) => setAudioTitle(event.target.value)}
                    maxLength={160}
                    placeholder="Contoh: Penjelasan Hukum Newton"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="material-audio-file">
                    Berkas audio (maksimal 10 MB)
                  </Label>
                  <Input
                    ref={audioFileInput}
                    id="material-audio-file"
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.mp4,.m4a,.ogg"
                    onChange={(event) =>
                      handleAudioFileChange(event.target.files?.[0] ?? null)
                    }
                  />
                  {audioFile && (
                    <p className="text-xs text-muted-foreground">
                      {audioFile.name} ·{" "}
                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="material-audio-transcript">
                    Transkrip (opsional, maksimal 5.000 karakter)
                  </Label>
                  <Textarea
                    id="material-audio-transcript"
                    value={audioTranscript}
                    onChange={(event) => setAudioTranscript(event.target.value)}
                    maxLength={5000}
                    rows={3}
                    placeholder="Tulis transkrip audio..."
                  />
                  <p className="text-right text-[11px] text-muted-foreground">
                    {Array.from(audioTranscript).length}/5.000
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleUploadMaterialAudio}
                  disabled={loading || !audioFile || !audioTitle.trim()}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {audioUploadProgress !== null
                    ? `Mengunggah ${audioUploadProgress}%`
                    : "Unggah audio"}
                </Button>
                {audioUploadProgress !== null && (
                  <progress
                    className="block h-2 w-full accent-primary"
                    max={100}
                    value={audioUploadProgress}
                    aria-label={`Progres unggah audio ${audioUploadProgress}%`}
                  />
                )}
                {audioSuccess && (
                  <p className="text-xs text-emerald-700">{audioSuccess}</p>
                )}

                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-xs font-semibold">
                    Audio tersimpan ({materialAudios.length})
                  </h4>
                  {materialAudios.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada audio pada materi ini.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {materialAudios.map((audio, index) => (
                        <li
                          key={audio.id}
                          className="flex items-start gap-3 rounded-md border p-3"
                        >
                          <Music2
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium">
                              {audio.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {audio.duration_seconds
                                ? `${Math.floor(audio.duration_seconds / 60)}:${String(Math.floor(audio.duration_seconds % 60)).padStart(2, "0")}`
                                : "Durasi tidak tersedia"}
                              {audio.transcript ? " · Transkrip tersedia" : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Pindahkan ${audio.title} ke atas`}
                              title="Pindahkan ke atas"
                              disabled={loading || index === 0}
                              onClick={() =>
                                handleMoveMaterialAudio(audio.id, index - 1)
                              }
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Pindahkan ${audio.title} ke bawah`}
                              title="Pindahkan ke bawah"
                              disabled={
                                loading || index === materialAudios.length - 1
                              }
                              onClick={() =>
                                handleMoveMaterialAudio(audio.id, index + 1)
                              }
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Hapus ${audio.title}`}
                              title="Hapus audio"
                              disabled={loading}
                              onClick={() => handleDeleteMaterialAudio(audio)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </>
            )}
          </section>

          <div className="space-y-2">
            <Label>Isi Materi Pembelajaran (Rich Text)</Label>
            <TipTapEditor
              value={matContent}
              onChange={(html) => setMatContent(html)}
              placeholder="Tulis uraian materi di sini..."
              materialId={
                editMaterialTarget?.id ||
                `new_${materialModuleTarget?.id || "default"}`
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeMaterialEditor}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Menyimpan..."
                : editMaterialTarget
                  ? "Simpan Perubahan"
                  : "Terbitkan Materi"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Hapus Materi */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!deleteMaterialTarget}
        onClose={() => setDeleteMaterialTarget(null)}
        title="Hapus Materi"
        description="Apakah Anda yakin ingin menghapus materi ini?"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <p className="text-sm">
            Materi <strong>{deleteMaterialTarget?.title}</strong> akan dihapus
            secara permanen.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteMaterialTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteMaterial}
              disabled={loading}
            >
              {loading ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Tambah / Edit Kuis */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        title={editQuizTarget ? "Ubah Kuis" : "Buat Kuis Pilihan Ganda"}
        description={`Modul: ${quizModuleTarget?.title || ""}`}
      >
        <form onSubmit={handleSaveQuiz} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Pemilihan Jenis Kuis */}
          <div className="space-y-2">
            <Label>Jenis Kuis</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeQuizType("chapter")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  quizType === "chapter"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="text-xs font-semibold text-foreground">
                  Kuis Bab
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Prasyarat materi modul. Selalu menerima pengumpulan kapan
                  saja.
                </div>
              </button>

              <button
                type="button"
                onClick={() => changeQuizType("assessment")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  quizType === "assessment"
                    ? "border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-600"
                    : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="text-xs font-semibold text-foreground">
                  Kuis Penilaian
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Ujian/evaluasi dengan batas waktu (open, due, close) & batas
                  percobaan.
                </div>
              </button>
            </div>
          </div>

          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Tujuan kuis</legend>
            {(
              [
                ["practice", "Latihan / kuis biasa"],
                ["pre_test", "Pre-test pra-kelas"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded-md p-2 text-xs hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="quiz_purpose"
                  value={value}
                  checked={quizPurpose === value}
                  onChange={() => setQuizPurpose(value)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{label}</span>
              </label>
            ))}
            {quizPurpose === "pre_test" && (
              <p className="px-2 text-[11px] text-muted-foreground">
                Atur target pengumpulan sekitar H-2 sebelum pertemuan. Pre-test
                selesai dihitung satu kali untuk poin. Untuk menegakkan batas
                waktu, gunakan jenis Kuis Penilaian; target Kuis Bab hanya
                rekomendasi.
              </p>
            )}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="quiz-title">Judul Kuis</Label>
            <Input
              id="quiz-title"
              placeholder={
                quizType === "assessment"
                  ? "Contoh: Ujian Tengah Semester (UTS)"
                  : "Contoh: Kuis Uji Kompetensi Bab 1"
              }
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quiz-passing">
              Nilai Kelulusan Minimum / KKM (%)
            </Label>
            <Input
              id="quiz-passing"
              type="number"
              min={0}
              max={100}
              placeholder="70"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {quizType === "chapter"
                ? "Siswa wajib mencapai nilai ini agar dinyatakan lulus dan membuka materi bab selanjutnya."
                : "Batas nilai minimum kriteria kelulusan (KKM) untuk kuis penilaian ini."}
            </p>
          </div>

          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">
              Tampilan hasil
            </legend>
            {(
              [
                [
                  "none",
                  "Tanpa pembahasan",
                  "Siswa hanya melihat skor dan status kelulusan.",
                ],
                [
                  "after_submit",
                  "Pembahasan setelah selesai",
                  "Siswa membuka pembahasan setelah mengumpulkan kuis.",
                ],
                [
                  "per_question",
                  "Langsung per soal",
                  "Siswa melihat koreksi setelah menjawab setiap soal.",
                ],
              ] as const
            ).map(([value, label, description]) => (
              <label
                key={value}
                className="flex items-start gap-2.5 rounded-md p-2 text-xs hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="feedback_mode"
                  value={value}
                  checked={feedbackMode === value}
                  disabled={
                    quizType === "assessment" && value === "per_question"
                  }
                  onChange={() => setFeedbackMode(value)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Kolom Khusus Kuis Bab: Target Due Date Opsional */}
          {quizType === "chapter" && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label
                htmlFor="quiz-due-chapter"
                className="text-xs flex items-center gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Target Penyelesaian (Opsional, WIB)
              </Label>
              <Input
                id="quiz-due-chapter"
                type="datetime-local"
                value={quizDueAt}
                onChange={(e) => setQuizDueAt(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Tampil di siswa sebagai rekomendasi target (&quot;disarankan
                selesai sebelum ...&quot;). Pengumpulan tetap diterima kapan
                saja.
              </p>
            </div>
          )}

          {/* Kolom Khusus Kuis Penilaian: Jadwal Waktu & Batas Percobaan */}
          {quizType === "assessment" && (
            <div className="space-y-3.5 rounded-lg border border-purple-500/20 bg-purple-500/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                <Clock className="h-4 w-4" />
                <span>Pengaturan Waktu & Batas Pengerjaan (WIB)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quiz-open-at" className="text-xs">
                    Waktu Dibuka (open_at, Opsional)
                  </Label>
                  <Input
                    id="quiz-open-at"
                    type="datetime-local"
                    value={quizOpenAt}
                    onChange={(e) => setQuizOpenAt(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Sebelum waktu ini, butir soal dilindungi RLS dan tidak bisa
                    dibaca siswa.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="quiz-due-at"
                    className="text-xs font-medium text-purple-700 dark:text-purple-300"
                  >
                    Tenggat Waktu (due_at, Wajib) *
                  </Label>
                  <Input
                    id="quiz-due-at"
                    type="datetime-local"
                    value={quizDueAt}
                    onChange={(e) => setQuizDueAt(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Default tenggat pukul 23:59 WIB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quiz-close-at" className="text-xs">
                    Batas Akhir Penutupan (close_at, Opsional)
                  </Label>
                  <Input
                    id="quiz-close-at"
                    type="datetime-local"
                    value={quizCloseAt}
                    onChange={(e) => setQuizCloseAt(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Setelah waktu ini, kuis ditutup total dan pengumpulan
                    otomatis ditolak.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="quiz-max-attempts" className="text-xs">
                    Batas Maksimal Percobaan (max_attempts)
                  </Label>
                  <Input
                    id="quiz-max-attempts"
                    type="number"
                    min={1}
                    value={quizMaxAttempts}
                    onChange={(e) => setQuizMaxAttempts(e.target.value)}
                    placeholder="1"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Default 1 kali percobaan untuk kuis penilaian.
                  </p>
                </div>
              </div>

              <div className="pt-1 border-t border-purple-500/20">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={quizAllowLate}
                    onChange={(e) => setQuizAllowLate(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input text-purple-600 focus:ring-purple-600"
                  />
                  <div>
                    <span className="font-medium text-foreground">
                      Izinkan Pengumpulan Terlambat (Mode Fleksibel)
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Bila dicentang, siswa masih bisa mengerjakan setelah
                      tenggat waktu dengan tanda status terlambat (
                      <code className="text-[10px]">is_late = true</code>). Bila
                      tidak dicentang (mode ketat), pengumpulan ditolak setelah
                      tenggat.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {quizType === "assessment" && feedbackMode !== "none" && (
            <section className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3">
              <Label htmlFor="quiz-review-at">
                Pembahasan dibuka pada (opsional, WIB)
              </Label>
              <Input
                id="quiz-review-at"
                type="datetime-local"
                value={quizReviewAt}
                onChange={(event) => setQuizReviewAt(event.target.value)}
              />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Tanpa jadwal ini, siswa yang selesai lebih awal dapat membagikan
                kunci jawaban.
              </p>
            </section>
          )}

          <div className="space-y-2">
            <Label htmlFor="quiz-desc">Petunjuk Kuis (Opsional)</Label>
            <Textarea
              id="quiz-desc"
              placeholder="Pilih satu jawaban yang paling tepat untuk setiap pertanyaan..."
              value={quizDesc}
              onChange={(e) => setQuizDesc(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Shuffle className="h-3.5 w-3.5 text-primary" />
              <span>Pengacakan Soal & Pilihan Jawaban (Anti-Mencontek)</span>
            </div>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-foreground">
                  Acak Urutan Soal (Shuffle Questions)
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Urutan butir soal akan diacak otomatis setiap siswa
                  mengerjakan atau mengulang kuis (remedial).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-foreground">
                  Acak Urutan Pilihan Jawaban A, B, C, D (Shuffle Options)
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Posisi pilihan A, B, C, D diacak di layar siswa tanpa
                  memengaruhi kunci jawaban dan akurasi penilaian.
                </p>
              </div>
            </label>
          </div>

          <div className="rounded-lg border p-3">
            <label className="flex cursor-pointer select-none items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                checked={quizSoundEffects}
                onChange={(event) => setQuizSoundEffects(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span>
                <span className="font-medium text-foreground">
                  Efek suara kuis
                </span>
                <span className="mt-0.5 block leading-relaxed text-muted-foreground">
                  Default mati. Jika aktif, siswa mendengar efek suara saat
                  hasil kuis ditampilkan.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQuizModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Menyimpan..."
                : editQuizTarget
                  ? "Simpan Perubahan"
                  : "Buat Kuis"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Hapus Kuis */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!deleteQuizTarget}
        onClose={() => setDeleteQuizTarget(null)}
        title="Hapus Kuis"
        description="Apakah Anda yakin ingin menghapus kuis ini?"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <p className="text-sm">
            Kuis <strong>{deleteQuizTarget?.title}</strong> beserta seluruh
            butir soal, kunci jawaban, dan riwayat nilai siswa akan dihapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteQuizTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteQuiz}
              disabled={loading}
            >
              {loading ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Tambah / Edit Soal & Kunci Jawaban */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={
          editQuestionTarget ? "Ubah Soal Kuis" : "Tambah Soal Pilihan Ganda"
        }
        description={`Kuis: ${questionQuizTarget?.title || ""}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="q-text">Pertanyaan / Soal</Label>
            <Textarea
              id="q-text"
              placeholder="Tuliskan pertanyaan soal pilihan ganda di sini..."
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider font-semibold">
              Pilihan Jawaban
            </Label>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-bold text-xs shrink-0">
                  A
                </span>
                <Input
                  placeholder="Pilihan A"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-bold text-xs shrink-0">
                  B
                </span>
                <Input
                  placeholder="Pilihan B"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-bold text-xs shrink-0">
                  C
                </span>
                <Input
                  placeholder="Pilihan C"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-bold text-xs shrink-0">
                  D
                </span>
                <Input
                  placeholder="Pilihan D"
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* KUNCI JAWABAN */}
          <div className="space-y-2 rounded-lg border bg-amber-500/10 border-amber-500/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <KeyRound className="h-4 w-4" />
              <span>Kunci Jawaban yang Benar (Disimpan ke question_keys)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Kunci ini dirahasiakan dan tidak akan dapat dilihat oleh siswa di
              jaringan/browser.
            </p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {(["A", "B", "C", "D"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCorrectOpt(k)}
                  className={`flex items-center justify-center rounded-md border py-2 font-bold text-sm transition-all ${
                    correctOpt === k
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-explanation">
              Alasan jawaban benar (opsional)
            </Label>
            <Textarea
              id="q-explanation"
              value={qExplanation}
              onChange={(event) =>
                setQExplanation(event.target.value.slice(0, 1000))
              }
              maxLength={1000}
              rows={3}
              placeholder="Jelaskan mengapa pilihan tersebut benar..."
            />
            <p className="text-right text-xs text-muted-foreground">
              {qExplanation.length}/1.000
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQuestionModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Menyimpan..."
                : editQuestionTarget
                  ? "Simpan Perubahan"
                  : "Simpan Soal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Kelola Daftar Soal dalam Kuis */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!viewQuestionsQuizTarget}
        onClose={() => setViewQuestionsQuizTarget(null)}
        title={`Daftar Soal: ${viewQuestionsQuizTarget?.title || ""}`}
        description="Kelola dan periksa butir soal beserta kunci jawaban."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <Badge variant="outline">
              Total {viewQuestionsQuizTarget?.questions?.length || 0} Soal
            </Badge>
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={() => {
                const target = viewQuestionsQuizTarget;
                if (target) openAddQuestion(target);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Soal Baru
            </Button>
          </div>

          {!viewQuestionsQuizTarget?.questions ||
          viewQuestionsQuizTarget.questions.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground italic">
              Belum ada soal pada kuis ini. Klik tombol di atas untuk membuat
              soal pilihan ganda.
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {viewQuestionsQuizTarget.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-lg border bg-card p-3.5 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground">
                      {qIdx + 1}. {q.question_text}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          if (viewQuestionsQuizTarget)
                            openEditQuestion(viewQuestionsQuizTarget, q);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteQuestionTarget(q)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {q.options.map((opt) => (
                      <div
                        key={opt.key}
                        className={`flex items-center gap-1.5 rounded-md p-1.5 border ${
                          opt.key === q.correct_option
                            ? "border-emerald-500 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400"
                            : "border-muted bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <span className="font-mono">{opt.key}.</span>
                        <span className="truncate">{opt.text}</span>
                        {opt.key === q.correct_option && (
                          <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setViewQuestionsQuizTarget(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Hapus Soal */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!deleteQuestionTarget}
        onClose={() => setDeleteQuestionTarget(null)}
        title="Hapus Soal"
        description="Apakah Anda yakin ingin menghapus butir soal ini?"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <p className="text-sm">
            Soal{" "}
            <strong>&quot;{deleteQuestionTarget?.question_text}&quot;</strong>{" "}
            akan dihapus dari kuis.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteQuestionTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteQuestion}
              disabled={loading}
            >
              {loading ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: Pratinjau Materi Guru */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!viewMaterialTarget}
        onClose={() => setViewMaterialTarget(null)}
        title={viewMaterialTarget?.title || "Detail Materi"}
        description="Pratinjau materi seperti yang dilihat siswa."
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {viewMaterialTarget?.video_url && (
            <VideoEmbed
              url={viewMaterialTarget.video_url}
              title={viewMaterialTarget.title}
            />
          )}

          <div className="rounded-lg border bg-card p-4 sm:p-5">
            <TipTapViewer content={viewMaterialTarget?.content} />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMaterialTarget(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Kelola Simulasi Materi */}
      {simulationMaterialTarget && (
        <SimulationManagerModal
          isOpen={!!simulationMaterialTarget}
          onClose={() => setSimulationMaterialTarget(null)}
          materialId={simulationMaterialTarget.id}
          materialTitle={simulationMaterialTarget.title}
          classId={classId}
          initialSimulations={simulationMaterialTarget.simulations || []}
        />
      )}
    </div>
  );
}
