import { useMemo } from 'react'
import { buildPreviewDocument } from '@/lib/preview'
import { useGuideStore } from '@/store'

interface LivePreviewProps {
  projectId: string
  html: string
  css: string
  js: string
}

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

export function LivePreview({ projectId, html, css, js }: LivePreviewProps) {
  const project = useGuideStore((s) =>
    projectId ? s.getProject(projectId) : undefined
  )
  const commonFiles = project?.commonFiles ?? []
  const commonAssets = project?.commonAssets ?? []
  const commonCss = useMemo(() => mergeCommonCss(commonFiles), [commonFiles])
  const componentCss = (css ?? '').trim()
  const commonJs = useMemo(() => mergeCommonJs(commonFiles), [commonFiles])
  const componentJs = (js ?? '').trim()
  const doc = useMemo(
    () =>
      buildPreviewDocument(
        html,
        commonCss,
        componentCss,
        commonJs,
        componentJs,
        commonAssets
      ),
    [html, commonCss, componentCss, commonJs, componentJs, commonAssets]
  )

  return (
    <div className="lg-preview-fill">
      <iframe title="Preview" srcDoc={doc} sandbox="allow-scripts" />
    </div>
  )
}
