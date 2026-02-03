import { useState, createContext, useContext, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { Sidebar } from '@/features/guide/Sidebar'

export type GuideLayoutMode = 'card' | 'focus'

interface SidebarContextValue {
  projectId: string
  selectedCategory: string | null
  setSelectedCategory: (v: string | null) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  layoutMode: GuideLayoutMode
  setLayoutMode: (v: GuideLayoutMode) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  return ctx
}

/** 가이드 인덱스 경로인지 (카테고리 그리드가 보이는 페이지) */
function isGuideIndexPath(pathname: string, projectId: string): boolean {
  const base = `/projects/${projectId}`
  return pathname === base || pathname === base + '/'
}

export function MainLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const getProject = useGuideStore((s) => s.getProject)
  const project = projectId ? getProject(projectId) : undefined

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [layoutMode, setLayoutMode] = useState<GuideLayoutMode>('card')

  useEffect(() => {
    if (projectId && !project) navigate('/projects', { replace: true })
  }, [projectId, project, navigate])

  /** 다른 탭에서 카테고리 클릭으로 넘어올 때 location.state에서 선택 복원 */
  useEffect(() => {
    if (!projectId) return
    const state = location.state as { selectedCategory?: string } | undefined
    if (state?.selectedCategory != null && isGuideIndexPath(location.pathname, projectId)) {
      setSelectedCategory(state.selectedCategory)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [projectId, location.pathname, location.state, navigate])

  if (!projectId || !project) return null

  return (
    <SidebarContext.Provider
      value={{
        projectId,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        layoutMode,
        setLayoutMode,
      }}
    >
      <div className="lg-root">
        <Sidebar
          projectId={projectId}
          projectName={project.name}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="lg-main">
          <Outlet />
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
