import type { FileNode } from '@/store/types'
import { PROTECTED_FILE_NAMES } from '@/store/types'

function uuid() {
  return crypto.randomUUID()
}

/**
 * 프로젝트 생성 시 기본 파일 트리
 * WebContent/
 *  ├ css/
 *  │  └ component.css
 *  ├ js/
 *  │  └ component.js
 *  ├ img/
 *  └ index.html
 */
export function createDefaultFileTree(): FileNode[] {
  return [
    {
      id: uuid(),
      name: 'WebContent',
      type: 'folder',
      children: [
        {
          id: uuid(),
          name: 'css',
          type: 'folder',
          children: [
            { id: uuid(), name: 'component.css', type: 'file', children: undefined },
          ],
        },
        {
          id: uuid(),
          name: 'js',
          type: 'folder',
          children: [
            { id: uuid(), name: 'component.js', type: 'file', children: undefined },
          ],
        },
        { id: uuid(), name: 'img', type: 'folder', children: [] },
        { id: uuid(), name: 'components', type: 'folder', children: [] },
        { id: uuid(), name: 'index.html', type: 'file', children: undefined },
      ],
    },
  ]
}

/** 트리에서 노드 ID로 경로 세그먼트 배열 반환 (root → node) */
export function getPathToNode(nodes: FileNode[], nodeId: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === nodeId) return [...path, n.name]
    if (n.children?.length) {
      const found = getPathToNode(n.children, nodeId, [...path, n.name])
      if (found) return found
    }
  }
  return null
}

/** 노드의 전체 경로 문자열 (예: WebContent/css/component.css) */
export function getNodePath(nodes: FileNode[], nodeId: string): string | null {
  const segs = getPathToNode(nodes, nodeId)
  return segs ? segs.join('/') : null
}

/** 트리에서 노드 찾기 */
export function getNodeById(nodes: FileNode[], nodeId: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n
    if (n.children?.length) {
      const found = getNodeById(n.children, nodeId)
      if (found) return found
    }
  }
  return null
}

/** nodeId가 descendantId의 조상인지(또는 같음). 드래그 시 자기/자손 안으로 이동 방지용 */
export function isAncestorOrSelf(nodes: FileNode[], nodeId: string, descendantId: string): boolean {
  if (nodeId === descendantId) return true
  for (const n of nodes) {
    if (n.id === descendantId) return false
    if (n.children?.length && isAncestorOrSelf(n.children, nodeId, descendantId)) return true
  }
  return false
}

/** 보호 파일(삭제 제한) 여부 */
export function isProtectedNode(node: FileNode): boolean {
  return node.type === 'file' && (PROTECTED_FILE_NAMES as readonly string[]).includes(node.name)
}

/** 파일명으로 트리에서 첫 번째 매칭 노드 찾기 */
function findNodeByName(nodes: FileNode[], name: string): FileNode | null {
  for (const n of nodes) {
    if (n.name === name) return n
    if (n.children?.length) {
      const found = findNodeByName(n.children, name)
      if (found) return found
    }
  }
  return null
}

/** 트리에서 이름이 일치하는 첫 번째 폴더 노드 반환 (리소스 동기화용) */
export function getFolderByName(nodes: FileNode[], name: string): FileNode | null {
  for (const n of nodes) {
    if (n.type === 'folder' && n.name === name) return n
    if (n.children?.length) {
      const found = getFolderByName(n.children, name)
      if (found) return found
    }
  }
  return null
}

/** 루트(첫 번째 폴더) 아래에 폴더가 없으면 추가. components 폴더 등 */
export function ensureFolderUnderRoot(tree: FileNode[], folderName: string): FileNode[] {
  if (getFolderByName(tree, folderName)) return tree
  const root = tree[0]
  if (!root || root.type !== 'folder') return tree
  const newFolder: FileNode = {
    id: uuid(),
    name: folderName,
    type: 'folder',
    children: [],
  }
  return [{ ...root, children: [...(root.children ?? []), newFolder] }]
}

/** 해당 폴더(이름) 아래에서 파일명으로 노드 찾기 (삭제 시 id 확인용) */
export function findFileInFolder(nodes: FileNode[], folderName: string, fileName: string): FileNode | null {
  const folder = getFolderByName(nodes, folderName)
  if (!folder?.children) return null
  const file = folder.children.find((c) => c.type === 'file' && c.name === fileName)
  return file ?? null
}

