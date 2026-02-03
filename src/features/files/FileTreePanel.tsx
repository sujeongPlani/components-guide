import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { FileNode } from '@/store/types'
import { findNodeById, isAncestorOrSelf } from '@/lib/fileTreeStructure'
import { isProtectedNode } from '@/lib/fileTree'

/** IDE 스타일 트리용: 한 행 메타 (depth, 라인 표시용) */
export interface FlatRow {
  node: FileNode
  depth: number
  parentId: string | null
  indexInParent: number
  /** depth 0..depth-1 에서 다음 형제가 있으면 true → │ 표시 */
  hasNextSiblingAtDepth: boolean[]
}

export function flattenTree(
  nodes: FileNode[],
  expandedIds: Set<string>,
  depth = 0,
  parentId: string | null = null,
  hasNextSiblingAtDepth: boolean[] = []
): FlatRow[] {
  const rows: FlatRow[] = []
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1
    const isFolder = node.type === 'folder'
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = (node.children?.length ?? 0) > 0

    rows.push({
      node,
      depth,
      parentId,
      indexInParent: i,
      hasNextSiblingAtDepth: [...hasNextSiblingAtDepth],
    })

    if (isFolder && hasChildren && isExpanded) {
      rows.push(
        ...flattenTree(
          node.children!,
          expandedIds,
          depth + 1,
          node.id,
          [...hasNextSiblingAtDepth, !isLast]
        )
      )
    }
  })
  return rows
}

/** 폴더 아이콘 */
function FolderIcon({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }} title="폴더">
      <svg
        style={{ color: 'var(--color-text-muted)' }}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {open ? (
          <>
            <path d="M2 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
            <path d="M2 6h20" />
          </>
        ) : (
          <path d="M2 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
        )}
      </svg>
    </span>
  )
}

/** 파일 아이콘 */
function FileIcon() {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }} title="파일">
      <svg
        style={{ color: 'var(--color-text-muted)' }}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    </span>
  )
}

/** IDE 스타일 들여쓰기 라인 (│ ├ └) */
function TreeIndentLines({ row }: { row: FlatRow }) {
  const { hasNextSiblingAtDepth, depth } = row
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, width: depth * 14, fontSize: 14, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}
      aria-hidden
    >
      {hasNextSiblingAtDepth.map((hasNext, i) => (
        <span key={i} style={{ width: 14, textAlign: 'center' }}>
          {hasNext ? '│' : ' '}
        </span>
      ))}
    </span>
  )
}

/** 마지막 브랜치 문자 (├ / └). depth 0은 공백으로 정렬 유지 */
function TreeBranch({ row, isLast }: { row: FlatRow; isLast: boolean }) {
  return (
    <span style={{ width: 14, textAlign: 'center', fontSize: 14, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
      {row.depth === 0 ? '\u00A0' : isLast ? '└' : '├'}
    </span>
  )
}

/** 단일 행: 드래그/드롭 + 컨텍스트 메뉴. 클릭 시 편집 화면으로 이동하지 않음(구조 전용) */
function TreeRow({
  row,
  isLastAmongSiblings,
  tree,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onAddFolder,
  onAddFile,
  onRemove,
  setExpandedIds,
}: {
  row: FlatRow
  isLastAmongSiblings: boolean
  tree: FileNode[]
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onAddFolder: (parentId: string | null) => void
  onAddFile: (parentId: string | null) => void
  onRemove: (nodeId: string) => void
  setExpandedIds: (fn: (prev: Set<string>) => Set<string>) => void
}) {
  const { node, depth, parentId, indexInParent } = row
  const isFolder = node.type === 'folder'
  const hasChildren = (node.children?.length ?? 0) > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const canDelete = !isProtectedNode(node)

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    data: { nodeId: node.id, node },
  })

  const targetParentId = isFolder ? node.id : parentId
  const targetIndex = isFolder ? (node.children?.length ?? 0) : indexInParent + 1

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: {
      parentId: targetParentId,
      index: targetIndex,
      isFolder,
      nodeId: node.id,
    },
  })

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        ref={setDropRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 8px',
          minHeight: 22,
          cursor: 'default',
          background: isSelected ? 'rgba(37,99,235,0.12)' : isOver ? 'rgba(37,99,235,0.08)' : undefined,
          outline: isDragging ? '2px dashed var(--color-primary)' : undefined,
          opacity: isDragging ? 0.6 : 1,
          borderRadius: 2,
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(node.id)
          if (isFolder) onToggleExpand(node.id)
        }}
        onContextMenu={handleContextMenu}
      >
        <TreeIndentLines row={row} />
        <TreeBranch row={row} isLast={isLastAmongSiblings} />
        <button
          ref={setDragRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="드래그하여 이동"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, padding: 0, border: 'none', background: 'none', cursor: 'grab', color: 'var(--color-text-muted)', fontSize: 12, flexShrink: 0 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
        {isFolder ? (
          <button
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 12, transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
            aria-expanded={isExpanded}
          >
            ▼
          </button>
        ) : (
          <span style={{ width: 18, display: 'inline-block' }} />
        )}
        {isFolder ? (
          <FolderIcon open={isExpanded && hasChildren} />
        ) : (
          <FileIcon />
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.name}>
          {node.name}
        </span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          isFolder={isFolder}
          canDelete={canDelete}
          onAddFolder={() => {
            onAddFolder(isFolder ? node.id : parentId)
            setContextMenu(null)
          }}
          onAddFile={() => {
            onAddFile(isFolder ? node.id : parentId)
            setContextMenu(null)
          }}
          onRemove={() => {
            if (canDelete) onRemove(node.id)
            setContextMenu(null)
          }}
        />
      )}
    </>
  )
}

