import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { StudentSubjectNav } from '@/components/layout/sidebar-nav'
import { ChatbotWidget } from '@/components/student/chatbot-widget'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole('student')
  const supabase = await createClient()

  // 1. Ambil pendaftaran kelas siswa
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', profile.id)
    .maybeSingle()

  let subjects: StudentSubjectNav[] = []

  if (enrollment?.class_id) {
    const { data: modules } = await supabase
      .from('modules')
      .select('id, subjects:subject_id (id, name)')
      .eq('class_id', enrollment.class_id)

    const map = new Map<string, StudentSubjectNav>()
    ;(modules ?? []).forEach((m: any) => {
      const sub = m.subjects
      if (sub?.name) {
        const existing = map.get(sub.name)
        if (existing) {
          existing.moduleCount += 1
        } else {
          map.set(sub.name, {
            id: sub.id,
            name: sub.name,
            moduleCount: 1,
          })
        }
      }
    })
    subjects = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <AppShell profile={profile} studentSubjects={subjects}>
      {children}
      {enrollment?.class_id && <ChatbotWidget />}
    </AppShell>
  )
}
