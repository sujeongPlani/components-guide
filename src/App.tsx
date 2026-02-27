import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { AuthProvider } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
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

/** Supabase 설정 시: 앱 시작 시 무조건 DB에서 프로젝트 로드(단일 진실 소스). 저장은 store 액션에서 직접 호출 */
function SupabaseLoadOnMount() {
  const loadProjectsFromSupabase = useGuideStore((s) => s.loadProjectsFromSupabase)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log('[Supabase] .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 없어 DB 동기화를 쓰지 않습니다. (로컬만 사용)')
      return
    }
    console.log('[Supabase] DB 연동 사용 중 – 앱 시작 시 DB에서 불러옴, 프로젝트 변경 시 즉시 저장')
    loadProjectsFromSupabase().catch((e) => console.error('[Supabase] 프로젝트 목록 불러오기 실패', e))
  }, [loadProjectsFromSupabase])

  return null
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SystemTemplatesLoader />
        <SupabaseLoadOnMount />
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
