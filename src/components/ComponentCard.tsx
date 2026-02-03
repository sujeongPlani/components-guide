import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildPreviewDocument } from '@/lib/preview'
import { useGuideStore } from '@/store'
import { CopyButton } from './CopyButton'
import type { ComponentItem, CommonFile, CommonAsset } from '@/store/types'

type GuideLayoutMode = 'card' | 'focus'

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

const FOCUS_LAYOUT_MEASURE_STYLE_ID = 'lg-focus-iframe-measure'
const PREVIEW_ROOT_ID = '__preview-root'

/**
 * 집중형 레이아웃 전용: iframe 높이 계산 (same-origin srcdoc 전제)
 * 스타일 주입 후 html/body는 height:auto이므로, root·body·documentElement 중
 * 가장 큰 값을 사용해 콘텐츠가 잘리지 않도록 함.
 */
function measureIframeContentHeight(iframe: HTMLIFrameElement | null): number | null {
  if (!iframe?.contentDocument) return null
  const doc = iframe.contentDocument
  const root = doc.getElementById(PREVIEW_ROOT_ID)
  const body = doc.body
  if (!root) return null
  void root.offsetHeight
  void body?.offsetHeight
  void doc.documentElement.offsetHeight
  const rootH = Math.max(root.scrollHeight, root.offsetHeight)
  const bodyH = body ? Math.max(body.scrollHeight, body.offsetHeight) : 0
  const docH = doc.documentElement.scrollHeight
  const raw = Math.max(rootH, bodyH, docH)
  return raw > 0 ? Math.ceil(raw) : null
}

interface ComponentCardProps {
  projectId?: string
  component: ComponentItem
  readOnly?: boolean
  /** 집중형일 때만 iframe 높이 자동 조절 (카드형은 고정 높이 + 내부 스크롤) */
  layoutMode?: GuideLayoutMode
  /** 공유 뷰 등 projectId 없을 때 프리뷰용 (기본 앱과 동일한 스타일 적용) */
  commonFiles?: CommonFile[]
  commonAssets?: CommonAsset[]
  /** 그리드에서 1회 병합한 공통 CSS/JS (카드별 병합 비용 제거) */
  mergedCommonCss?: string
  mergedCommonJs?: string
  /** 카드형: 뷰포트 진입 시에만 iframe 생성 (IntersectionObserver) */
  lazyIframe?: boolean
}

