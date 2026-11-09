'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookOpen, BookOpenCheck, FileText, LayoutDashboard, School, UserCheck, Users, HelpCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/roles'

export type StudentSubjectNav = {
  id: string
  name: string
  moduleCount: number
}

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: '/student', label: 'Pelajaran saya', icon: BookOpen },
    { href: '/student/pra-kelas', label: 'Pra-kelas & Poin', icon: BookOpenCheck },
    { href: '/student/tugas', label: 'Tugas saya', icon: FileText },
    { href: '/student/kuis', label: 'Kuis & Ujian', icon: HelpCircle },
  ],
  teacher: [{ href: '/teacher', label: 'Kelas saya', icon: School }],
  admin: [
    { href: '/admin', label: 'Ringkasan', icon: LayoutDashboard },
    { href: '/admin/classes', label: 'Kelola Kelas', icon: School },
    { href: '/admin/subjects', label: 'Mata Pelajaran', icon: BookOpen },
    { href: '/admin/teachers', label: 'Akun Guru', icon: Users },
    { href: '/admin/assignments', label: 'Penugasan Guru', icon: UserCheck },
  ],
}

interface SidebarNavProps {
  role: Role
  studentSubjects?: StudentSubjectNav[]
}

function SidebarNavInner({ role, studentSubjects }: SidebarNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSubject = searchParams.get('subject')

  const totalStudentModules = (studentSubjects ?? []).reduce((acc, s) => acc + s.moduleCount, 0)

  return (
    <nav className="flex flex-col gap-1.5 p-3" aria-label="Menu utama">
      {NAV[role].map(({ href, label, icon: Icon }) => {
        const isMainActive =
          href === '/admin'
            ? pathname === '/admin'
            : href === '/student'
            ? pathname === '/student' || pathname.startsWith('/student/materi') || pathname.startsWith('/student/kuis')
            : pathname === href || pathname.startsWith(`${href}/`)
        // Jangan aktifkan item nav di halaman pengaturan (mis. /teacher/settings)
        const isActive = isMainActive && !pathname.endsWith('/settings')

        return (
          <div key={href} className="space-y-1">
            <Link
              href={href}
              aria-current={isActive && !currentSubject ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive && !currentSubject
                  ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                  isActive && !currentSubject ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span className="truncate">{label}</span>
              {isActive && !currentSubject && (
                <span className="absolute right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>

            {/* Sub-menu Mata Pelajaran HANYA di Bawah Pelajaran Saya */}
            {role === 'student' && href === '/student' && studentSubjects && studentSubjects.length > 0 && (
              <div className="ml-3 border-l-2 border-border/80 pl-2.5 my-1.5 space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Mata Pelajaran
                </div>

                <Link
                  href="/student"
                  className={cn(
                    'group flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                    pathname === '/student' && !currentSubject
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <span className="truncate">Semua Pelajaran</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors',
                      pathname === '/student' && !currentSubject
                        ? 'bg-primary/25 text-primary font-semibold'
                        : 'text-muted-foreground/80 bg-muted/80',
                    )}
                  >
                    {totalStudentModules}
                  </span>
                </Link>

                {studentSubjects.map((sub) => {
                  const isSubActive = pathname === '/student' && currentSubject === sub.name
                  return (
                    <Link
                      key={sub.id || sub.name}
                      href={`/student?subject=${encodeURIComponent(sub.name)}`}
                      title={sub.name}
                      className={cn(
                        'group flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                        isSubActive
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )}
                    >
                      <span className="truncate mr-1.5">{sub.name}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors',
                          isSubActive
                            ? 'bg-primary/25 text-primary font-semibold'
                            : 'text-muted-foreground/80 bg-muted/80',
                        )}
                      >
                        {sub.moduleCount}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function SidebarNav(props: SidebarNavProps) {
  return (
    <Suspense
      fallback={
        <nav className="flex flex-col gap-1 p-3 animate-pulse">
          <div className="h-9 rounded-md bg-muted/60" />
        </nav>
      }
    >
      <SidebarNavInner {...props} />
    </Suspense>
  )
}
