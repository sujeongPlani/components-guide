import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGuideStore } from '@/store'
import type { FileNode } from '@/store/types'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { createDefaultFileTree, getNodePath, isProtectedNode } from '@/lib/fileTree'
import { downloadGuideAsZip } from '@/lib/export'
import { FileTreePanel } from './FileTreePanel'

/** 트리에서 모든 폴더 id 수집 (기본 전부 펼침용) */
function getAllFolderIds(nodes: FileNode[]): Set<string> {
  const ids = new Set<string>()
  for (const n of nodes) {
    if (n.type === 'folder') {
      ids.add(n.id)
      if (n.children?.length) getAllFolderIds(n.children).forEach((id) => ids.add(id))
    }
  }
  return ids
}

export function FileStructurePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useGuideStore((s) => (projectId ? s.getProject(projectId) : undefined))
  const fileTree = project?.fileTree ?? createDefaultFileTree()
  const addFileNode = useGuideStore((s) => s.addFileNode)
  const removeFileNode = useGuideStore((s) => s.removeFileNode)
  const moveFileNodeStore = useGuideStore((s) => s.moveFileNode)
  const resetFileTreeToDefault = useGuideStore((s) => s.resetFileTreeToDefault)
  const saveDefaultStructureToKrds = useGuideStore((s) => s.saveDefaultStructureToKrds)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => getAllFolderIds(fileTree))
  const [downloading, setDownloading] = useState(false)

  function handleResetToDefault() {
    alert(
      '기본 파일 구조(WebContent/ ├ css/ ├ js/ ├ img/ └ index.html)로 리셋되어 파일 구조가 바뀌며, 파일 및 리소스를 다시 추가해야합니다.'
    )
    if (projectId) resetFileTreeToDefault(projectId)
  }

  /** fileTree에 새 폴더가 추가되면 해당 폴더도 펼친 상태로 유지 */
  useEffect(() => {
    const allIds = getAllFolderIds(fileTree)
    setExpandedIds((prev) => {
      let changed = false
      allIds.forEach((id) => {
        if (!prev.has(id)) changed = true
      })
      if (!changed) return prev
      return new Set([...prev, ...allIds])
    })
  }, [fileTree])

  if (!projectId || !project) {
    navigate('/projects', { replace: true })
    return null
  }

  const pathToSelected = selectedId ? getNodePath(fileTree, selectedId) : null

  const selectedNode = selectedId
    ? (function find(nodes: FileNode[]): FileNode | null {
        for (const n of nodes) {
          if (n.id === selectedId) return n
          if (n.children?.length) {
            const f = find(n.children)
            if (f) return f
          }
        }
        return null
      })(fileTree)
    : null
  const selectedIsFolder = selectedNode?.type === 'folder'
  const parentIdForAdd = selectedIsFolder ? selectedId : null
  const canDeleteSelected = selectedId && selectedNode && !isProtectedNode(selectedNode)

  const [newFolderName, setNewFolderName] = useState('')
  const [newFileName, setNewFileName] = useState('')

  /** 폴더 펼침/접힘 토글 */
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddFolder() {
    if (!projectId) return
    const name = newFolderName.trim() || '새 폴더'
    addFileNode(projectId, parentIdForAdd, { name, type: 'folder' })
    setNewFolderName('')
  }

  function handleAddFile() {
    if (!projectId) return
    const name = newFileName.trim() || '새 파일'
    addFileNode(projectId, parentIdForAdd, { name, type: 'file' })
    setNewFileName('')
  }

  function getNodeNameById(nodes: FileNode[], id: string): string | null {
    for (const n of nodes) {
      if (n.id === id) return n.name
      if (n.children?.length) {
        const found = getNodeNameById(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  function handleRemove() {
    if (!projectId || !selectedId || !canDeleteSelected) return
    if (!window.confirm('선택한 항목을 삭제할까요? 삭제된 항목은 복구할 수 없습니다.')) return
    if (removeFileNode(projectId, selectedId)) setSelectedId(null)
  }

  function handleRemoveNode(nodeId: string) {
    if (!projectId) return
    const name = getNodeNameById(fileTree, nodeId) || '이 항목'
    if (!window.confirm(`"${name}"을(를) 삭제할까요? 삭제된 항목은 복구할 수 없습니다.`)) return
    if (removeFileNode(projectId, nodeId) && selectedId === nodeId) setSelectedId(null)
  }

  function moveFileNode(
    nodeId: string,
    targetParentId: string | null,
    targetIndex: number
  ): boolean {
    if (!projectId) return false
    return moveFileNodeStore(projectId, nodeId, targetParentId, targetIndex)
  }

  async function handleDownloadZip() {
    if (!projectId || !project || !fileTree.length) return
    setDownloading(true)
    try {
      await downloadGuideAsZip(project.components, {
        commonFiles: project.commonFiles,
        commonAssets: project.commonAssets,
        fileTree,
        zipFileName: `${project.name.replace(/[^\w\s-]/g, '') || 'guide'}.zip`,
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="lg-page">
      <header className="lg-page-header">
        <div>
          <h2 className="lg-page-title">파일 구조</h2>
          <p className="lg-page-desc">
            프로젝트 파일 구조·경로 기준점만 관리합니다. 편집은 컴포넌트 에디터·공통 리소스에서 합니다. 파일 구조가 변경되면 리소스 재등록이 필요합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={handleResetToDefault}
            title="파일 구조를 WebContent/css, js, img, index.html 기본 구조로 되돌립니다"
          >
            기본 파일 구조로 리셋
          </Button>
          {projectId === 'krds' && (
            <Button
              variant="secondary"
              onClick={() => {
                saveDefaultStructureToKrds()
                alert('KRDS 프로젝트에 기본 구조(WebContent/css, js, img, index.html + 리소스)가 저장되었습니다.')
              }}
              title="현재 기본 구조와 공동 리소스를 KRDS 편집본에 저장"
            >
              이 구조를 KRDS에 저장
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleDownloadZip}
            disabled={!fileTree.length || downloading}
            title={
              !fileTree.length
                ? '파일 트리를 먼저 구성하세요'
                : '파일 구조대로 전체를 ZIP으로 다운로드'
            }
          >
            {downloading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <LoadingSpinner size={18} />
                압축 중…
              </span>
            ) : (
              '전체 다운로드 (ZIP)'
            )}
          </Button>
        </div>
      </header>
      <div className="lg-files-layout">
        <div className="lg-files-tree-wrap">
          {fileTree.length === 0 ? (
            <div className="lg-sidebar-hint" style={{ padding: 16 }}>
              파일 트리가 없습니다. 프로젝트 생성 시 WebContent 기준 구조가 자동 생성됩니다.
            </div>
          ) : (
            <FileTreePanel
              fileTree={fileTree}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={setSelectedId}
              onToggleExpand={toggleExpanded}
              onAddFolder={(parentId) => addFileNode(projectId, parentId, { name: '새 폴더', type: 'folder' })}
              onAddFile={(parentId) => addFileNode(projectId, parentId, { name: '새 파일', type: 'file' })}
              onRemove={handleRemoveNode}
              moveFileNode={moveFileNode}
              setExpandedIds={setExpandedIds}
            />
          )}
        </div>
        <aside className="lg-files-aside">
          <div className="lg-card">
            <h3 className="lg-card-title">선택된 항목</h3>
            {pathToSelected ? (
              <p style={{ margin: 0, fontSize: 14, wordBreak: 'break-all', color: 'var(--color-text-muted)' }}>{pathToSelected}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)' }}>폴더/파일을 클릭하면 여기에 하위로 추가됩니다.</p>
            )}
          </div>
          <div className="lg-card">
            <h3 className="lg-card-title">폴더 추가</h3>
            <p className="lg-card-desc">{selectedIsFolder ? '선택한 폴더 하위에' : '루트에'} 추가됩니다.</p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="폴더 이름"
              className="lg-input"
              style={{ marginBottom: 8 }}
            />
            <Button variant="secondary" onClick={handleAddFolder} style={{ width: '100%' }}>
              폴더 추가
            </Button>
          </div>
          <div className="lg-card">
            <h3 className="lg-card-title">파일 추가</h3>
            <p className="lg-card-desc">{selectedIsFolder ? '선택한 폴더 하위에' : '루트에'} 추가됩니다.</p>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="파일 이름"
              className="lg-input"
              style={{ marginBottom: 8 }}
            />
            <Button variant="secondary" onClick={handleAddFile} style={{ width: '100%' }}>
              파일 추가
            </Button>
          </div>
          <div className="lg-card">
            <h3 className="lg-card-title">삭제</h3>
            <p className="lg-card-desc">component.css, component.js, index.html은 삭제할 수 없습니다.</p>
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={!canDeleteSelected}
              style={{ width: '100%', color: 'var(--color-error, #dc2626)' }}
            >
              선택 항목 삭제
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
