import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { ProjectListPage } from '@/features/projects/ProjectListPage'
import { GuidePage } from '@/features/guide/GuidePage'
import { EditorPage } from '@/features/editor/EditorPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { FileStructurePage } from '@/features/files/FileStructurePage'
import { ShareViewPage } from '@/features/share/ShareViewPage'

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

export default function App() {
  return (
    <HashRouter>
      <StorageFailureListener />
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<MainLayout />}>
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
    </HashRouter>
  )
}
