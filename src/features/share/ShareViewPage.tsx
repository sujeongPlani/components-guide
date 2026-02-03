import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { decodeShareUrl, type SharePayload } from '@/lib/share'
import { downloadGuide } from '@/lib/export'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ComponentGrid } from '@/features/guide/ComponentGrid'
import type { ComponentItem } from '@/store/types'
import type { GuideLayoutMode } from '@/layouts/MainLayout'

/** 카드형 레이아웃 아이콘 */
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

/** 집중형 레이아웃 아이콘 */
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

export function ShareViewPage() {
  const { encoded } = useParams<{ encoded: string }>()
  const navigate = useNavigate()
  const [components, setComponents] = useState<ComponentItem[]>([])
  const [commonFiles, setCommonFiles] = useState<SharePayload['commonFiles']>(undefined)
  const [commonAssets, setCommonAssets] = useState<SharePayload['commonAssets']>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [layoutMode, setLayoutMode] = useState<GuideLayoutMode>('card')

  useEffect(() => {
    if (!encoded) {
      setError('공유 데이터가 없습니다.')
      return
    }
    const payload = decodeShareUrl(encoded)
    if (!payload) {
      setError('잘못된 공유 링크이거나 만료되었습니다.')
      return
    }
    setComponents(payload.components)
    setCommonFiles(payload.commonFiles ?? undefined)
    setCommonAssets(payload.commonAssets ?? undefined)
  }, [encoded])

  const categories = Array.from(new Set(components.map((c) => c.category))).sort()
  const countByCategory = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = components.filter((c) => c.category === cat).length
    return acc
  }, {})

  if (error) {
    return (
      <div className="lg-root" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 16 }}>
        <p style={{ margin: 0 }}>{error}</p>
        <a href="#/projects" style={{ color: 'var(--color-primary)' }}>가이드로 돌아가기</a>
      </div>
    )
  }

  if (components.length === 0) {
    return (
      <div className="lg-root lg-share-loading" style={{ flexDirection: 'column', gap: 16 }}>
        <LoadingSpinner size={40} />
        <span style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="lg-root">
      <aside className="lg-sidebar">
        <div className="lg-sidebar-header">
          <div className="lg-sidebar-project-row">
            <span className="lg-sidebar-project-name" style={{ cursor: 'default', color: 'var(--color-text)' }}>
              컴포넌트 가이드 (공유)
            </span>
          </div>
          <input
            type="search"
            placeholder="카테고리 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lg-sidebar-search"
          />
          <div className="lg-sidebar-actions">
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => downloadGuide(components)}>
              다운로드
            </Button>
          </div>
          <div className="lg-sidebar-actions">
            <Button variant="ghost" style={{ flex: 1 }} onClick={() => navigate('/projects')}>
              가이드로 이동
            </Button>
          </div>
        </div>
        <nav className="lg-sidebar-nav">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`lg-sidebar-cat-btn ${selectedCategory === null ? 'lg-sidebar-cat-btn--active' : ''}`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`lg-sidebar-cat-btn ${selectedCategory === cat ? 'lg-sidebar-cat-btn--active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
            >
              <span>{cat}</span>
              <span className="lg-sidebar-cat-count">{countByCategory[cat] ?? 0}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="lg-main">
        <div className="lg-guide-fill">
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
          <ComponentGrid
            components={components}
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            readOnly
            layoutMode={layoutMode}
            commonFiles={commonFiles}
            commonAssets={commonAssets}
          />
        </div>
      </main>
    </div>
  )
}
