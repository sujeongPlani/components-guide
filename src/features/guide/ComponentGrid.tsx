import { useMemo, useState, useEffect, useRef } from 'react'
import { ComponentCard } from '@/components/ComponentCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { ComponentItem, CommonFile, CommonAsset } from '@/store/types'
import type { GuideLayoutMode } from '@/layouts/MainLayout'

/** 컴포넌트 수가 이 값을 넘을 때만 짧은 로딩 표시 (0이면 로딩 미표시) */
const LOADING_OVERLAY_THRESHOLD = 12
const LOADING_OVERLAY_MS = 120

/** 공통 CSS 병합. component.css는 후순위(맨 뒤)로 넣어 적용되도록 함 */
function mergeCommonCss(files: { type: string; content: string; name?: string }[]): string {
  const list = files
    .filter((f) => f.type === 'css')
    .sort((a, b) => ((a.name === 'component.css' ? 1 : 0) - (b.name === 'component.css' ? 1 : 0)))
  return list.map((f) => f.content.trim()).filter(Boolean).join('\n\n')
}

/** 공통 JS 병합. component.js는 후순위(맨 뒤)로 넣어 적용되도록 함 */
function mergeCommonJs(files: { type: string; content: string; name?: string }[]): string {
  const list = files
    .filter((f) => f.type === 'js')
    .sort((a, b) => ((a.name === 'component.js' ? 1 : 0) - (b.name === 'component.js' ? 1 : 0)))
  return list.map((f) => f.content.trim()).filter(Boolean).join('\n\n')
}

interface ComponentGridProps {
  projectId?: string
  components: ComponentItem[]
  /** 카테고리 순서 (이 순서대로 섹션/컴포넌트 정렬). 없으면 가나다순 */
  categories?: string[]
  selectedCategory: string | null
  searchQuery: string
  readOnly?: boolean
  layoutMode?: GuideLayoutMode
  /** 공유 뷰 등 projectId 없을 때 프리뷰용 (기본 앱과 동일한 스타일 적용) */
  commonFiles?: CommonFile[]
  commonAssets?: CommonAsset[]
}

export function ComponentGrid({
  projectId,
  components,
  categories: categoryOrder = [],
  selectedCategory,
  searchQuery,
  readOnly,
  layoutMode = 'card',
  commonFiles,
  commonAssets,
}: ComponentGridProps) {
  const filtered = useMemo(() => {
    let list = components
    if (selectedCategory) {
      list = list.filter((c) => c.category === selectedCategory)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      )
    }
    return list
  }, [components, selectedCategory, searchQuery])

  const byCategory = useMemo(() => {
    const map = new Map<string, ComponentItem[]>()
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category)!.push(c)
    }
    const entries = Array.from(map.entries())
    if (categoryOrder.length) {
      const orderIdx = new Map(categoryOrder.map((cat, i) => [cat, i]))
      entries.sort(([a], [b]) => {
        const ia = orderIdx.get(a) ?? 1e9
        const ib = orderIdx.get(b) ?? 1e9
        return ia - ib || a.localeCompare(b)
      })
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b))
    }
    return entries
  }, [filtered, categoryOrder])

  const mergedCommonCss = useMemo(() => mergeCommonCss(commonFiles ?? []), [commonFiles])
  const mergedCommonJs = useMemo(() => mergeCommonJs(commonFiles ?? []), [commonFiles])

  const [gridLoading, setGridLoading] = useState(false)
  const isFirstMount = useRef(true)

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (filtered.length < LOADING_OVERLAY_THRESHOLD) return
    setGridLoading(true)
    const t = setTimeout(() => setGridLoading(false), LOADING_OVERLAY_MS)
    return () => clearTimeout(t)
  }, [selectedCategory, searchQuery, components, filtered.length])

  if (filtered.length === 0) {
    return (
      <div className="lg-grid-empty">
        {components.length === 0
          ? '등록된 컴포넌트가 없습니다. "새 컴포넌트"로 추가해 보세요.'
          : '조건에 맞는 컴포넌트가 없습니다.'}
      </div>
    )
  }

  if (layoutMode === 'card') {
    return (
      <div className="lg-grid-scroll" style={{ position: 'relative' }}>
        {gridLoading && (
          <div
            className="lg-grid-loading-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-bg)',
              zIndex: 1,
            }}
          >
            <LoadingSpinner size={40} />
          </div>
        )}
        <div className="lg-grid-cards">
          {filtered.map((comp) => (
            <ComponentCard
              key={comp.id}
              projectId={projectId}
              component={comp}
              readOnly={readOnly}
              layoutMode={layoutMode}
              commonFiles={commonFiles}
              commonAssets={commonAssets}
              mergedCommonCss={mergedCommonCss}
              mergedCommonJs={mergedCommonJs}
              lazyIframe
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="lg-grid-scroll lg-grid-scroll--layout-focus" style={{ position: 'relative' }}>
      {gridLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            zIndex: 1,
          }}
        >
          <LoadingSpinner size={40} />
        </div>
      )}
      {byCategory.map(([category, items]) => (
        <section key={category} className="lg-grid-section">
          <h2 className="lg-grid-section-title">{category}</h2>
          <div className="lg-grid-cards">
            {items.map((comp) => (
              <ComponentCard
                key={comp.id}
                projectId={projectId}
                component={comp}
                readOnly={readOnly}
                layoutMode="focus"
                commonFiles={commonFiles}
                commonAssets={commonAssets}
                mergedCommonCss={mergedCommonCss}
                mergedCommonJs={mergedCommonJs}
                lazyIframe
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
