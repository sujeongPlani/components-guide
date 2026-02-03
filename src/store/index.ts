import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ComponentItem, CommonFile, CommonAsset, Project, ExportPaths, ExportPathNode, FileNode } from './types'
import { DEFAULT_CATEGORIES } from './types'
import { createDefaultFileTree, isProtectedNode, ensureFileUnderFolder, ensureFileUnderFolderById } from '@/lib/fileTree'
import { getKrdsSeedProject } from '@/data/krds-seed'

function findFileNodeById(nodes: FileNode[], nodeId: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n
    if (n.children?.length) {
      const found = findFileNodeById(n.children, nodeId)
      if (found) return found
    }
  }
  return null
}

/** 트리에서 노드 제거 후 새 트리와 제거된 노드 반환 */
function removeFileNodeFromTree(list: FileNode[], nodeId: string): { list: FileNode[]; node: FileNode | null } {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === nodeId) {
      const node = list[i]
      const nextList = list.slice(0, i).concat(list.slice(i + 1))
      return { list: nextList, node }
    }
    if (list[i].children?.length) {
      const { list: nextChildren, node } = removeFileNodeFromTree(list[i].children!, nodeId)
      if (node) {
        const nextList = list.map((n, j) =>
          j === i ? { ...n, children: nextChildren } : n
        )
        return { list: nextList, node }
      }
    }
  }
  return { list, node: null }
}

/** 트리에 노드 삽입 (targetParentId=null 이면 루트, targetIndex 위치) */
function insertFileNodeIntoTree(
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
      return { ...n, children: n.children ? insertFileNodeIntoTree(n.children, node, targetParentId, targetIndex) : undefined }
    }
    const children = [...(n.children ?? [])]
    children.splice(Math.min(targetIndex, children.length), 0, node)
    return { ...n, children }
  })
}

/** nodeId가 descendantId의 조상인지 (또는 같음) */
function isAncestorOrSelf(nodes: FileNode[], nodeId: string, descendantId: string): boolean {
  if (nodeId === descendantId) return true
  for (const n of nodes) {
    if (n.id === descendantId) return false
    if (n.children?.length && isAncestorOrSelf(n.children, nodeId, descendantId)) return true
  }
  return false
}

const STORAGE_KEY = 'live-component-guide'

/**
 * 빈 projects로 기존 데이터를 덮어쓰지 않도록 방지 (localStorage 사용).
 * 저장 실패(quota 등) 시 기존 값 유지.
 */
function createSafeStorage(): { getItem: (name: string) => string | null; setItem: (name: string, value: string) => void; removeItem: (name: string) => void } {
  return {
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name: string, value: string) => {
      try {
        const next = JSON.parse(value) as { state?: { projects?: unknown[] }; projects?: unknown[] }
        const nextProjects = next?.state?.projects ?? next?.projects
        if (Array.isArray(nextProjects) && nextProjects.length === 0) {
          const raw = localStorage.getItem(name)
          if (raw) {
            const prev = JSON.parse(raw) as { state?: { projects?: unknown[] }; projects?: unknown[] }
            const prevProjects = prev?.state?.projects ?? prev?.projects
            if (Array.isArray(prevProjects) && prevProjects.length > 0) return
          }
        }
        localStorage.setItem(name, value)
      } catch {
        try {
          localStorage.setItem(name, value)
        } catch (err) {
          const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)
          window.dispatchEvent(
            new CustomEvent('live-guide-storage-failed', {
              detail: { reason: isQuota ? 'quota' : 'unknown', error: err },
            })
          )
        }
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name)
      } catch {}
    },
  }
}

/** FileNode 트리 복사 (id 재생성) */
function cloneFileTree(nodes: FileNode[]): FileNode[] {
  return nodes.map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    children: n.children?.length ? cloneFileTree(n.children) : undefined,
  }))
}