export function ComponentCard({
  projectId,
  component,
  readOnly,
  layoutMode = 'card',
  commonFiles: commonFilesProp,
  commonAssets: commonAssetsProp,
  mergedCommonCss: mergedCommonCssProp,
  mergedCommonJs: mergedCommonJsProp,
  lazyIframe = false,
}: ComponentCardProps) {
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeWindowRef = useRef<Window | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const rafIdRef = useRef<number>(0)
  const cardRootRef = useRef<HTMLDivElement>(null)
  const [iframeContentHeight, setIframeContentHeight] = useState<number | null>(null)
  const [inView, setInView] = useState(!lazyIframe)
  const project = useGuideStore((s) => (projectId ? s.getProject(projectId) : undefined))
  const removeComponent = useGuideStore((s) => s.removeComponent)
  const commonFiles = commonFilesProp ?? project?.commonFiles ?? []
  const commonAssets = commonAssetsProp ?? project?.commonAssets ?? []
  const isFocusLayout = layoutMode === 'focus'

  const effectiveMergedCss =
    mergedCommonCssProp !== undefined && mergedCommonCssProp !== null
      ? mergedCommonCssProp
      : commonFiles.length
        ? mergeCommonCss(commonFiles)
        : ''
  const effectiveMergedJs =
    mergedCommonJsProp !== undefined && mergedCommonJsProp !== null
      ? mergedCommonJsProp
      : commonFiles.length
        ? mergeCommonJs(commonFiles)
        : ''

  useEffect(() => {
    if (!lazyIframe || !cardRootRef.current) return
    const el = cardRootRef.current
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setInView(true)
      },
      { rootMargin: '100px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [lazyIframe])

  /** 집중형 전용: iframe 높이 측정 후 state 반영 */
  const applyIframeHeight = useCallback(() => {
    if (!isFocusLayout) return
    const height = measureIframeContentHeight(iframeRef.current)
    if (height != null) setIframeContentHeight(height)
  }, [isFocusLayout])

  /** 집중형 전용: iframe load 시 contentWindow 저장 (postMessage 매칭용), 부모 측 보조 측정 유지 */
  const handleIframeLoad = useCallback(() => {
    if (!isFocusLayout) return
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return
    iframeWindowRef.current = iframe.contentWindow
    const doc = iframe.contentDocument
    const body = doc.body
    if (!body) return

    let styleEl = doc.getElementById(FOCUS_LAYOUT_MEASURE_STYLE_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = doc.createElement('style')
      styleEl.id = FOCUS_LAYOUT_MEASURE_STYLE_ID
      styleEl.textContent =
        'html, body { height: auto !important; min-height: auto !important; overflow: hidden !important; } #__preview-root { display: block !important; height: auto !important; min-height: auto !important; overflow: visible !important; }'
      doc.head.appendChild(styleEl)
    }
    doc.documentElement.style.cssText = 'overflow: hidden !important; height: auto !important; min-height: auto !important;'
    body.style.cssText = 'overflow: hidden !important; height: auto !important; min-height: auto !important;'

    requestAnimationFrame(() => requestAnimationFrame(() => applyIframeHeight()))
    setTimeout(applyIframeHeight, 200)
    setTimeout(applyIframeHeight, 800)

    observerRef.current?.disconnect()
    rafIdRef.current = 0
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => applyIframeHeight())
    })
    observerRef.current = observer
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    if (doc.documentElement && doc.documentElement !== doc.body) {
      observer.observe(doc.documentElement, { childList: true, subtree: true })
    }
    const rootEl = doc.getElementById(PREVIEW_ROOT_ID)
    if (rootEl && typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect()
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = requestAnimationFrame(() => applyIframeHeight())
      })
      ro.observe(rootEl)
      resizeObserverRef.current = ro
    }
  }, [isFocusLayout, applyIframeHeight])

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!projectId) return
    if (!window.confirm(`"${component.name}" 컴포넌트를 삭제할까요? 삭제된 컴포넌트는 복구할 수 없습니다.`)) return
    removeComponent(projectId, component.id)
  }

  const commonCss = effectiveMergedCss ?? ''
  const componentCss = (component.css ?? '').trim()
  const commonJs = effectiveMergedJs ?? ''
  const componentJs = (component.js ?? '').trim()

  const doc = useMemo(
    () =>
      buildPreviewDocument(
        component.html,
        commonCss,
        componentCss,
        commonJs,
        componentJs,
        commonAssets
      ),
    [component.html, commonCss, componentCss, commonJs, componentJs, commonAssets]
  )

  useEffect(() => {
    if (!isFocusLayout) return
    setIframeContentHeight(null)
    iframeWindowRef.current = null
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      cancelAnimationFrame(rafIdRef.current)
      iframeWindowRef.current = null
    }
  }, [isFocusLayout, doc])

  useEffect(() => {
    if (!isFocusLayout) return
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'lg-iframe-height' || typeof e.data.height !== 'number') return
      if (e.source !== iframeWindowRef.current && e.source !== iframeRef.current?.contentWindow) return
      setIframeContentHeight(e.data.height)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isFocusLayout])

  const showIframe = inView

  return (
    <article className="lg-card-wrap" ref={cardRootRef}>
      <div className="lg-card-head">
        <h3 className="lg-card-head-title">{component.name}</h3>
        {component.description && (
          <p className="lg-card-head-desc">{component.description}</p>
        )}
      </div>
      <div className="lg-card-preview">
        {showIframe ? (
          <iframe
            ref={iframeRef}
            title={component.name}
            srcDoc={doc}
            sandbox={isFocusLayout ? 'allow-scripts allow-same-origin' : 'allow-scripts'}
            style={{
              pointerEvents: 'auto',
              ...(isFocusLayout
                ? {
                    overflow: 'hidden',
                    ...(iframeContentHeight != null
                      ? { height: `${iframeContentHeight}px`, minHeight: undefined }
                      : { minHeight: 80 }),
                  }
                : {}),
            }}
            onLoad={isFocusLayout ? handleIframeLoad : undefined}
          />
        ) : (
          <div className="lg-card-preview-placeholder" aria-hidden />
        )}
      </div>
      <div className="lg-card-foot">
        <CopyButton label="HTML" text={component.html} />
        <CopyButton label="CSS" text={component.css} />
        <CopyButton label="JS" text={component.js} />
        {!readOnly && (
          <>
            <button
              type="button"
              className="lg-card-edit-btn"
              onClick={() =>
                navigate(projectId ? `/projects/${projectId}/edit/${component.id}` : `/edit/${component.id}`)
              }
            >
              편집
            </button>
            <button
              type="button"
              className="lg-card-delete-btn"
              onClick={handleDelete}
              title="컴포넌트 삭제"
            >
              삭제
            </button>
          </>
        )}
      </div>
    </article>
  )
}
