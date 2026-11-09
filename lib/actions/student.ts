'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string | null
  isCompleted?: boolean
}

/**
 * Menandai materi telah selesai dibaca/dipelajari oleh siswa.
 */
export async function completeMaterialAction(materialId: string): Promise<ActionState> {
  try {
    const profile = await requireRole('student')
    const supabase = await createClient()

    // 1. Verifikasi apakah materi dapat diakses
    const { data: canAccess } = await supabase.rpc('can_access_material', {
      p_material_id: materialId,
    })

    if (!canAccess) {
      return { error: 'Anda belum dapat menyelesaikan materi ini karena materi sebelumnya belum tuntas.' }
    }

    // 2. Simpan penyelesaian materi
    const { error } = await supabase.from('material_completions').upsert({
      student_id: profile.id,
      material_id: materialId,
    })

    if (error) return { error: error.message }

    revalidatePath('/student')
    revalidatePath('/student/pra-kelas')
    revalidatePath(`/student/materi/${materialId}`)
    return { success: true, isCompleted: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

/**
 * Mengubah status selesai materi (toggle selesai / belum selesai).
 */
export async function toggleMaterialCompletionAction(materialId: string): Promise<ActionState> {
  try {
    const profile = await requireRole('student')
    const supabase = await createClient()

    // Cek apakah sudah pernah selesai
    const { data: existing } = await supabase
      .from('material_completions')
      .select('material_id')
      .eq('student_id', profile.id)
      .eq('material_id', materialId)
      .maybeSingle()

    if (existing) {
      // Hapus status selesai
      const { error } = await supabase
        .from('material_completions')
        .delete()
        .eq('student_id', profile.id)
        .eq('material_id', materialId)

      if (error) return { error: error.message }

      revalidatePath('/student')
      revalidatePath('/student/pra-kelas')
      revalidatePath(`/student/materi/${materialId}`)
      return { success: true, isCompleted: false }
    } else {
      // Tambah status selesai
      const { error } = await supabase.from('material_completions').insert({
        student_id: profile.id,
        material_id: materialId,
      })

      if (error) return { error: error.message }

      revalidatePath('/student')
      revalidatePath('/student/pra-kelas')
      revalidatePath(`/student/materi/${materialId}`)
      return { success: true, isCompleted: true }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}
