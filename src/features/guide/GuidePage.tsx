import { useParams } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { useSidebarContext } from '@/layouts/MainLayout'
import { ComponentGrid } from './ComponentGrid'

/** 카드형 레이아웃 아이콘 (그리드) */
function IconCard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

/** 집중형 레이아웃 아이콘 (문서/리스트) */
function IconFocus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  )
}

export function GuidePage() {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>()
  const ctx = useSidebarContext()
  const projectId = ctx?.projectId ?? paramProjectId ?? ''
  const project = useGuideStore((s) => (projectId ? s.getProject(projectId) : undefined))
  const components = project?.components ?? []
  const selectedCategory = ctx?.selectedCategory ?? null
  const searchQuery = ctx?.searchQuery ?? ''
  const layoutMode = ctx?.layoutMode ?? 'card'
  const setLayoutMode = ctx?.setLayoutMode

  return (
    <div className="lg-guide-fill">
      {setLayoutMode && (
        <div className="lg-guide-layout-toggle">
          <button
            type="button"
            onClick={() => setLayoutMode('card')}
            className={`lg-guide-layout-btn ${layoutMode === 'card' ? 'lg-guide-layout-btn--active' : ''}`}
            title="카드형 보기"
            aria-pressed={layoutMode === 'card'}
          >
            <IconCard />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('focus')}
            className={`lg-guide-layout-btn ${layoutMode === 'focus' ? 'lg-guide-layout-btn--active' : ''}`}
            title="집중형 보기"
            aria-pressed={layoutMode === 'focus'}
          >
            <IconFocus />
          </button>
        </div>
      )}
      <ComponentGrid
        projectId={projectId}
        components={components}
        categories={project?.categories ?? []}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        layoutMode={layoutMode}
        commonFiles={project?.commonFiles}
        commonAssets={project?.commonAssets}
      />
    </div>
  )
}
