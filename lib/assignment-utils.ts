import type {
  AssignmentItem,
  AssignmentExtensionItem,
  SubmissionItem,
  StudentAssignmentStatus,
} from './types'

export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.zip', '.png', '.jpg', '.jpeg', '.docx']
export const ALLOWED_FILE_TYPES_LABEL = 'PDF, ZIP, PNG, JPG, DOCX'
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Mendapatkan batas waktu efektif siswa (memperhitungkan perpanjangan jika ada).
 */
export function getEffectiveDueAt(
  dueAt: string,
  extension?: AssignmentExtensionItem | null,
): Date {
  if (extension?.new_due_at) {
    return new Date(extension.new_due_at)
  }
  return new Date(dueAt)
}

/**
 * Menghitung status pengumpulan tugas bagi siswa.
 */
export function getStudentAssignmentStatus(
  assignment: Pick<AssignmentItem, 'open_at' | 'due_at' | 'close_at' | 'allow_late'>,
  submission?: SubmissionItem | null,
  extension?: AssignmentExtensionItem | null,
  now: Date = new Date(),
): StudentAssignmentStatus {
  if (submission) {
    if (submission.score !== null && submission.score !== undefined) {
      return 'graded'
    }
    if (submission.is_late) {
      return 'late'
    }
    return 'submitted'
  }

  const effectiveDueAt = getEffectiveDueAt(assignment.due_at, extension)

  // Mode ketat: lewat deadline -> ditutup
  if (!assignment.allow_late && now > effectiveDueAt) {
    return 'closed'
  }

  // Mode dengan batas akhir: lewat close_at -> ditutup
  if (assignment.allow_late && assignment.close_at && now > new Date(assignment.close_at)) {
    return 'closed'
  }

  return 'not_submitted'
}

/**
 * Memeriksa apakah tugas masih bisa dikumpulkan (baik pengumpulan pertama maupun pengumpulan ulang).
 */
export function isAssignmentSubmittable(
  assignment: Pick<AssignmentItem, 'open_at' | 'due_at' | 'close_at' | 'allow_late'>,
  extension?: AssignmentExtensionItem | null,
  now: Date = new Date(),
): { submittable: boolean; reason?: string } {
  const openAt = new Date(assignment.open_at)
  if (now < openAt) {
    return { submittable: false, reason: 'Pengumpulan belum dibuka' }
  }

  const effectiveDueAt = getEffectiveDueAt(assignment.due_at, extension)

  // Mode ketat
  if (!assignment.allow_late && now > effectiveDueAt) {
    return { submittable: false, reason: 'Batas waktu pengumpulan telah berakhir (mode ketat)' }
  }

  // Mode dengan batas akhir
  if (assignment.allow_late && assignment.close_at && now > new Date(assignment.close_at)) {
    return { submittable: false, reason: 'Batas akhir pengumpulan (close_at) telah berakhir' }
  }

  return { submittable: true }
}

/**
 * Mengecek apakah pengumpulan saat ini terhitung terlambat namun masih bisa dikumpulkan.
 * Label: "Terlambat - masih bisa dikumpulkan"
 */
export function isLateStillSubmittable(
  assignment: Pick<AssignmentItem, 'open_at' | 'due_at' | 'close_at' | 'allow_late'>,
  extension?: AssignmentExtensionItem | null,
  now: Date = new Date(),
): boolean {
  const openAt = new Date(assignment.open_at)
  if (now < openAt) return false

  const effectiveDueAt = getEffectiveDueAt(assignment.due_at, extension)
  const isPastDue = now > effectiveDueAt

  if (!isPastDue) return false

  // Jika lewat deadline, apakah masih diizinkan?
  if (!assignment.allow_late) return false

  if (assignment.close_at) {
    return now <= new Date(assignment.close_at)
  }

  // Fleksibel tanpa batas akhir
  return true
}

/**
 * Format durasi keterlambatan, misalnya: "terlambat 2 jam 15 menit".
 */
export function formatLateDuration(submittedAt: string | Date, dueAt: string | Date): string {
  const submitTime = new Date(submittedAt).getTime()
  const dueTime = new Date(dueAt).getTime()
  const diffMs = submitTime - dueTime

  if (diffMs <= 0) return 'Tepat waktu'

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} menit`)

  return `terlambat ${parts.join(' ')}`
}

/**
 * Format sisa waktu menuju deadline / close date.
 */
export function formatTimeRemaining(targetDate: string | Date, now: Date = new Date()): {
  text: string
  isUrgent: boolean // kurang dari 24 jam
  isPast: boolean
} {
  const target = new Date(targetDate).getTime()
  const current = now.getTime()
  const diffMs = target - current

  if (diffMs <= 0) {
    return { text: 'Waktu telah lewat', isUrgent: false, isPast: true }
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const isUrgent = diffMs < 24 * 60 * 60 * 1000 // < 24 jam

  if (days > 0) {
    return { text: `${days} hari ${hours} jam lagi`, isUrgent, isPast: false }
  }
  if (hours > 0) {
    return { text: `${hours} jam ${minutes} menit lagi`, isUrgent, isPast: false }
  }
  return { text: `${minutes} menit lagi`, isUrgent, isPast: false }
}

/**
 * Format tanggal Indonesia ramah pengguna.
 */
export function formatDateTimeId(dateStr: string | Date): string {
  const d = new Date(dateStr)
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format tanggal Indonesia dengan zona waktu WIB eksplisit.
 */
export function formatDateTimeWib(dateStr: string | Date): string {
  const d = new Date(dateStr)
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB'
}

export function parseDateTimeLocalWib(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