/** FileNode(트리)에 새 id 부여 (가져오기용) */
function assignNewIdsToFileNode(n: FileNode): FileNode {
  return {
    ...n,
    id: crypto.randomUUID(),
    children: n.children?.length ? n.children.map(assignNewIdsToFileNode) : undefined,
  }
}

/** CommonFile 복사 (id 재생성) */
function cloneCommonFiles(files: CommonFile[]): CommonFile[] {
  return files.map((f) => ({ ...f, id: crypto.randomUUID() }))
}

/** CommonAsset 복사 (id 재생성) */
function cloneCommonAssets(assets: CommonAsset[]): CommonAsset[] {
  return assets.map((a) => ({ ...a, id: crypto.randomUUID() }))
}

/** localStorage에서 복원한 컴포넌트에 html/css/js가 누락돼 있으면 빈 문자열로 채움 */
function normalizeComponentItem(c: Partial<ComponentItem> & { id: string }): ComponentItem {
  return {
    id: c.id,
    name: typeof c.name === 'string' ? c.name : '',
    category: typeof c.category === 'string' ? c.category : '',
    description: typeof c.description === 'string' ? c.description : '',
    html: typeof c.html === 'string' ? c.html : '',
    css: typeof c.css === 'string' ? c.css : '',
    js: typeof c.js === 'string' ? c.js : '',
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
  }
}

/** ComponentItem 배열 복사 (id, createdAt, updatedAt 재생성) */
function cloneComponents(components: ComponentItem[]): ComponentItem[] {
  const now = Date.now()
  return components.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }))
}

function createComponent(partial: Omit<ComponentItem, 'id' | 'createdAt' | 'updatedAt'>): ComponentItem {
  const now = Date.now()
  return {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
}

function createProject(
  name: string,
  options?: {
    coverImage?: string
    participants?: string[]
    exportPaths?: ExportPaths
    exportPathTree?: ExportPathNode[]
    fileTree?: FileNode[]
    selectedGuideIds?: string[] // 프로젝트 ID 배열 (북마크 가이드 = isBookmarkGuide인 프로젝트)
  }
): Project {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || '새 프로젝트',
    coverImage: options?.coverImage,
    participants: options?.participants?.filter(Boolean) ?? [],
    exportPaths: options?.exportPaths,
    exportPathTree: options?.exportPathTree ?? [],
    fileTree: options?.fileTree ?? createDefaultFileTree(),
    components: [],
    categories: [...DEFAULT_CATEGORIES],
    commonFiles: [],
    commonAssets: [],
    isBookmarkGuide: false,
  }
}

