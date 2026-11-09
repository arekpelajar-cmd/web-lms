"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseDateTimeLocalWib } from "@/lib/assignment-utils";

export type ActionState = {
  success?: boolean;
  error?: string | null;
  materialId?: string;
  audioId?: string;
};

const MATERIAL_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
]);
const MATERIAL_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function validateMaterialAudioMetadata(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const transcript = String(formData.get("transcript") ?? "");
  const filePath = String(formData.get("file_path") ?? "");
  const fileType = String(formData.get("file_type") ?? "");
  const fileSize = Number(formData.get("file_size"));
  const rawDuration = String(formData.get("duration_seconds") ?? "");
  const duration = rawDuration ? Number(rawDuration) : null;

  if (!title) return { error: "Judul audio wajib diisi." };
  if (!MATERIAL_AUDIO_TYPES.has(fileType))
    return { error: "Format audio harus MP3, MP4/M4A, atau OGG." };
  if (
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > MATERIAL_AUDIO_MAX_BYTES
  ) {
    return { error: "Ukuran audio harus lebih dari 0 dan maksimal 10 MB." };
  }
  if (Array.from(transcript).length > 5000)
    return { error: "Transkrip maksimal 5.000 karakter." };
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) {
    return { error: "Durasi audio tidak valid." };
  }

  return {
    title,
    transcript: transcript || null,
    filePath,
    fileType,
    fileSize,
    duration,
  };
}

// ==============================================================================
// 1. MODUL (CRUD)
// ==============================================================================

