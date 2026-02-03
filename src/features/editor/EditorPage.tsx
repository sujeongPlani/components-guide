import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { CodeEditorTabs } from './CodeEditorTabs'
import { LivePreview } from './LivePreview'
import { DescriptionField } from './DescriptionField'
const DEFAULT_HTML = '<!-- 마크업 작성 -->\n'
const DEFAULT_CSS = '/* 스타일 */\n'
const DEFAULT_JS = '// 스크립트 (필요 시)\n'

export function EditorPage() {
  const { projectId, id } = useParams<{ projectId: string; id: string }>()
  const navigate = useNavigate()
  const project = useGuideStore((s) => (projectId ? s.getProject(projectId) : undefined))
  const categories = project?.categories ?? []
  const addComponent = useGuideStore((s) => s.addComponent)
  const updateComponent = useGuideStore((s) => s.updateComponent)
  const getComponent = useGuideStore((s) => s.getComponent)
  const isNew = id === 'new' || id === undefined
  const existing =
    projectId && id && !isNew ? getComponent(projectId, id) : undefined

  // 편집 대상 컴포넌트 데이터로 초기화 → Preview가 처음부터 해당 코드를 반영
  const [name, setName] = useState(() => existing?.name ?? '')
  const [category, setCategory] = useState(() => existing?.category ?? (categories[0] ?? ''))
  const [description, setDescription] = useState(() => existing?.description ?? '')
  const [html, setHtml] = useState(() => existing?.html ?? DEFAULT_HTML)
  const [css, setCss] = useState(() => existing?.css ?? DEFAULT_CSS)
  const [js, setJs] = useState(() => existing?.js ?? DEFAULT_JS)

  /** 저장 시점에 CodeMirror가 아직 state에 반영하지 않은 최신 값을 쓰기 위한 ref (onChange에서 갱신) */
  const latestHtmlRef = useRef(html)
  const latestCssRef = useRef(css)
  const latestJsRef = useRef(js)

  useEffect(() => {
    if (!projectId) {
      navigate('/projects', { replace: true })
      return
    }
    if (existing) {
      setName(existing.name)
      setCategory(existing.category)
      setDescription(existing.description)
      const nextHtml = existing.html || DEFAULT_HTML
      const nextCss = existing.css || DEFAULT_CSS
      const nextJs = existing.js || DEFAULT_JS
      setHtml(nextHtml)
      setCss(nextCss)
      setJs(nextJs)
      latestHtmlRef.current = nextHtml
      latestCssRef.current = nextCss
      latestJsRef.current = nextJs
    } else if (isNew && categories.length) {
      setCategory((prev) => (prev && categories.includes(prev) ? prev : categories[0]))
    } else if (!isNew && !existing) {
      navigate(`/projects/${projectId}`, { replace: true })
    }
  }, [existing, isNew, navigate, categories, projectId])

  function handleSave() {
    if (!projectId) {
      alert('프로젝트를 찾을 수 없습니다. 프로젝트 목록에서 다시 선택해 주세요.')
      return
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      alert('컴포넌트 이름을 입력해 주세요.')
      return
    }
    const saveHtml = latestHtmlRef.current ?? html
    const saveCss = latestCssRef.current ?? css
    const saveJs = latestJsRef.current ?? js
    if (isNew) {
      addComponent(projectId, {
        name: trimmedName,
        category,
        description: description.trim(),
        html: saveHtml,
        css: saveCss,
        js: saveJs,
      })
      navigate(`/projects/${projectId}`)
    } else if (id) {
      updateComponent(projectId, id, {
        name: trimmedName,
        category,
        description: description.trim(),
        html: saveHtml,
        css: saveCss,
        js: saveJs,
      })
      navigate(`/projects/${projectId}`)
    }
  }

  function handleCancel() {
    navigate(projectId ? `/projects/${projectId}` : '/projects')
  }

  return (
    <div className="lg-editor-wrap">
      <header className="lg-editor-head">
        <input
          type="text"
          placeholder="컴포넌트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="lg-editor-head-input"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="lg-editor-head-select"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="lg-editor-spacer" />
        <Button variant="secondary" onClick={handleCancel}>
          취소
        </Button>
        <Button variant="primary" onClick={handleSave}>
          저장
        </Button>
      </header>

      <div className="lg-editor-split">
        <div className="lg-editor-left">
          <CodeEditorTabs
            html={html}
            css={css}
            js={js}
            onHtmlChange={(v) => {
              latestHtmlRef.current = v
              setHtml(v)
            }}
            onCssChange={(v) => {
              latestCssRef.current = v
              setCss(v)
            }}
            onJsChange={(v) => {
              latestJsRef.current = v
              setJs(v)
            }}
          />
          <div className="lg-editor-desc-area">
            <DescriptionField value={description} onChange={setDescription} />
          </div>
        </div>
        <div className="lg-editor-right">
          <div className="lg-editor-preview-label">Preview</div>
          <div className="lg-editor-preview-box">
            <LivePreview projectId={projectId ?? ''} html={html} css={css} js={js} />
          </div>
        </div>
      </div>
    </div>
  )
}