/** 해당 폴더(이름) 아래에 파일 노드가 없으면 추가. 트리 구조·경로 동기화용 */
export function ensureFileUnderFolder(
  tree: FileNode[],
  folderName: string,
  fileName: string
): FileNode[] {
  const folder = getFolderByName(tree, folderName)
  if (!folder) return tree
  const hasFile = (folder.children ?? []).some((c) => c.type === 'file' && c.name === fileName)
  if (hasFile) return tree
  const newNode: FileNode = {
    id: crypto.randomUUID(),
    name: fileName,
    type: 'file',
    children: undefined,
  }
  const inject = (list: FileNode[]): FileNode[] =>
    list.map((n) =>
      n.id === folder.id
        ? { ...n, children: [...(n.children ?? []), newNode] }
        : { ...n, children: n.children ? inject(n.children) : undefined }
    )
  return inject(tree)
}

/** 해당 폴더(id) 아래에 파일 노드가 없으면 추가. 업로드 경로 선택용 */
export function ensureFileUnderFolderById(
  tree: FileNode[],
  folderId: string,
  fileName: string
): FileNode[] {
  const folder = getNodeById(tree, folderId)
  if (!folder || folder.type !== 'folder') return tree
  const hasFile = (folder.children ?? []).some((c) => c.type === 'file' && c.name === fileName)
  if (hasFile) return tree
  const newNode: FileNode = {
    id: crypto.randomUUID(),
    name: fileName,
    type: 'file',
    children: undefined,
  }
  const inject = (list: FileNode[]): FileNode[] =>
    list.map((n) =>
      n.id === folderId
        ? { ...n, children: [...(n.children ?? []), newNode] }
        : { ...n, children: n.children ? inject(n.children) : undefined }
    )
  return inject(tree)
}

/** CSS 파일 경로 (component.css) */
export function resolveCssPath(fileTree: FileNode[]): string {
  const node = findNodeByName(fileTree, 'component.css')
  return node ? (getNodePath(fileTree, node.id) ?? 'WebContent/css/component.css') : 'WebContent/css/component.css'
}

/** JS 파일 경로 (component.js) */
export function resolveJsPath(fileTree: FileNode[]): string {
  const node = findNodeByName(fileTree, 'component.js')
  return node ? (getNodePath(fileTree, node.id) ?? 'WebContent/js/component.js') : 'WebContent/js/component.js'
}

/** index.html 경로 */
export function resolveIndexHtmlPath(fileTree: FileNode[]): string {
  const node = findNodeByName(fileTree, 'index.html')
  return node ? (getNodePath(fileTree, node.id) ?? 'WebContent/index.html') : 'WebContent/index.html'
}

/** 이미지 루트 폴더 경로 (img 폴더, 끝에 /) */
export function resolveImgPath(fileTree: FileNode[]): string {
  const node = findNodeByName(fileTree, 'img')
  if (!node || node.type !== 'folder') return 'WebContent/img/'
  const path = getNodePath(fileTree, node.id)
  return path ? path + '/' : 'WebContent/img/'
}

/** 특정 폴더 노드의 경로 (끝에 /). 노드가 폴더가 아니면 img 루트 반환 */
export function resolveFolderPath(fileTree: FileNode[], folderNodeId: string): string {
  const node = getNodeById(fileTree, folderNodeId)
  if (!node || node.type !== 'folder') return resolveImgPath(fileTree)
  const path = getNodePath(fileTree, node.id)
  return path ? path + '/' : resolveImgPath(fileTree)
}

/** 트리 내 모든 폴더 노드 (id, name, path) - 리소스 폴더 선택용 */
export function listFolderNodes(nodes: FileNode[], basePath: string[] = []): { id: string; name: string; path: string }[] {
  const list: { id: string; name: string; path: string }[] = []
  for (const n of nodes) {
    const path = [...basePath, n.name]
    const pathStr = path.join('/') + '/'
    if (n.type === 'folder') {
      list.push({ id: n.id, name: n.name, path: pathStr })
      if (n.children?.length) list.push(...listFolderNodes(n.children, path))
    }
  }
  return list
}

/** 트리 내 모든 파일 노드의 경로 문자열 (예: WebContent/css/reset.css) */
export function getAllFilePaths(nodes: FileNode[], basePath: string[] = []): string[] {
  const list: string[] = []
  for (const n of nodes) {
    const path = [...basePath, n.name]
    if (n.type === 'file') {
      list.push(path.join('/'))
    }
    if (n.children?.length) {
      list.push(...getAllFilePaths(n.children, path))
    }
  }
  return list
}