interface GuideStore {
  projects: Project[]
  getProject: (id: string) => Project | undefined
  addProject: (
    name: string,
    options?: {
      coverImage?: string
      participants?: string[]
      exportPaths?: ExportPaths
      exportPathTree?: ExportPathNode[]
      fileTree?: FileNode[]
      selectedGuideIds?: string[] // 북마크 가이드(프로젝트) ID 배열
    }
  ) => string
  /** JSON 등으로 내보낸 프로젝트 데이터를 그대로 넣어 프로젝트 생성 (commonFiles, commonAssets, fileTree 등) */
  addProjectWithData: (data: {
    name: string
    commonFiles?: Array<Omit<CommonFile, 'id'> & { id?: string }>
    commonAssets?: Array<Omit<CommonAsset, 'id'> & { id?: string }>
    fileTree?: FileNode[]
    categories?: string[]
  }) => string
  removeProject: (id: string) => void
  updateProjectName: (id: string, name: string) => void
  updateProjectMeta: (id: string, partial: { name?: string; coverImage?: string; participants?: string[]; isBookmarkGuide?: boolean; exportPaths?: ExportPaths; exportPathTree?: ExportPathNode[]; fileTree?: FileNode[] }) => void
  copyFromProjectsIntoProject: (targetProjectId: string, sourceProjectIds: string[]) => void
  addExportPathNode: (projectId: string, node: { name: string; path: string }, parentId?: string) => string
  removeExportPathNode: (projectId: string, nodeId: string) => void
  updateExportPathNode: (projectId: string, nodeId: string, partial: { name?: string; path?: string }) => void
  reorderExportPathTree: (projectId: string, nodeIds: string[]) => void
  addFileNode: (projectId: string, parentId: string | null, node: { name: string; type: 'folder' | 'file' }) => string
  removeFileNode: (projectId: string, nodeId: string) => boolean
  updateFileNode: (projectId: string, nodeId: string, partial: { name?: string }) => void
  moveFileNode: (projectId: string, nodeId: string, targetParentId: string | null, targetIndex: number) => boolean
  addComponent: (projectId: string, component: Omit<ComponentItem, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateComponent: (projectId: string, componentId: string, partial: Partial<ComponentItem>) => void
  removeComponent: (projectId: string, componentId: string) => void
  getComponent: (projectId: string, componentId: string) => ComponentItem | undefined
  setComponents: (projectId: string, components: ComponentItem[]) => void
  addCategory: (projectId: string, name: string) => void
  removeCategory: (projectId: string, name: string) => void
  reorderCategories: (projectId: string, orderedNames: string[]) => void
  addCommonFile: (projectId: string, item: Omit<CommonFile, 'id'>) => void
  removeCommonFile: (projectId: string, fileId: string) => void
  updateCommonFile: (projectId: string, fileId: string, partial: Partial<CommonFile>) => void
  addCommonAsset: (projectId: string, item: Omit<CommonAsset, 'id'>) => void
  removeCommonAsset: (projectId: string, assetId: string) => void
  updateCommonAsset: (projectId: string, assetId: string, partial: Partial<CommonAsset>) => void
  /** 공통 리소스(CSS/JS/이미지)를 파일트리에 반영. 파일 구조 페이지 진입 시·기존 데이터 동기화용 */
  syncCommonResourcesToFileTree: (projectId: string) => void
  /** 데이터 가져오기: 백업 JSON의 projects를 정규화 후 스토어에 반영 */
  restoreFromBackup: (payload: { projects?: unknown[] }) => void
}

export const useGuideStore = create<GuideStore>()(
  persist(
    (set, get) => ({
      projects: [],

      getProject: (id) => get().projects.find((p) => p.id === id),

      copyFromProjectsIntoProject: (targetProjectId, sourceProjectIds) => {
        const sources = sourceProjectIds
          .map((id) => get().getProject(id))
          .filter((p): p is Project => p != null)
        if (sources.length === 0) return
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== targetProjectId) return p
            let fileTree = createDefaultFileTree()
            const commonFiles: CommonFile[] = []
            const commonAssets: CommonAsset[] = []
            const components: ComponentItem[] = []
            const categorySet = new Set<string>()
            for (const src of sources) {
              if (src.fileTree?.length) fileTree = cloneFileTree(src.fileTree)
              if (src.commonFiles?.length) commonFiles.push(...cloneCommonFiles(src.commonFiles))
              if (src.commonAssets?.length) commonAssets.push(...cloneCommonAssets(src.commonAssets))
              if (src.components?.length) components.push(...cloneComponents(src.components))
              src.categories?.forEach((c) => categorySet.add(c))
            }
            const categories = categorySet.size > 0 ? Array.from(categorySet) : [...DEFAULT_CATEGORIES]
            return {
              ...p,
              fileTree,
              commonFiles,
              commonAssets,
              components,
              categories,
            }
          }),
        }))
      },

      addProject: (name, options) => {
        const project = createProject(name, options)
        set((state) => ({ projects: [...state.projects, project] }))
        if (options?.selectedGuideIds?.length) {
          get().copyFromProjectsIntoProject(project.id, options.selectedGuideIds)
        }
        return project.id
      },

      addProjectWithData: (data) => {
        const id = crypto.randomUUID()
        const commonFiles: CommonFile[] = (data.commonFiles ?? []).map((f) => ({
          id: f.id ?? crypto.randomUUID(),
          name: f.name,
          content: f.content,
          type: f.type,
        }))
        const commonAssets: CommonAsset[] = (data.commonAssets ?? []).map((a) => ({
          id: a.id ?? crypto.randomUUID(),
          name: a.name,
          dataUrl: a.dataUrl,
          exportFolderId: a.exportFolderId,
        }))
        const fileTree = (data.fileTree ?? []).length > 0
          ? (data.fileTree ?? []).map((n) => assignNewIdsToFileNode(n))
          : createDefaultFileTree()
        const project: Project = {
          id,
          name: data.name.trim() || '가져온 프로젝트',
          components: [],
          categories: data.categories?.length ? [...data.categories] : [...DEFAULT_CATEGORIES],
          commonFiles,
          commonAssets,
          fileTree,
          exportPathTree: [],
          isBookmarkGuide: false,
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return id
      },

      removeProject: (id) =>
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

      /** 데이터 가져오기: 백업 JSON의 projects를 정규화 후 스토어에 반영 */
      restoreFromBackup: (payload: { projects?: unknown[] }) => {
        const raw = Array.isArray(payload?.projects) ? payload.projects : []
        const projects: Project[] = raw.map((proj) => {
          const base = { ...(typeof proj === 'object' && proj !== null ? proj : {}) } as Project
          const withComponents = Array.isArray(base.components)
            ? { ...base, components: base.components.map((c) => normalizeComponentItem(c)) }
            : { ...base, components: [] }
          const withCategories = Array.isArray(withComponents.categories) && withComponents.categories.length > 0
            ? withComponents
            : { ...withComponents, categories: [...DEFAULT_CATEGORIES] }
          const withCommonFiles = Array.isArray(withCategories.commonFiles) ? withCategories : { ...withCategories, commonFiles: [] }
          const withCommonAssets = Array.isArray(withCommonFiles.commonAssets) ? withCommonFiles : { ...withCommonFiles, commonAssets: [] }
          const withFileTree =
            !withCommonAssets.fileTree || withCommonAssets.fileTree.length === 0
              ? { ...withCommonAssets, fileTree: createDefaultFileTree() }
              : withCommonAssets
          const withBookmark =
            typeof (withFileTree as Project).isBookmarkGuide === 'boolean'
              ? withFileTree
              : { ...withFileTree, isBookmarkGuide: false }
          return withBookmark
        })
        const withKrds = projects.some((p) => p.name === 'KRDS')
          ? projects
          : [...projects, getKrdsSeedProject()]
        set({ projects: withKrds })
      },

      updateProjectName: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p
          ),
        })),

      updateProjectMeta: (id, partial) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...partial } : p
          ),
        })),

      addExportPathNode: (projectId, node, parentId) => {
        const newNode: ExportPathNode = {
          id: crypto.randomUUID(),
          name: node.name.trim() || '폴더',
          path: node.path.trim().replace(/\/?$/, '/'),
          children: [],
        }
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const tree = p.exportPathTree ?? []
            if (!parentId) return { ...p, exportPathTree: [...tree, newNode] }
            const inject = (list: ExportPathNode[]): ExportPathNode[] =>
              list.map((n) =>
                n.id === parentId
                  ? { ...n, children: [...n.children, newNode] }
                  : { ...n, children: inject(n.children) }
              )
            return { ...p, exportPathTree: inject(tree) }
          }),
        }))
        return newNode.id
      },

      removeExportPathNode: (projectId, nodeId) => {
        const remove = (list: ExportPathNode[]): ExportPathNode[] =>
          list.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: remove(n.children) }))
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, exportPathTree: remove(p.exportPathTree ?? []) } : p
          ),
        }))
      },

      updateExportPathNode: (projectId, nodeId, partial) => {
        const update = (list: ExportPathNode[]): ExportPathNode[] =>
          list.map((n) =>
            n.id === nodeId
              ? { ...n, ...partial, path: (partial.path ?? n.path).replace(/\/?$/, '/') }
              : { ...n, children: update(n.children) }
          )
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, exportPathTree: update(p.exportPathTree ?? []) } : p
          ),
        }))
      },

      reorderExportPathTree: (projectId, nodeIds) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const tree = p.exportPathTree ?? []
            const ordered = nodeIds
              .map((id) => tree.find((n) => n.id === id))
              .filter(Boolean) as ExportPathNode[]
            return ordered.length ? { ...p, exportPathTree: ordered } : p
          }),
        }))
      },

      addFileNode: (projectId, parentId, node) => {
        const newNode: FileNode = {
          id: crypto.randomUUID(),
          name: node.name.trim() || (node.type === 'folder' ? '새 폴더' : '새 파일'),
          type: node.type,
          children: node.type === 'folder' ? [] : undefined,
        }
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const tree = p.fileTree ?? []
            if (parentId === null) return { ...p, fileTree: [...tree, newNode] }
            const inject = (list: FileNode[]): FileNode[] =>
              list.map((n) =>
                n.id === parentId
                  ? { ...n, children: [...(n.children ?? []), newNode] }
                  : { ...n, children: n.children ? inject(n.children) : undefined }
              )
            return { ...p, fileTree: inject(tree) }
          }),
        }))
        return newNode.id
      },

      removeFileNode: (projectId, nodeId) => {
        const project = get().projects.find((p) => p.id === projectId)
        const node = project?.fileTree ? findFileNodeById(project.fileTree, nodeId) : null
        if (node && isProtectedNode(node)) return false
        const remove = (list: FileNode[]): FileNode[] =>
          list.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: n.children ? remove(n.children) : undefined }))
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, fileTree: remove(p.fileTree ?? []) } : p
          ),
        }))
        return true
      },

      updateFileNode: (projectId, nodeId, partial) => {
        const update = (list: FileNode[]): FileNode[] =>
          list.map((n) =>
            n.id === nodeId ? { ...n, name: partial.name?.trim() ?? n.name } : { ...n, children: n.children ? update(n.children) : undefined }
          )
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, fileTree: update(p.fileTree ?? []) } : p
          ),
        }))
      },

      moveFileNode: (projectId, nodeId, targetParentId, targetIndex) => {
        const project = get().projects.find((p) => p.id === projectId)
        const tree = project?.fileTree ?? []
        const node = findFileNodeById(tree, nodeId)
        if (!node) return false
        if (targetParentId !== null && isAncestorOrSelf(tree, nodeId, targetParentId)) return false
        const { list: treeWithoutNode, node: extracted } = removeFileNodeFromTree(tree, nodeId)
        if (!extracted) return false
        const newTree = insertFileNodeIntoTree(treeWithoutNode, extracted, targetParentId, targetIndex)
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, fileTree: newTree } : p
          ),
        }))
        return true
      },

      addComponent: (projectId, partial) => {
        const component = createComponent(partial)
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const components = [...p.components, component].sort(
              (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
            )
            return { ...p, components }
          }),
        }))
        return component.id
      },

      updateComponent: (projectId, componentId, partial) => {
        const now = Date.now()
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const components = p.components
              .map((c) =>
                c.id === componentId ? { ...c, ...partial, updatedAt: now } : c
              )
              .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
            return { ...p, components }
          }),
        }))
      },

      removeComponent: (projectId, componentId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, components: p.components.filter((c) => c.id !== componentId) }
              : p
          ),
        })),

      getComponent: (projectId, componentId) => {
        const project = get().projects.find((p) => p.id === projectId)
        return project?.components.find((c) => c.id === componentId)
      },

      setComponents: (projectId, components) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, components } : p
          ),
        })),

      addCategory: (projectId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId || p.categories.includes(trimmed)) return p
            return { ...p, categories: [...p.categories, trimmed] }
          }),
        }))
      },

      reorderCategories: (projectId, orderedNames) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const set = new Set(orderedNames)
            const rest = p.categories.filter((c) => !set.has(c))
            return { ...p, categories: [...orderedNames, ...rest] }
          }),
        })),
      removeCategory: (projectId, name) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const next = p.categories.filter((c) => c !== name)
            if (next.length === 0) return p
            const fallback = next[0]
            const components = p.components.map((c) =>
              c.category === name ? { ...c, category: fallback, updatedAt: Date.now() } : c
            )
            return {
              ...p,
              categories: next,
              components: components.sort(
                (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
              ),
            }
          }),
        })),

      addCommonFile: (projectId, item) => {
        const file: CommonFile = { ...item, id: crypto.randomUUID() }
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          const tree = project?.fileTree ?? []
          const folderName = item.type === 'css' ? 'css' : 'js'
          const newTree = ensureFileUnderFolder(tree, folderName, item.name)
          return {
            projects: state.projects.map((p) =>
              p.id === projectId
                ? { ...p, commonFiles: [...p.commonFiles, file], fileTree: newTree }
                : p
            ),
          }
        })
      },
      removeCommonFile: (projectId, fileId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, commonFiles: p.commonFiles.filter((f) => f.id !== fileId) }
              : p
          ),
        })),
      updateCommonFile: (projectId, fileId, partial) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  commonFiles: p.commonFiles.map((f) =>
                    f.id === fileId ? { ...f, ...partial } : f
                  ),
                }
              : p
          ),
        })),

      addCommonAsset: (projectId, item) => {
        const asset: CommonAsset = { ...item, id: crypto.randomUUID() }
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          const tree = project?.fileTree ?? []
          const newTree = item.exportFolderId
            ? ensureFileUnderFolderById(tree, item.exportFolderId, item.name)
            : ensureFileUnderFolder(tree, 'img', item.name)
          return {
            projects: state.projects.map((p) =>
              p.id === projectId
                ? { ...p, commonAssets: [...p.commonAssets, asset], fileTree: newTree }
                : p
            ),
          }
        })
      },
      removeCommonAsset: (projectId, assetId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, commonAssets: p.commonAssets.filter((a) => a.id !== assetId) }
              : p
          ),
        })),
      updateCommonAsset: (projectId, assetId, partial) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  commonAssets: p.commonAssets.map((a) =>
                    a.id === assetId ? { ...a, ...partial } : a
                  ),
                }
              : p
          ),
        })),

      syncCommonResourcesToFileTree: (projectId) => {
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          if (!project) return state
          let tree = project.fileTree ?? []
          for (const f of project.commonFiles) {
            const folderName = f.type === 'css' ? 'css' : 'js'
            tree = ensureFileUnderFolder(tree, folderName, f.name)
          }
          for (const a of project.commonAssets) {
            if (a.exportFolderId) {
              tree = ensureFileUnderFolderById(tree, a.exportFolderId, a.name)
            } else {
              tree = ensureFileUnderFolder(tree, 'img', a.name)
            }
          }
          return {
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, fileTree: tree } : p
            ),
          }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createSafeStorage()),
      /** 프로젝트(컴포넌트·리소스 포함)만 localStorage에 저장. 함수 제외해 직렬화 안정 + 컴포넌트 누락 방지 */
      partialize: (state) => ({ projects: state.projects }),
      merge: (persisted, current) => {
        const raw = persisted != null && typeof persisted === 'object' && 'state' in persisted
          ? (persisted as { state: unknown }).state
          : persisted
        const p = raw as {
          projects?: Project[]
          components?: ComponentItem[]
          categories?: string[]
          commonFiles?: CommonFile[]
          commonAssets?: CommonAsset[]
        }
        const persistedProjects = Array.isArray(p?.projects) ? p.projects : undefined
        let projects: Project[]
        if (Array.isArray(persistedProjects) && persistedProjects.length > 0) {
          projects = persistedProjects.map((proj) => {
            const base = { ...proj } as Project
            const withComponents = Array.isArray(base.components)
              ? { ...base, components: base.components.map((c) => normalizeComponentItem(c)) }
              : { ...base, components: [] }
            const withCategories = Array.isArray(withComponents.categories) && withComponents.categories.length > 0
              ? withComponents
              : { ...withComponents, categories: [...DEFAULT_CATEGORIES] }
            const withCommonFiles = Array.isArray(withCategories.commonFiles) ? withCategories : { ...withCategories, commonFiles: [] }
            const withCommonAssets = Array.isArray(withCommonFiles.commonAssets) ? withCommonFiles : { ...withCommonFiles, commonAssets: [] }
            const withFileTree =
              !withCommonAssets.fileTree || withCommonAssets.fileTree.length === 0
                ? { ...withCommonAssets, fileTree: createDefaultFileTree() }
                : withCommonAssets
            const withBookmark =
              typeof (withFileTree as Project).isBookmarkGuide === 'boolean'
                ? withFileTree
                : { ...withFileTree, isBookmarkGuide: false }
            return withBookmark
          })
          // 기존 KRDS에 krds.min.css 없으면 시드에서 추가 (다른 기기에서 열어도 동일하게)
          projects = projects.map((proj) => {
            if (proj.name !== 'KRDS') return proj
            if (proj.commonFiles.some((f) => f.name === 'krds.min.css')) return proj
            const seed = getKrdsSeedProject()
            const seedFile = seed.commonFiles.find((f) => f.name === 'krds.min.css')
            if (!seedFile) return proj
            const newFile = { ...seedFile, id: crypto.randomUUID() }
            const seedCss = seed.fileTree?.find((n) => n.name === 'css')
            const seedMinNode = seedCss?.children?.find((n) => n.name === 'krds.min.css')
            const newFileTree = proj.fileTree?.map((node) => {
              if (node.name !== 'css' || !node.children) return node
              const idx = node.children.findIndex((c) => c.name === 'krds.css')
              const insertAt = idx >= 0 ? idx + 1 : node.children.length
              const newNode = seedMinNode
                ? { ...seedMinNode, id: crypto.randomUUID() }
                : { id: crypto.randomUUID(), name: 'krds.min.css', type: 'file' as const }
              const children = [...node.children]
              children.splice(insertAt, 0, newNode)
              return { ...node, children }
            }) ?? proj.fileTree
            return { ...proj, commonFiles: [...proj.commonFiles, newFile], fileTree: newFileTree ?? proj.fileTree }
          })
        } else if (Array.isArray(p?.components) || Array.isArray(p?.commonFiles) || Array.isArray(p?.commonAssets)) {
          projects = [
            {
              id: crypto.randomUUID(),
              name: '컴포넌트 가이드',
              components: Array.isArray(p?.components) ? p.components.map((c) => normalizeComponentItem(c)) : [],
              categories: Array.isArray(p?.categories) && p.categories.length > 0 ? p.categories : [...DEFAULT_CATEGORIES],
              commonFiles: Array.isArray(p?.commonFiles) ? p.commonFiles : [],
              commonAssets: Array.isArray(p?.commonAssets) ? p.commonAssets : [],
              exportPathTree: [],
              fileTree: createDefaultFileTree(),
              isBookmarkGuide: false,
            },
          ]
        } else {
          projects = []
        }
        if (!projects.some((proj) => proj.name === 'KRDS')) {
          projects = [...projects, getKrdsSeedProject()]
        }
        return { ...current, projects }
      },
    }
  )
)
