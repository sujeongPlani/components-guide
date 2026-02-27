import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { AppLogo } from '@/components/AppLogo'

interface SidebarProps {
  projectId: string
  projectName: string
  selectedCategory: string | null
  onSelectCategory: (category: string | null) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function Sidebar({
  projectId,
  projectName,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const project = useGuideStore((s) => s.getProject(projectId))
  const components = project?.components ?? []
  const categories = project?.categories ?? []
  const isGuidePage = location.pathname === `/projects/${projectId}` || location.pathname === `/projects/${projectId}/`
  const addCategory = useGuideStore((s) => s.addCategory)
  const removeCategory = useGuideStore((s) => s.removeCategory)
  const reorderCategories = useGuideStore((s) => s.reorderCategories)
  const saveProjectAsTemplate = useGuideStore((s) => s.saveProjectAsTemplate)
  const [editingCategories, setEditingCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [draggedCat, setDraggedCat] = useState<string | null>(null)
  const [dragOverCat, setDragOverCat] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsOpen])

  const countByCategory = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = components.filter((c) => c.category === cat).length
    return acc
  }, {})

  const filteredCategories = categories.filter((cat) => {
    const matchSearch = !searchQuery.trim() || cat.toLowerCase().includes(searchQuery.toLowerCase())
    const hasComponents = countByCategory[cat] > 0
    return matchSearch || hasComponents
  })

  function handleAddCategory() {
    const name = newCategoryName.trim()
    if (name) {
      addCategory(projectId, name)
      setNewCategoryName('')
    }
  }

  function handleDragStart(e: React.DragEvent, cat: string) {
    setDraggedCat(cat)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cat)
  }

  function handleDragOver(e: React.DragEvent, cat: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedCat && draggedCat !== cat) setDragOverCat(cat)
  }

  function handleDragLeave() {
    setDragOverCat(null)
  }

  function handleDrop(e: React.DragEvent, targetCat: string) {
    e.preventDefault()
    setDragOverCat(null)
    setDraggedCat(null)
    if (!draggedCat || draggedCat === targetCat) return
    const list = [...categories]
    const fromIdx = list.indexOf(draggedCat)
    const toIdx = list.indexOf(targetCat)
    if (fromIdx === -1 || toIdx === -1) return
    list.splice(fromIdx, 1)
    list.splice(list.indexOf(targetCat), 0, draggedCat)
    reorderCategories(projectId, list)
  }

  function handleDragEnd() {
    setDraggedCat(null)
    setDragOverCat(null)
  }

  /** 카테고리/전체 클릭 시 가이드로 이동 후 선택 (공통 리소스·에디터 화면에서 복귀용) */
  function handleCategoryClick(category: string | null) {
    if (!isGuidePage) {
      navigate(`/projects/${projectId}`, { state: { selectedCategory: category } })
      onSelectCategory(category)
    } else {
      onSelectCategory(category)
    }
  }

  return (
    <aside className="lg-sidebar">
      <div className="lg-sidebar-header">
        <div ref={settingsRef} className="lg-sidebar-project-row">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="lg-sidebar-app-logo"
            title="프로젝트 목록으로"
            aria-label="프로젝트 목록으로"
          >
            <AppLogo size={30} />
          </button>
          <span className="lg-sidebar-project-name">{projectName}</span>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="프로젝트 설정 (공통 리소스, 파일 구조)"
            className={`lg-sidebar-settings-btn ${settingsOpen ? 'lg-sidebar-settings-btn--open' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {settingsOpen && (
            <div role="menu" className="lg-sidebar-dropdown">
              <button
                type="button"
                role="menuitem"
                className="lg-sidebar-dropdown-item"
                onClick={() => {
                  navigate(`/projects/${projectId}/resources`)
                  setSettingsOpen(false)
                }}
              >
                공통 리소스
              </button>
              <button
                type="button"
                role="menuitem"
                className="lg-sidebar-dropdown-item"
                onClick={() => {
                  navigate(`/projects/${projectId}/files`)
                  setSettingsOpen(false)
                }}
              >
                파일 구조
              </button>
            </div>
          )}
        </div>
        <input
          type="search"
          placeholder="카테고리 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="lg-sidebar-search"
        />
        {(project?.type === 'project' || project?.type === 'userTemplate' || project?.type === 'editableTemplate' || projectId === 'krds' || projectId === 'mxds') && (
          <div className="lg-sidebar-actions">
            <Button variant="primary" style={{ flex: 1 }} onClick={() => navigate(`/projects/${projectId}/edit/new`)}>
              + 새 컴포넌트
            </Button>
          </div>
        )}
        {project?.type === 'project' && (
          <div className="lg-sidebar-actions">
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => {
                const name = window.prompt('템플릿 이름을 입력하세요.', projectName + ' 템플릿')
                if (name?.trim()) {
                  saveProjectAsTemplate(projectId, name.trim())
                  alert('템플릿으로 저장되었습니다. 프로젝트 목록의 "내 템플릿"에서 확인할 수 있습니다.')
                }
              }}
            >
              템플릿으로 저장
            </Button>
          </div>
        )}
      </div>
      <nav className="lg-sidebar-nav">
        {!isGuidePage && <p className="lg-sidebar-hint">클릭 시 카테고리 목록으로 이동</p>}
        <button
          type="button"
          onClick={() => handleCategoryClick(null)}
          className={`lg-sidebar-cat-btn ${isGuidePage && selectedCategory === null ? 'lg-sidebar-cat-btn--active' : ''}`}
        >
          전체
        </button>
        {filteredCategories.map((cat) => {
          const count = countByCategory[cat] ?? 0
          const isSelected = isGuidePage && selectedCategory === cat
          const isDragging = draggedCat === cat
          const isDragOver = dragOverCat === cat
          return (
            <div
              key={cat}
              draggable={editingCategories}
              onDragStart={editingCategories ? (e) => handleDragStart(e, cat) : undefined}
              onDragOver={editingCategories ? (e) => handleDragOver(e, cat) : undefined}
              onDragLeave={editingCategories ? handleDragLeave : undefined}
              onDrop={editingCategories ? (e) => handleDrop(e, cat) : undefined}
              onDragEnd={editingCategories ? handleDragEnd : undefined}
              className={`lg-sidebar-cat-item ${isSelected ? 'lg-sidebar-cat-item--selected' : ''} ${isDragging ? 'lg-sidebar-cat-item--dragging' : ''} ${isDragOver ? 'lg-sidebar-cat-item--drag-over' : ''}`}
              style={{ cursor: editingCategories ? 'grab' : 'pointer' }}
            >
              {editingCategories && (
                <span style={{ padding: '4px 6px', color: 'var(--color-text-muted)', cursor: 'grab', fontSize: 14 }} title="드래그하여 순서 변경">
                  ⋮⋮
                </span>
              )}
              <button
                type="button"
                onClick={() => handleCategoryClick(cat)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'none', cursor: 'inherit', font: 'inherit', color: 'inherit' }}
              >
                <span>{cat}</span>
                <span className="lg-sidebar-cat-count">{count}</span>
              </button>
              {editingCategories && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`카테고리 "${cat}"을(를) 삭제할까요? 삭제된 카테고리는 복구할 수 없습니다.`)) return
                    removeCategory(projectId, cat)
                  }}
                  title="카테고리 삭제"
                  style={{ padding: '6px 10px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 14 }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </nav>
      {(project?.type === 'project' || project?.type === 'userTemplate' || project?.type === 'editableTemplate' || projectId === 'krds' || projectId === 'mxds') && (
      <div style={{ padding: 8, borderTop: '1px solid var(--color-border)' }}>
        <Button variant="ghost" style={{ width: '100%', fontSize: 14 }} onClick={() => setEditingCategories((v) => !v)}>
          {editingCategories ? '완료' : '카테고리 편집'}
        </Button>
        {editingCategories && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="text"
              placeholder="카테고리 이름"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="lg-input"
              style={{ flex: 1 }}
            />
            <Button variant="secondary" onClick={handleAddCategory}>
              추가
            </Button>
          </div>
        )}
      </div>
      )}
    </aside>
  )
}