/** 우클릭 메뉴 */
function ContextMenu({
  x,
  y,
  onClose,
  isFolder,
  canDelete,
  onAddFolder,
  onAddFile,
  onRemove,
}: {
  x: number
  y: number
  onClose: () => void
  isFolder: boolean
  canDelete: boolean
  onAddFolder: () => void
  onAddFile: () => void
  onRemove: () => void
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} onContextMenu={(e) => e.preventDefault()} aria-hidden />
      <div
        role="menu"
        style={{ position: 'fixed', left: x, top: y, zIndex: 1000, minWidth: 140, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      >
        <button type="button" onClick={onAddFolder} style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', border: 'none', background: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer' }}>
          새 폴더
        </button>
        <button type="button" onClick={onAddFile} style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', border: 'none', background: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer' }}>
          새 파일
        </button>
        {canDelete && (
          <button type="button" onClick={onRemove} style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', border: 'none', background: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer', color: 'var(--color-error, #dc2626)' }}>
            삭제
          </button>
        )}
      </div>
    </>
  )
}

/** 드래그 중 오버레이(ghost) */
function DragOverlayContent({ node }: { node: FileNode }) {
  const isFolder = node.type === 'folder'
  const hasChildren = (node.children?.length ?? 0) > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--color-surface)', border: '2px dashed var(--color-primary)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: 0.95 }}>
      {isFolder ? (
        <FolderIcon open={hasChildren} />
      ) : (
        <FileIcon />
      )}
      <span style={{ fontSize: 14, fontWeight: 500 }}>{node.name}</span>
    </div>
  )
}

export interface FileTreePanelProps {
  fileTree: FileNode[]
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string | null) => void
  onToggleExpand: (id: string) => void
  onAddFolder: (parentId: string | null) => void
  onAddFile: (parentId: string | null) => void
  onRemove: (nodeId: string) => void
  moveFileNode: (nodeId: string, targetParentId: string | null, targetIndex: number) => boolean
  setExpandedIds: (fn: (prev: Set<string>) => Set<string>) => void
}

export function FileTreePanel({
  fileTree,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onAddFolder,
  onAddFile,
  onRemove,
  moveFileNode,
  setExpandedIds,
}: FileTreePanelProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const flatRows = flattenTree(fileTree, expandedIds)

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over?.data.current) return
    const draggedId = active.id as string
    const { parentId, index, isFolder, nodeId } = over.data.current as {
      parentId: string | null
      index: number
      isFolder: boolean
      nodeId: string
    }
    if (draggedId === nodeId) return
    if (parentId !== null && isAncestorOrSelf(fileTree, draggedId, parentId)) return
    const ok = moveFileNode(draggedId, parentId, index)
    if (ok && parentId) setExpandedIds((prev) => new Set(prev).add(parentId))
  }

  const activeNode = activeId ? findNodeById(fileTree, activeId) : null

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}>
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ padding: '8px 0', minWidth: 200 }}>
          {flatRows.map((row, i) => {
            const nextRow = flatRows[i + 1]
            const isLastAmongSiblings =
              !nextRow || nextRow.depth < row.depth || (nextRow.depth === row.depth && nextRow.parentId !== row.parentId)
            return (
              <TreeRow
                key={row.node.id}
                row={row}
                isLastAmongSiblings={isLastAmongSiblings}
                tree={fileTree}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                onAddFolder={onAddFolder}
                onAddFile={onAddFile}
                onRemove={onRemove}
                setExpandedIds={setExpandedIds}
              />
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeNode ? <DragOverlayContent node={activeNode} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
