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

export default function App() {
  return (
    <HashRouter>
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
