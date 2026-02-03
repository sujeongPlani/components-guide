import type { FileNode } from '@/store/types'

/**
 * 파일 트리 구조 변경 유틸 (편집용이 아닌 구조·경로 기준점 관리용)
 * - 같은 depth 내 순서 변경, 다른 폴더로 이동 등에 사용
 */

/** 트리에서 노드 ID로 노드 찾기 */
export function findNodeById(nodes: FileNode[], nodeId: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n
    if (n.children?.length) {
      const found = findNodeById(n.children, nodeId)
      if (found) return found
    }
  }
  return null
}

/** nodeId가 descendantId의 조상인지(또는 같음). 자기/자손 안으로 이동 방지 */
export function isAncestorOrSelf(nodes: FileNode[], nodeId: string, descendantId: string): boolean {
  if (nodeId === descendantId) return true
  for (const n of nodes) {
    if (n.id === descendantId) return false
    if (n.children?.length && isAncestorOrSelf(n.children, nodeId, descendantId)) return true
  }
  return false
}

/** 트리에서 노드 제거 후 새 트리와 제거된 노드 반환 */
export function removeNode(
  list: FileNode[],
  nodeId: string
): { tree: FileNode[]; node: FileNode | null } {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === nodeId) {
      const node = list[i]
      const tree = list.slice(0, i).concat(list.slice(i + 1))
      return { tree, node }
    }
    if (list[i].children?.length) {
      const { tree: nextChildren, node } = removeNode(list[i].children!, nodeId)
      if (node) {
        const tree = list.map((n, j) =>
          j === i ? { ...n, children: nextChildren } : n
        )
        return { tree, node }
      }
    }
  }
  return { tree: list, node: null }
}

/** 트리에 노드 삽입 (targetParentId=null 이면 루트, targetIndex 위치) */
export function insertNode(
  list: FileNode[],
  node: FileNode,
  targetParentId: string | null,
  targetIndex: number
): FileNode[] {
  if (targetParentId === null) {
    const next = list.slice()
    next.splice(Math.min(targetIndex, next.length), 0, node)
    return next
  }
  return list.map((n) => {
    if (n.id !== targetParentId) {
      return {
        ...n,
        children: n.children
          ? insertNode(n.children, node, targetParentId, targetIndex)
          : undefined,
      }
    }
    const children = [...(n.children ?? [])]
    children.splice(Math.min(targetIndex, children.length), 0, node)
    return { ...n, children }
  })
}

/** 노드 이동: 제거 후 목표 위치에 삽입. 무효(자기/자손 안으로)면 null */
export function moveNode(
  tree: FileNode[],
  nodeId: string,
  targetParentId: string | null,
  targetIndex: number
): FileNode[] | null {
  const node = findNodeById(tree, nodeId)
  if (!node) return null
  if (targetParentId !== null && isAncestorOrSelf(tree, nodeId, targetParentId))
    return null
  const { tree: treeWithoutNode, node: extracted } = removeNode(tree, nodeId)
  if (!extracted) return null
  return insertNode(treeWithoutNode, extracted, targetParentId, targetIndex)
}

/** 부모 ID와 형제 중 인덱스 반환 (루트는 parentId: null, 인덱스 0부터) */
export function getParentIdAndIndex(
  nodes: FileNode[],
  nodeId: string,
  parentId: string | null = null,
  index: number = 0
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) return { parentId, index: i }
    if (nodes[i].children?.length) {
      const found = getParentIdAndIndex(nodes[i].children!, nodeId, nodes[i].id, 0)
      if (found) return found
    }
  }
  return null
}
