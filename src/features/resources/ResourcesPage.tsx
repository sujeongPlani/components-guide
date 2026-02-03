import { useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGuideStore } from '@/store'
import type { CommonFile, CommonAsset, FileNode } from '@/store/types'
import { PROTECTED_FILE_NAMES } from '@/store/types'
import { Button } from '@/components/ui/Button'
import { getNodePath } from '@/lib/fileTree'

/** 파일 트리에서 폴더 노드만 재귀 수집 */
function getAllFolderNodes(nodes: FileNode[]): FileNode[] {
  const list: FileNode[] = []
  for (const n of nodes) {
    if (n.type === 'folder') {
      list.push(n)
      if (n.children?.length) list.push(...getAllFolderNodes(n.children))
    }
  }
  return list
}

export function ResourcesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useGuideStore((s) => (projectId ? s.getProject(projectId) : undefined))
  const addCommonFile = useGuideStore((s) => s.addCommonFile)
  const removeCommonFile = useGuideStore((s) => s.removeCommonFile)
  const updateCommonFile = useGuideStore((s) => s.updateCommonFile)
  const addCommonAsset = useGuideStore((s) => s.addCommonAsset)
  const removeCommonAsset = useGuideStore((s) => s.removeCommonAsset)

  const [activeTab, setActiveTab] = useState<'files' | 'assets'>('files')
  const [newFileName, setNewFileName] = useState('')
  const [newFileType, setNewFileType] = useState<'css' | 'js'>('css')
  const [newFileContent, setNewFileContent] = useState('')
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  /** 파일별 미저장 편집 내용 (fileId -> content). 목록 하단 '저장'으로 한 번에 반영 */
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({})
  /** 에셋 추가 시 저장할 폴더 ID (빈 값이면 기본 img 경로) */
  const [selectedAssetFolderId, setSelectedAssetFolderId] = useState('')
  const assetInputRef = useRef<HTMLInputElement>(null)

  if (!projectId || !project) {
    navigate('/projects', { replace: true })
    return null
  }

  const commonFiles = project.commonFiles ?? []
  const commonAssets = project.commonAssets ?? []
  const fileTree = project.fileTree ?? []
  const components = project.components ?? []
  const cssFiles = commonFiles.filter((f) => f.type === 'css')
  const jsFiles = commonFiles.filter((f) => f.type === 'js')

  /** 공통 CSS/JS 중 수정·삭제 불가 (컴포넌트 편집에서 관리) */
  const isProtectedCommonFile = (name: string) =>
    (PROTECTED_FILE_NAMES as readonly string[]).includes(name)

  /** component.css 보기: 공통 파일 내용 + 각 컴포넌트에 저장된 CSS (등록 시 입력한 내용) */
  const getComponentCssDisplayContent = (commonFileContent: string) => {
    const parts: string[] = []
    const common = (commonFileContent ?? '').trim()
    if (common) parts.push(common)
    if (components.length > 0) {
      parts.push('\n/* ========== 컴포넌트별 저장 CSS (미리보기 적용) ========== */')
      components.forEach((c) => {
        const css = (c.css ?? '').trim()
        if (css) parts.push(`\n/* ---- ${c.name} ---- */\n${css}`)
      })
    }
    return parts.length ? parts.join('\n') : '(공통 파일 없음, 컴포넌트에 저장된 CSS 없음)'
  }

  /** component.js 보기: 공통 파일 내용 + 각 컴포넌트에 저장된 JS */
  const getComponentJsDisplayContent = (commonFileContent: string) => {
    const parts: string[] = []
    const common = (commonFileContent ?? '').trim()
    if (common) parts.push(common)
    if (components.length > 0) {
      parts.push('\n/* ========== 컴포넌트별 저장 JS (미리보기 적용) ========== */')
      components.forEach((c) => {
        const js = (c.js ?? '').trim()
        if (js) parts.push(`\n/* ---- ${c.name} ---- */\n${js}`)
      })
    }
    return parts.length ? parts.join('\n') : '(공통 파일 없음, 컴포넌트에 저장된 JS 없음)'
  }

  /** 에셋 저장 경로 선택용 폴더 목록 (경로 문자열 포함) */
  const assetFolderOptions = useMemo(() => {
    const folders = getAllFolderNodes(fileTree)
    const defaultOption = { value: '', label: '기본 (img)' }
    const folderOptions = folders.map((f) => ({
      value: f.id,
      label: getNodePath(fileTree, f.id) ?? f.name,
    }))
    return [defaultOption, ...folderOptions]
  }, [fileTree])

  /** 에셋별 저장 경로 라벨 (exportFolderId → 경로 문자열) */
  const getAssetPathLabel = useMemo(() => {
    const map = new Map<string, string>()
    assetFolderOptions.forEach((opt) => map.set(opt.value, opt.label))
    return (asset: CommonAsset) => map.get(asset.exportFolderId ?? '') ?? '기본 (img)'
  }, [assetFolderOptions])

  /** 경로별로 그룹화 (타이틀 순서는 assetFolderOptions 순서, 그 다음 실제 있는 경로) */
  const assetsByPath = useMemo(() => {
    const pathToAssets = new Map<string, CommonAsset[]>()
    for (const a of commonAssets) {
      const pathLabel = getAssetPathLabel(a)
      if (!pathToAssets.has(pathLabel)) pathToAssets.set(pathLabel, [])
      pathToAssets.get(pathLabel)!.push(a)
    }
    const order = assetFolderOptions.map((opt) => opt.label)
    const ordered: [string, CommonAsset[]][] = []
    for (const label of order) {
      const list = pathToAssets.get(label)
      if (list?.length) {
        ordered.push([label, list])
        pathToAssets.delete(label)
      }
    }
    pathToAssets.forEach((list, label) => ordered.push([label, list]))
    return ordered
  }, [commonAssets, getAssetPathLabel, assetFolderOptions])

  function handleAddFile() {
    const name = newFileName.trim()
    if (!name || !projectId) return
    if (isProtectedCommonFile(name)) {
      alert('component.css, component.js는 컴포넌트 편집 화면에서만 관리됩니다. 다른 파일 이름을 사용해 주세요.')
      return
    }
    addCommonFile(projectId, { name, type: newFileType, content: newFileContent.trim() })
    setNewFileName('')
    setNewFileContent('')
  }

  function handleRemoveFile(file: CommonFile) {
    if (!projectId) return
    if (isProtectedCommonFile(file.name)) {
      alert('component.css, component.js는 삭제할 수 없습니다.')
      return
    }
    if (!window.confirm(`"${file.name}"을(를) 삭제할까요? 삭제된 항목은 복구할 수 없습니다.`)) return
    if (editingFileId === file.id) setEditingFileId(null)
    setPendingEdits((prev) => {
      const next = { ...prev }
      delete next[file.id]
      return next
    })
    removeCommonFile(projectId, file.id)
  }

  function startEditFile(file: CommonFile) {
    setEditingFileId(file.id)
  }

  function closeEditPanel() {
    setEditingFileId(null)
  }

  function getFileEditContent(f: CommonFile): string {
    return pendingEdits[f.id] ?? f.content ?? ''
  }

  function setFileEditContent(fileId: string, content: string) {
    setPendingEdits((prev) => ({ ...prev, [fileId]: content }))
  }

  /** CSS 목록 중 수정된 항목만 저장 */
  function savePendingCss() {
    if (!projectId) return
    cssFiles.forEach((f) => {
      if (f.id in pendingEdits) {
        updateCommonFile(projectId, f.id, { content: pendingEdits[f.id] })
      }
    })
    setPendingEdits((prev) => {
      const next = { ...prev }
      cssFiles.forEach((f) => delete next[f.id])
      return next
    })
    setTimeout(() => alert('저장되었습니다.'), 0)
  }

  /** JS 목록 중 수정된 항목만 저장 */
  function savePendingJs() {
    if (!projectId) return
    jsFiles.forEach((f) => {
      if (f.id in pendingEdits) {
        updateCommonFile(projectId, f.id, { content: pendingEdits[f.id] })
      }
    })
    setPendingEdits((prev) => {
      const next = { ...prev }
      jsFiles.forEach((f) => delete next[f.id])
      return next
    })
    setTimeout(() => alert('저장되었습니다.'), 0)
  }

  const hasPendingCss = cssFiles.some((f) => f.id in pendingEdits)
  const hasPendingJs = jsFiles.some((f) => f.id in pendingEdits)

  function handleRemoveAsset(asset: CommonAsset) {
    if (!projectId || !window.confirm(`"${asset.name}"을(를) 삭제할까요? 삭제된 항목은 복구할 수 없습니다.`)) return
    removeCommonAsset(projectId, asset.id)
  }

  function handleAssetFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !projectId) return
    const folderId = selectedAssetFolderId || undefined
    const addedInBatch = new Set<string>()
    files.forEach((file) => {
      if (addedInBatch.has(file.name)) return
      const existing = commonAssets.find((a) => a.name === file.name)
      if (existing) {
        if (!window.confirm(`이미 '${file.name}' 이름의 파일이 있습니다. 덮어쓸까요?`)) return
        removeCommonAsset(projectId, existing.id)
      }
      addedInBatch.add(file.name)
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        addCommonAsset(projectId, {
          name: file.name,
          dataUrl,
          exportFolderId: folderId,
        })
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const isImageDataUrl = (dataUrl: string) =>
    /^data:image\//i.test(dataUrl)

  return (
    <div className="lg-page">
      <header className="lg-page-header lg-page-header--column">
        <div>
          <h2 className="lg-page-title">공통 리소스</h2>
          <p className="lg-page-desc">
            프로젝트 전체에서 사용하는 CSS/JS 파일과 이미지·폰트 등 에셋을 관리합니다.
          </p>
        </div>
      </header>
      <div className="lg-tabs">
        <button
          type="button"
          className={`lg-tab ${activeTab === 'files' ? 'lg-tab--active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          공통 CSS/JS 파일
        </button>
        <button
          type="button"
          className={`lg-tab ${activeTab === 'assets' ? 'lg-tab--active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          공통 에셋
        </button>
      </div>
      <div className="lg-page-body">
        <div className="lg-resources-content">
          {activeTab === 'files' && (
          <section className="lg-section">
            <p className="lg-resources-desc">
              컴포넌트 프리뷰·에디터에 공통으로 포함되는 스타일·스크립트입니다.
              <br />
              <strong>component.css</strong>, <strong>component.js</strong>는 컴포넌트 등록·편집 시 입력한 CSS/JS가 자동 반영되며, 여기서는 수정·삭제할 수 없습니다.
            </p>
            <div className="lg-resources-actions" style={{ marginBottom: 20 }}>
              <input
                type="text"
                placeholder="파일 이름 (예: reset.css)"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="lg-input"
                style={{ width: 200 }}
              />
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value as 'css' | 'js')}
                className="lg-input"
                style={{ width: 80 }}
              >
                <option value="css">CSS</option>
                <option value="js">JS</option>
              </select>
              <Button variant="secondary" onClick={handleAddFile} disabled={!newFileName.trim()}>
                파일 추가
              </Button>
            </div>
            {newFileName.trim() && (
              <textarea
                placeholder="내용 (선택)"
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                className="lg-input"
                rows={4}
                style={{ width: '100%', maxWidth: 500, marginBottom: 20, fontFamily: 'monospace', fontSize: 13 }}
              />
            )}

            <h3 className="lg-section-title">CSS</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 20 }}>
              {cssFiles.map((f) => {
                const readOnly = isProtectedCommonFile(f.name)
                return (
                  <li
                    key={f.id}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      marginBottom: 8,
                      background: 'var(--color-surface)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{f.name}</span>
                      {readOnly ? (
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          수정 불가 (컴포넌트 편집에서 관리)
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => startEditFile(f)}
                            style={{ padding: '4px 8px' }}
                          >
                            편집
                          </Button>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => handleRemoveFile(f)}
                            style={{ color: 'var(--color-error, #dc2626)', padding: '4px 8px' }}
                          >
                            삭제
                          </Button>
                        </span>
                      )}
                    </div>
                    {editingFileId === f.id && !readOnly && (
                      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                        <textarea
                          value={getFileEditContent(f)}
                          onChange={(e) => setFileEditContent(f.id, e.target.value)}
                          className="lg-input"
                          rows={12}
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, marginTop: 8 }}
                          placeholder="CSS 소스 입력"
                        />
                        <div style={{ marginTop: 8 }}>
                          <Button variant="ghost" onClick={closeEditPanel} style={{ padding: '4px 8px' }}>
                            닫기
                          </Button>
                        </div>
                      </div>
                    )}
                    {readOnly && (
                      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                          수정 불가. 컴포넌트 등록·편집 시 입력한 CSS가 아래에 포함됩니다. 저장된 내용만 확인할 수 있습니다.
                        </p>
                        <textarea
                          readOnly
                          value={f.name === 'component.css' ? getComponentCssDisplayContent(f.content ?? '') : (f.content ?? '')}
                          className="lg-input"
                          rows={10}
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical', background: 'var(--color-bg)', cursor: 'default' }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div style={{ marginBottom: 20 }}>
              <Button variant="primary" onClick={savePendingCss} disabled={!hasPendingCss}>
                CSS 저장
              </Button>
            </div>

            <h3 className="lg-section-title">JS</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {jsFiles.map((f) => {
                const readOnly = isProtectedCommonFile(f.name)
                return (
                  <li
                    key={f.id}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      marginBottom: 8,
                      background: 'var(--color-surface)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{f.name}</span>
                      {readOnly ? (
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          수정 불가 (컴포넌트 편집에서 관리)
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => startEditFile(f)}
                            style={{ padding: '4px 8px' }}
                          >
                            편집
                          </Button>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => handleRemoveFile(f)}
                            style={{ color: 'var(--color-error, #dc2626)', padding: '4px 8px' }}
                          >
                            삭제
                          </Button>
                        </span>
                      )}
                    </div>
                    {editingFileId === f.id && !readOnly && (
                      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                        <textarea
                          value={getFileEditContent(f)}
                          onChange={(e) => setFileEditContent(f.id, e.target.value)}
                          className="lg-input"
                          rows={12}
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, marginTop: 8 }}
                          placeholder="JS 소스 입력"
                        />
                        <div style={{ marginTop: 8 }}>
                          <Button variant="ghost" onClick={closeEditPanel} style={{ padding: '4px 8px' }}>
                            닫기
                          </Button>
                        </div>
                      </div>
                    )}
                    {readOnly && (
                      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                          수정 불가. 컴포넌트 등록·편집 시 입력한 JS가 아래에 포함됩니다. 저장된 내용만 확인할 수 있습니다.
                        </p>
                        <textarea
                          readOnly
                          value={f.name === 'component.js' ? getComponentJsDisplayContent(f.content ?? '') : (f.content ?? '')}
                          className="lg-input"
                          rows={10}
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical', background: 'var(--color-bg)', cursor: 'default' }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div style={{ marginBottom: 20 }}>
              <Button variant="primary" onClick={savePendingJs} disabled={!hasPendingJs}>
                JS 저장
              </Button>
            </div>
          </section>
          )}

          {activeTab === 'assets' && (
          <section className="lg-section">
            <p className="lg-resources-desc">
              컴포넌트에서 참조하는 이미지·폰트 등입니다. 업로드 시 data URL로 저장됩니다.
            </p>
            <div className="lg-resources-actions" style={{ marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <select
                value={selectedAssetFolderId}
                onChange={(e) => setSelectedAssetFolderId(e.target.value)}
                className="lg-input"
                style={{ width: 'auto', minWidth: 180 }}
                title="저장할 파일 경로(폴더)"
              >
                {assetFolderOptions.map((opt) => (
                  <option key={opt.value || '__default'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                ref={assetInputRef}
                type="file"
                accept="image/*,.svg,.woff,.woff2"
                multiple
                onChange={handleAssetFileChange}
                style={{ display: 'none' }}
              />
              <Button
                variant="secondary"
                onClick={() => assetInputRef.current?.click()}
              >
                에셋 추가 (파일 선택)
              </Button>
            </div>
            {assetsByPath.map(([pathLabel, assets]) => (
              <div key={pathLabel} className="lg-section" style={{ marginBottom: 24 }}>
                <h3 className="lg-section-title" style={{ marginBottom: 12 }}>
                  {pathLabel}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 140px))', gap: 12, justifyContent: 'start' }}>
                  {assets.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        width: 140,
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                        padding: 10,
                        background: 'var(--color-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 100,
                          marginBottom: 8,
                          borderRadius: 4,
                          background: 'var(--color-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {isImageDataUrl(a.dataUrl) ? (
                          <img
                            src={a.dataUrl}
                            alt={a.name}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>파일</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          wordBreak: 'break-all',
                          textAlign: 'center',
                          marginBottom: 8,
                          minHeight: 32,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3,
                        }}
                        title={a.name}
                      >
                        {a.name}
                      </span>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => handleRemoveAsset(a)}
                        style={{ color: 'var(--color-error, #dc2626)', padding: '4px 8px', fontSize: 12, marginTop: 'auto' }}
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
          )}
        </div>
      </div>
    </div>
  )
}