export async function createModuleAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const profile = await requireRole("teacher");
    const supabase = await createClient();

    const classId = (formData.get("class_id") as string)?.trim();
    const subjectId = (formData.get("subject_id") as string)?.trim();
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;

    if (!classId || !subjectId)
      return { error: "Kelas dan Mata Pelajaran wajib ditentukan." };
    if (!title) return { error: "Judul modul wajib diisi." };

    // Ambil order_index terakhir di kelas dan mapel ini
    const { data: lastModule } = await supabase
      .from("modules")
      .select("order_index")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastModule?.order_index ?? -1) + 1;

    const { error } = await supabase.from("modules").insert({
      class_id: classId,
      subject_id: subjectId,
      title,
      description,
      order_index: nextOrder,
      created_by: profile.id,
    });

    if (error) return { error: error.message };

    revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function updateModuleAction(
  moduleId: string,
  classId: string,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;

    if (!title) return { error: "Judul modul wajib diisi." };

    const { error } = await supabase
      .from("modules")
      .update({ title, description })
      .eq("id", moduleId);

    if (error) return { error: error.message };

    revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function deleteModuleAction(
  moduleId: string,
  classId: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", moduleId);
    if (error) return { error: error.message };

    revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

// ==============================================================================
// 2. MATERI (CRUD)
// ==============================================================================

export async function createMaterialAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const classId = (formData.get("class_id") as string)?.trim();
    const moduleId = (formData.get("module_id") as string)?.trim();
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim() || "";
    const videoUrl = (formData.get("video_url") as string)?.trim() || null;
    const isPreClass = formData.get("is_pre_class") === "true";
    const preClassDueAtRaw = (formData.get("pre_class_due_at") as string)?.trim();
    const preClassDueAt =
      isPreClass && preClassDueAtRaw
        ? parseDateTimeLocalWib(preClassDueAtRaw)
        : null;

    if (!moduleId) return { error: "Modul wajib ditentukan." };
    if (!title) return { error: "Judul materi wajib diisi." };
    if (isPreClass && preClassDueAtRaw && !preClassDueAt) {
      return { error: "Batas waktu pra-kelas tidak valid." };
    }

    // Ambil order_index terakhir di modul ini
    const { data: lastMaterial } = await supabase
      .from("materials")
      .select("order_index")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastMaterial?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("materials")
      .insert({
        module_id: moduleId,
        title,
        content,
        video_url: videoUrl,
        is_pre_class: isPreClass,
        pre_class_due_at: preClassDueAt?.toISOString() ?? null,
        order_index: nextOrder,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath("/student/pra-kelas");
    return { success: true, materialId: data.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

export async function updateMaterialAction(
  materialId: string,
  classId: string,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim() || "";
    const videoUrl = (formData.get("video_url") as string)?.trim() || null;
    const isPreClass = formData.get("is_pre_class") === "true";
    const preClassDueAtRaw = (formData.get("pre_class_due_at") as string)?.trim();
    const preClassDueAt =
      isPreClass && preClassDueAtRaw
        ? parseDateTimeLocalWib(preClassDueAtRaw)
        : null;

    if (!title) return { error: "Judul materi wajib diisi." };
    if (isPreClass && preClassDueAtRaw && !preClassDueAt) {
      return { error: "Batas waktu pra-kelas tidak valid." };
    }

    const { error } = await supabase
      .from("materials")
      .update({
        title,
        content,
        video_url: videoUrl,
        is_pre_class: isPreClass,
        pre_class_due_at: preClassDueAt?.toISOString() ?? null,
      })
      .eq("id", materialId);

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

export async function createMaterialAudioAction(
  materialId: string,
  classId: string,
  formData: FormData,
): Promise<ActionState> {
  let filePath = "";
  try {
    const profile = await requireRole("teacher");
    const supabase = await createClient();
    const metadata = validateMaterialAudioMetadata(formData);
    if ("error" in metadata) return { error: metadata.error };

    filePath = metadata.filePath;
    const uuidPattern = new RegExp(`^${UUID_PATTERN}$`, "i");
    const [pathMaterialId, objectName, ...extraPathParts] = filePath.split("/");
    const objectPattern = new RegExp(
      `^${UUID_PATTERN}\\.(mp3|mp4|m4a|ogg)$`,
      "i",
    );
    if (
      !uuidPattern.test(materialId) ||
      pathMaterialId?.toLowerCase() !== materialId.toLowerCase() ||
      !objectName ||
      extraPathParts.length > 0 ||
      !objectPattern.test(objectName)
    )
      return { error: "Lokasi berkas audio tidak valid." };

    const { data: lastAudio } = await supabase
      .from("material_audios")
      .select("order_index")
      .eq("material_id", materialId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("material_audios")
      .insert({
        material_id: materialId,
        title: metadata.title,
        file_path: filePath,
        duration_seconds: metadata.duration,
        transcript: metadata.transcript,
        order_index: (lastAudio?.order_index ?? -1) + 1,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) {
      await supabase.storage.from("material-audio").remove([filePath]);
      return {
        error:
          "Audio terunggah, tetapi pencatatan gagal. Berkas sementara telah dibersihkan.",
      };
    }

    revalidatePath(`/teacher/kelas/${classId}`);
    const { error: cleanupError } = await supabase.storage
      .from("material-audio")
      .remove([filePath]);
    return {
      error: cleanupError
        ? "Pencatatan audio gagal dan berkas sementara belum dapat dihapus. Silakan coba hapus ulang atau hubungi administrator."
        : "Audio terunggah, tetapi pencatatan gagal. Berkas sementara telah dibersihkan.",
    };
  } catch (err) {
    if (filePath) {
      try {
        const supabase = await createClient();
        await supabase.storage.from("material-audio").remove([filePath]);
      } catch {
        // Best-effort cleanup if metadata insertion failed unexpectedly.
      }
    }
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal mencatat audio pembelajaran.",
    };
  }
}

export async function updateMaterialAudioAction(
  audioId: string,
  materialId: string,
  classId: string,
  title: string,
  transcript: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();
    const safeTitle = title.trim();
    if (!safeTitle) return { error: "Judul audio wajib diisi." };
    if (Array.from(transcript).length > 5000)
      return { error: "Transkrip maksimal 5.000 karakter." };

    const { error } = await supabase
      .from("material_audios")
      .update({ title: safeTitle, transcript: transcript || null })
      .eq("id", audioId)
      .eq("material_id", materialId);

    if (error) return { error: "Perubahan audio gagal disimpan." };
    revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath(`/student/materi/${materialId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyimpan perubahan audio.",
    };
  }
}

export async function reorderMaterialAudioAction(
  audioId: string,
  materialId: string,
  classId: string,
  orderIndex: number,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    if (!Number.isSafeInteger(orderIndex) || orderIndex < 0)
      return { error: "Urutan audio tidak valid." };
    const supabase = await createClient();
    const { data: audios, error: readError } = await supabase
      .from("material_audios")
      .select("id, order_index")
      .eq("material_id", materialId)
      .order("order_index", { ascending: true });

    if (readError || !audios) return { error: "Daftar audio gagal dibaca." };
    const currentIndex = audios.findIndex((audio) => audio.id === audioId);
    const targetIndex = Math.min(orderIndex, audios.length - 1);
    if (currentIndex < 0)
      return { error: "Audio tidak ditemukan atau Anda tidak memiliki akses." };
    if (currentIndex === targetIndex) return { success: true };

    const current = audios[currentIndex];
    const target = audios[targetIndex];
    if (!current || !target) return { error: "Urutan audio tidak valid." };
    const { error: moveError } = await supabase
      .from("material_audios")
      .update({ order_index: target.order_index })
      .eq("id", current.id)
      .eq("material_id", materialId);
    if (moveError) return { error: "Urutan audio gagal disimpan." };

    const { error } = await supabase
      .from("material_audios")
      .update({ order_index: current.order_index })
      .eq("id", target.id)
      .eq("material_id", materialId);

    if (error) return { error: "Urutan audio gagal disimpan." };
    revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath(`/student/materi/${materialId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal mengubah urutan audio.",
    };
  }
}

export async function deleteMaterialAudioAction(
  audioId: string,
  materialId: string,
  classId: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();
    const { data: audio, error: readError } = await supabase
      .from("material_audios")
      .select("file_path")
      .eq("id", audioId)
      .eq("material_id", materialId)
      .maybeSingle();

    if (readError || !audio)
      return { error: "Audio tidak ditemukan atau Anda tidak memiliki akses." };

    const { error: storageError } = await supabase.storage
      .from("material-audio")
      .remove([audio.file_path]);
    if (storageError)
      return {
        error: "Berkas audio gagal dihapus. Data audio tetap dipertahankan.",
      };

    const { error } = await supabase
      .from("material_audios")
      .delete()
      .eq("id", audioId)
      .eq("material_id", materialId);

    if (error)
      return {
        error:
          "Berkas terhapus, tetapi data audio gagal dihapus. Silakan coba lagi.",
      };
    revalidatePath(`/teacher/kelas/${classId}`);
    revalidatePath(`/student/materi/${materialId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menghapus audio.",
    };
  }
}

export async function deleteMaterialAction(
  materialId: string,
  classId: string,
): Promise<ActionState> {
  try {
    await requireRole("teacher");
    const supabase = await createClient();

    const { error } = await supabase
      .from("materials")
      .delete()
      .eq("id", materialId);
    if (error) return { error: error.message };

    if (classId) revalidatePath(`/teacher/kelas/${classId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}
