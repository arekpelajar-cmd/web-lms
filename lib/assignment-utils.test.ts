import { describe, it, expect } from 'vitest'
import {
  getEffectiveDueAt,
  getStudentAssignmentStatus,
  isAssignmentSubmittable,
  isLateStillSubmittable,
  formatLateDuration,
  formatTimeRemaining,
  parseDateTimeLocalWib,
} from './assignment-utils'

describe('Tahap 6: Assignment Utilities & Deadline Rules', () => {
  it('menafsirkan batas waktu lokal sebagai WIB', () => {
    expect(parseDateTimeLocalWib('2026-11-09T14:30')?.toISOString()).toBe(
      '2026-11-09T07:30:00.000Z',
    )
    expect(parseDateTimeLocalWib('invalid')).toBeNull()
  })

  const baseDue = new Date('2026-10-15T12:00:00Z')
  const extDue = new Date('2026-10-17T12:00:00Z')

  it('menghitung deadline efektif dengan dan tanpa perpanjangan', () => {
    // Tanpa ekstensi -> due_at
    const eff1 = getEffectiveDueAt(baseDue.toISOString(), null)
    expect(eff1.toISOString()).toBe(baseDue.toISOString())

    // Dengan ekstensi -> new_due_at
    const eff2 = getEffectiveDueAt(baseDue.toISOString(), {
      assignment_id: 'a1',
      student_id: 's1',
      new_due_at: extDue.toISOString(),
    })
    expect(eff2.toISOString()).toBe(extDue.toISOString())
  })

  describe('Mode Fleksibel (allow_late = true, close_at = null)', () => {
    const assignment = {
      open_at: '2026-10-10T00:00:00Z',
      due_at: '2026-10-15T12:00:00Z',
      close_at: null,
      allow_late: true,
    }

    it('tepat sebelum deadline berstatus not_submitted dan submittable', () => {
      const now = new Date('2026-10-14T00:00:00Z')
      const status = getStudentAssignmentStatus(assignment, null, null, now)
      expect(status).toBe('not_submitted')
      expect(isAssignmentSubmittable(assignment, null, now).submittable).toBe(true)
      expect(isLateStillSubmittable(assignment, null, now)).toBe(false)
    })

    it('sesudah deadline berstatus not_submitted dan late still submittable', () => {
      const now = new Date('2026-10-16T00:00:00Z')
      const status = getStudentAssignmentStatus(assignment, null, null, now)
      expect(status).toBe('not_submitted')
      expect(isAssignmentSubmittable(assignment, null, now).submittable).toBe(true)
      expect(isLateStillSubmittable(assignment, null, now)).toBe(true)
    })

    it('sesudah submit tepat waktu berstatus submitted', () => {
      const sub = {
        id: 'sub1',
        assignment_id: 'a1',
        student_id: 's1',
        submitted_at: '2026-10-14T00:00:00Z',
        is_late: false,
      }
      const status = getStudentAssignmentStatus(assignment, sub, null)
      expect(status).toBe('submitted')
    })

    it('sesudah submit terlambat berstatus late', () => {
      const sub = {
        id: 'sub1',
        assignment_id: 'a1',
        student_id: 's1',
        submitted_at: '2026-10-16T00:00:00Z',
        is_late: true,
      }
      const status = getStudentAssignmentStatus(assignment, sub, null)
      expect(status).toBe('late')
    })

    it('sesudah dinilai berstatus graded', () => {
      const sub = {
        id: 'sub1',
        assignment_id: 'a1',
        student_id: 's1',
        submitted_at: '2026-10-14T00:00:00Z',
        is_late: false,
        score: 90,
      }
      const status = getStudentAssignmentStatus(assignment, sub, null)
      expect(status).toBe('graded')
    })
  })

  describe('Mode Ketat (allow_late = false)', () => {
    const assignment = {
      open_at: '2026-10-10T00:00:00Z',
      due_at: '2026-10-15T12:00:00Z',
      close_at: null,
      allow_late: false,
    }

    it('ditutup setelah deadline jika belum mengumpulkan', () => {
      const now = new Date('2026-10-15T12:01:00Z')
      const status = getStudentAssignmentStatus(assignment, null, null, now)
      expect(status).toBe('closed')
      expect(isAssignmentSubmittable(assignment, null, now).submittable).toBe(false)
      expect(isLateStillSubmittable(assignment, null, now)).toBe(false)
    })

    it('tetap terbuka jika siswa memiliki perpanjangan yang masih aktif', () => {
      const now = new Date('2026-10-16T00:00:00Z')
      const ext = {
        assignment_id: 'a1',
        student_id: 's1',
        new_due_at: '2026-10-17T00:00:00Z',
      }
      const status = getStudentAssignmentStatus(assignment, null, ext, now)
      expect(status).toBe('not_submitted')
      expect(isAssignmentSubmittable(assignment, ext, now).submittable).toBe(true)
    })
  })

  describe('Mode Dengan Batas Akhir (allow_late = true, close_at diisi)', () => {
    const assignment = {
      open_at: '2026-10-10T00:00:00Z',
      due_at: '2026-10-15T12:00:00Z',
      close_at: '2026-10-17T12:00:00Z',
      allow_late: true,
    }

    it('antara due_at dan close_at: terlambat masih bisa dikumpulkan', () => {
      const now = new Date('2026-10-16T00:00:00Z')
      expect(isAssignmentSubmittable(assignment, null, now).submittable).toBe(true)
      expect(isLateStillSubmittable(assignment, null, now)).toBe(true)
    })

    it('setelah close_at: ditutup', () => {
      const now = new Date('2026-10-18T00:00:00Z')
      const status = getStudentAssignmentStatus(assignment, null, null, now)
      expect(status).toBe('closed')
      expect(isAssignmentSubmittable(assignment, null, now).submittable).toBe(false)
      expect(isLateStillSubmittable(assignment, null, now)).toBe(false)
    })
  })

  describe('Format Durasi Keterlambatan dan Sisa Waktu', () => {
    it('memformat durasi keterlambatan dengan tepat', () => {
      const due = '2026-10-10T10:00:00Z'
      const submitted = '2026-10-10T12:15:00Z'
      expect(formatLateDuration(submitted, due)).toBe('terlambat 2 jam 15 menit')

      const submittedDays = '2026-10-12T14:00:00Z'
      expect(formatLateDuration(submittedDays, due)).toBe('terlambat 2 hari 4 jam')
    })

    it('mendeteksi kondisi urgent (< 24 jam)', () => {
      const now = new Date('2026-10-10T00:00:00Z')
      const target20h = new Date('2026-10-10T20:00:00Z')
      const target48h = new Date('2026-10-12T00:00:00Z')

      expect(formatTimeRemaining(target20h, now).isUrgent).toBe(true)
      expect(formatTimeRemaining(target48h, now).isUrgent).toBe(false)
    })
  })
})
