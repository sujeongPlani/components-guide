import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { AuthProvider } from '@/contexts/AuthContext'
import {
  isSupabaseConfigured,
  saveProjectToSupabase,
  deleteProjectFromSupabase,
} from '@/lib/supabase'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { MainLayout } from '@/layouts/MainLayout'
import { ProjectListPage } from '@/features/projects/ProjectListPage'
import { GuidePage } from '@/features/guide/GuidePage'
import { EditorPage } from '@/features/editor/EditorPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { FileStructurePage } from '@/features/files/FileStructurePage'
import { ShareViewPage } from '@/features/share/ShareViewPage'
import { LoginPage } from '@/features/auth/LoginPage'

function EditorPageWithKey() {
  const { projectId, id } = useParams()
  return <EditorPage key={`${projectId}-${id}`} />
}

function StorageFailureListener() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: string }>).detail
      if (detail?.reason === 'quota') {
        alert(
          '저장 공간이 부족합니다. 브라우저 저장소(약 5MB) 한도를 넘었을 수 있습니다.\n\n' +
            '이미지를 줄이거나, "데이터 내보내기"로 JSON 백업 후 불필요한 프로젝트/에셋을 정리해 주세요.'
        )
      } else {
        alert('데이터 저장에 실패했습니다. 브라우저 설정에서 이 사이트 저장 공간을 확인해 주세요.')
      }
    }
    window.addEventListener('live-guide-storage-failed', handler)
    return () => window.removeEventListener('live-guide-storage-failed', handler)
  }, [])
  return null
}

function SystemTemplatesLoader() {
  const loadSystemTemplatesFromData = useGuideStore((s) => s.loadSystemTemplatesFromData)
  useEffect(() => {
    loadSystemTemplatesFromData()
  }, [loadSystemTemplatesFromData])
  return null
}

/** Supabase 설정 시: 앱 로드 시 DB에서 프로젝트 불러오기, 변경 시 디바운스 후 DB에 저장 */
function SupabaseSync() {
  const loadProjectsFromSupabase = useGuideStore((s) => s.loadProjectsFromSupabase)
  const skipNextSync = useRef(true)
  const previousProjectIds = useRef<string[]>([])
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    skipNextSync.current = true
    loadProjectsFromSupabase().then(() => {
      const projects = useGuideStore.getState().projects
      previousProjectIds.current = projects.filter((p) => p.type === 'project').map((p) => p.id)
    })
  }, [loadProjectsFromSupabase])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const unsub = useGuideStore.subscribe((state, prevState) => {
      if (state.projects === prevState.projects) return
      if (skipNextSync.current) {
        skipNextSync.current = false
        return
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(async () => {
        debounceTimer.current = null
        const current = useGuideStore.getState().projects
        const projectItems = current.filter((p) => p.type === 'project')
        const currentIds = projectItems.map((p) => p.id)
        const previous = previousProjectIds.current

        for (const id of previous) {
          if (!currentIds.includes(id)) await deleteProjectFromSupabase(id).catch(() => {})
        }
        for (const p of projectItems) {
          await saveProjectToSupabase(p).catch(() => {})
        }
        previousProjectIds.current = projectItems.map((p) => p.id)
      }, 2000)
    })

    return () => {
      unsub()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return null
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SystemTemplatesLoader />
        <SupabaseSync />
        <StorageFailureListener />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/projects" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<GuidePage />} />
            <Route path="edit/:id" element={<EditorPageWithKey />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="files" element={<FileStructurePage />} />
          </Route>
          <Route
            path="/share/:encoded"
            element={
              <div className="lg-share-route-root">
                <ShareViewPage />
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
