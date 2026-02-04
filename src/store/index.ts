import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ComponentItem, CommonFile, CommonAsset, Project, ExportPaths, ExportPathNode, FileNode } from './types'
import { DEFAULT_CATEGORIES } from './types'
import { createDefaultFileTree, isProtectedNode, ensureFileUnderFolder, ensureFileUnderFolderById, ensureFolderUnderRoot, findFileInFolder } from '@/lib/fileTree'
import { getKrdsSeedProject, getMxdsSeedProject } from '@/data/krds-seed'
import { fetchSystemTemplateJson } from '@/lib/systemTemplates'

/** 컴포넌트에서 파생된 commonFiles/fileTree 항목(저장 불필요). 제거·동기화 제외용 */
const COMP_FILE_REGEX = /^comp-[a-f0-9-]+\.(html|css|js)$/
function isComponentDerivedFile(name: string): boolean {
  return COMP_FILE_REGEX.test(name)
}

/** fileTree에서 components 폴더 내 comp-* 파일 노드 제거 (마이그레이션용) */
function stripComponentDerivedFromFileTree(nodes: FileNode[]): FileNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder' || !n.children) return n
    if (n.name === 'components') {
      const filtered = n.children.filter((c) => c.type !== 'file' || !isComponentDerivedFile(c.name))
      return { ...n, children: filtered }
    }
    return { ...n, children: stripComponentDerivedFromFileTree(n.children) }
  })
}

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

/** getSystemTemplates()가 매번 새 객체를 반환해 무한 리렌더를 유발하므로, 오버라이드가 바뀔 때만 재계산해 동일 참조 반환 */
let cachedSystemTemplates: Project[] | null = null
let cachedSystemTemplatesKey: string = ''

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

/** 템플릿을 deep copy하여 새 project 생성 (독립 데이터) */
function deepCopyAsProject(source: Project, name: string): Project {
  return {
    ...source,
    id: crypto.randomUUID(),
    name,
    type: 'project',
    createdAt: Date.now(),
    isBookmarkGuide: false,
    components: cloneComponents(source.components),
    commonFiles: cloneCommonFiles(source.commonFiles),
    commonAssets: cloneCommonAssets(source.commonAssets),
    fileTree: source.fileTree?.length ? source.fileTree.map(assignNewIdsToFileNode) : createDefaultFileTree(),
    exportPathTree: source.exportPathTree ?? [],
  }
}

/** project를 deep copy하여 userTemplate으로 저장 */
function deepCopyAsTemplate(source: Project, name: string): Project {
  return {
    ...source,
    id: crypto.randomUUID(),
    name,
    type: 'userTemplate',
    createdAt: Date.now(),
    isBookmarkGuide: false,
    components: cloneComponents(source.components),
    commonFiles: cloneCommonFiles(source.commonFiles),
    commonAssets: cloneCommonAssets(source.commonAssets),
    fileTree: source.fileTree?.length ? source.fileTree.map(assignNewIdsToFileNode) : createDefaultFileTree(),
    exportPathTree: source.exportPathTree ?? [],
  }
}

/** systemTemplate을 deep copy하여 editableTemplate 생성 (id = kind, localStorage 저장용) */
function deepCopyAsEditableTemplate(source: Project, kind: 'krds' | 'mxds'): Project {
  return {
    ...source,
    id: kind,
    name: source.name,
    type: 'editableTemplate',
    createdAt: Date.now(),
    isBookmarkGuide: false,
    components: cloneComponents(source.components),
    commonFiles: cloneCommonFiles(source.commonFiles),
    commonAssets: cloneCommonAssets(source.commonAssets),
    fileTree: source.fileTree?.length ? source.fileTree.map(assignNewIdsToFileNode) : createDefaultFileTree(),
    exportPathTree: source.exportPathTree ?? [],
  }
}

/** CommonFile 복사 (id 재생성) */
function cloneCommonFiles(files: CommonFile[]): CommonFile[] {
  return files.map((f) => ({ ...f, id: crypto.randomUUID() }))
}

/** CommonAsset 복사 (id 재생성). exportFolderId는 folderIdMap으로 새 트리 id에 매핑 */
function cloneCommonAssets(assets: CommonAsset[], folderIdMap?: Map<string, string>): CommonAsset[] {
  return assets.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    exportFolderId: a.exportFolderId && folderIdMap?.get(a.exportFolderId) != null
      ? folderIdMap.get(a.exportFolderId)!
      : a.exportFolderId,
  }))
}

/** KRDS 시드의 commonFiles, commonAssets, fileTree를 새 id로 복제 (공동 리소스 복구용) */
function getKrdsSeedResourcesRestored(): {
  commonFiles: CommonFile[]
  commonAssets: CommonAsset[]
  fileTree: FileNode[]
} {
  const seed = getKrdsSeedProject()
  const fileTree = seed.fileTree?.length ? seed.fileTree.map(assignNewIdsToFileNode) : createDefaultFileTree()
  const commonFiles = cloneCommonFiles(seed.commonFiles)
  const root = seed.fileTree?.[0]
  const seedImg = root?.children?.find((c) => c.name === 'img')
  const seedIcon = seedImg?.children?.find((c) => c.name === 'icon')
  const newRoot = fileTree[0]
  const newImg = newRoot?.children?.find((c) => c.name === 'img')
  const newIcon = newImg?.children?.find((c) => c.name === 'icon')
  const folderIdMap = new Map<string, string>()
  if (seedImg?.id && newImg?.id) folderIdMap.set(seedImg.id, newImg.id)
  if (seedIcon?.id && newIcon?.id) folderIdMap.set(seedIcon.id, newIcon.id)
  const commonAssets = cloneCommonAssets(seed.commonAssets, folderIdMap)
  return { commonFiles, commonAssets, fileTree }
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
    type: 'project',
    createdAt: Date.now(),
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

type SystemTemplateMetaOverrides = {
  krds?: { name?: string; description?: string; coverImage?: string }
  mxds?: { name?: string; description?: string; coverImage?: string }
}

/** data/templates/*.json 에서 로드한 읽기 전용 시스템 템플릿 (persist 안 함) */
export type SystemTemplatesFromJson = { krds?: Project; mxds?: Project }

/** KRDS/MXDS 편집용 복사본. localStorage에 저장, id는 'krds'|'mxds' */
export type EditableTemplates = { krds?: Project; mxds?: Project }

interface GuideStore {
  projects: Project[]
  systemTemplateMetaOverrides?: SystemTemplateMetaOverrides
  /** data/templates/*.json 로드 결과. 있으면 시드 대신 사용 (가상 파일 트리·데이터만, 실제 파일 없음) */
  systemTemplatesFromJson?: SystemTemplatesFromJson
  /** KRDS/MXDS 편집용 복사본. 없으면 systemTemplate 사용, 있으면 이 데이터 사용 (persist) */
  editableTemplates?: EditableTemplates
  /** 앱 초기화 시 data/templates/*.json fetch 후 호출 */
  loadSystemTemplatesFromData: () => Promise<void>
  /** editableTemplate 있으면 반환, 없으면 systemTemplate. projectId는 'krds'|'mxds' 또는 일반 id */
  getProject: (id: string) => Project | undefined
  /** data 폴더 기본 템플릿 (id는 'krds'|'mxds' 고정). 절대 수정하지 않는 시드 */
  getSystemTemplates: () => Project[]
  /** editableTemplate 삭제 후 systemTemplate 기준으로 되돌림 */
  resetEditableTemplate: (kind: 'krds' | 'mxds') => void
  /** KRDS 편집본에 기본 구조(WebContent + 리소스) 저장. 컴포넌트·카테고리·메타는 유지 */
  saveDefaultStructureToKrds: () => void
  /** 기본 템플릿(KRDS/MXDS) 표시용 메타 수정 (이름·설명·커버 이미지) */
  setSystemTemplateMeta: (kind: 'krds' | 'mxds', partial: { name?: string; description?: string; coverImage?: string }) => void
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
  /** components / commonFiles / fileTree 간 정합성 유지(가상 트리만). 실제 파일 생성 없음. 시스템 템플릿은 no-op */
  syncCommonResourcesToFileTree: (projectId: string) => void
  /** 데이터 가져오기: 백업 JSON의 projects를 정규화 후 스토어에 반영 */
  restoreFromBackup: (payload: { projects?: unknown[] }) => void
  /** 템플릿(KRDS/MXDS/userTemplate)을 deep copy하여 새 project 생성 */
  addProjectFromTemplate: (templateKind: 'krds' | 'mxds' | string, name: string, options?: { coverImage?: string; participants?: string[] }) => string
  /** 현재 project를 userTemplate으로 복사 저장. 원본 project 유지 */
  saveProjectAsTemplate: (projectId: string, templateName: string) => string
}

export type { SystemTemplateMetaOverrides }

export const useGuideStore = create<GuideStore>()(
  persist(
    (set, get) => ({
      projects: [],
      systemTemplateMetaOverrides: {} as SystemTemplateMetaOverrides,
      systemTemplatesFromJson: undefined as SystemTemplatesFromJson | undefined,
      editableTemplates: {} as EditableTemplates,

      loadSystemTemplatesFromData: async () => {
        const [krds, mxds] = await Promise.all([
          fetchSystemTemplateJson('krds'),
          fetchSystemTemplateJson('mxds'),
        ])
        set(() => ({
          systemTemplatesFromJson: {
            krds: krds ?? undefined,
            mxds: mxds ?? undefined,
          },
        }))
        cachedSystemTemplatesKey = ''
        cachedSystemTemplates = null
      },

      getSystemTemplates: () => {
        const state = get()
        const metaOverrides = state.systemTemplateMetaOverrides ?? {}
        const fromJson = state.systemTemplatesFromJson
        const key = JSON.stringify({ meta: metaOverrides, fromJson: !!fromJson?.krds, fromJsonMxds: !!fromJson?.mxds })
        if (cachedSystemTemplatesKey === key && cachedSystemTemplates != null) {
          return cachedSystemTemplates
        }
        const krdsBase = fromJson?.krds ?? getKrdsSeedProject()
        const mxdsBase = fromJson?.mxds ?? getMxdsSeedProject()
        const base = [krdsBase, mxdsBase]
        const result = base.map((p, i) => {
          const kind = i === 0 ? 'krds' : 'mxds'
          const meta = metaOverrides[kind as keyof SystemTemplateMetaOverrides]
          const withMeta = meta && Object.keys(meta).length > 0 ? { ...p, ...meta } : p
          return { ...withMeta, id: kind, type: 'systemTemplate' as const }
        })
        cachedSystemTemplatesKey = key
        cachedSystemTemplates = result
        return result
      },

      resetEditableTemplate: (kind) =>
        set((state) => ({
          editableTemplates: { ...state.editableTemplates, [kind]: undefined },
        })),

      saveDefaultStructureToKrds: () =>
        set((state) => {
          const restored = getKrdsSeedResourcesRestored()
          const current = state.editableTemplates?.krds
          const system = get().getSystemTemplates()[0]
          const base = current ?? { ...system, id: 'krds' as const, type: 'editableTemplate' as const }
          const next: Project = {
            ...base,
            id: 'krds',
            type: 'editableTemplate',
            name: base.name ?? 'KRDS',
            description: base.description,
            coverImage: base.coverImage,
            components: Array.isArray(base.components) ? base.components : [],
            categories: Array.isArray(base.categories) && base.categories.length > 0 ? base.categories : [...DEFAULT_CATEGORIES],
            commonFiles: restored.commonFiles,
            commonAssets: restored.commonAssets,
            fileTree: restored.fileTree,
            exportPathTree: base.exportPathTree ?? [],
            isBookmarkGuide: false,
          }
          return {
            ...state,
            editableTemplates: { ...state.editableTemplates, krds: next },
          }
        }),

      setSystemTemplateMeta: (kind: 'krds' | 'mxds', partial: { name?: string; description?: string; coverImage?: string }) =>
        set((state) => ({
          systemTemplateMetaOverrides: {
            ...state.systemTemplateMetaOverrides,
            [kind]: { ...state.systemTemplateMetaOverrides?.[kind], ...partial },
          },
        })),

      getProject: (id) => {
        if (id === 'krds' || id === 'mxds') {
          const editable = get().editableTemplates?.[id]
          if (editable) return editable
          return get().getSystemTemplates().find((p) => p.id === id) ?? undefined
        }
        return get().getSystemTemplates().find((p) => p.id === id) ?? get().projects.find((p) => p.id === id)
      },

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
          type: 'project',
          createdAt: Date.now(),
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

      addProjectFromTemplate: (templateKind, name, options) => {
        const systemTemplates = get().getSystemTemplates()
        const source =
          templateKind === 'krds'
            ? systemTemplates[0]
            : templateKind === 'mxds'
              ? systemTemplates[1]
              : get().projects.find((p) => p.id === templateKind && p.type === 'userTemplate')
        if (!source) return ''
        const project = deepCopyAsProject(source, name.trim() || source.name + ' 복사본')
        if (options?.coverImage) project.coverImage = options.coverImage
        if (options?.participants?.length) project.participants = options.participants.filter(Boolean)
        set((state) => ({ projects: [...state.projects, project] }))
        return project.id
      },

      saveProjectAsTemplate: (projectId, templateName) => {
        const source = get().projects.find((p) => p.id === projectId && p.type === 'project')
        if (!source) return ''
        const template = deepCopyAsTemplate(source, templateName.trim() || source.name + ' 템플릿')
        set((state) => ({ projects: [...state.projects, template] }))
        return template.id
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
          const withType =
            withBookmark.type === 'systemTemplate' || withBookmark.type === 'userTemplate' || withBookmark.type === 'project'
              ? withBookmark
              : { ...withBookmark, type: 'project' as const }
          const withCreatedAt = typeof withType.createdAt === 'number' ? withType : { ...withType, createdAt: Date.now() }
          return withCreatedAt
        })
        set({ projects })
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
        const injectTree = (tree: FileNode[]): FileNode[] => {
          if (parentId === null) return [...tree, newNode]
          return tree.map((n) =>
            n.id === parentId
              ? { ...n, children: [...(n.children ?? []), newNode] }
              : { ...n, children: n.children ? injectTree(n.children) : undefined }
          )
        }
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            let proj = state.editableTemplates?.[projectId]
            if (!proj) {
              const system = get().getSystemTemplates()[projectId === 'krds' ? 0 : 1]
              proj = deepCopyAsEditableTemplate(system, projectId)
            }
            const tree = proj.fileTree ?? []
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, fileTree: injectTree(tree) } },
            }
          })
          return newNode.id
        }
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const tree = p.fileTree ?? []
            return { ...p, fileTree: injectTree(tree) }
          }),
        }))
        return newNode.id
      },

      removeFileNode: (projectId, nodeId) => {
        const project = get().getProject(projectId)
        const tree = project?.fileTree ?? []
        const node = findFileNodeById(tree, nodeId)
        if (!node) return false
        if (isProtectedNode(node)) return false
        const remove = (list: FileNode[]): FileNode[] =>
          list.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: n.children ? remove(n.children) : undefined }))
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, fileTree: remove(proj.fileTree ?? []) } },
            }
          })
          return true
        }
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
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, fileTree: update(proj.fileTree ?? []) } },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, fileTree: update(p.fileTree ?? []) } : p
          ),
        }))
      },

      moveFileNode: (projectId, nodeId, targetParentId, targetIndex) => {
        const project = get().getProject(projectId)
        const tree = project?.fileTree ?? []
        const node = findFileNodeById(tree, nodeId)
        if (!node) return false
        if (targetParentId !== null && isAncestorOrSelf(tree, nodeId, targetParentId)) return false
        const { list: treeWithoutNode, node: extracted } = removeFileNodeFromTree(tree, nodeId)
        if (!extracted) return false
        const newTree = insertFileNodeIntoTree(treeWithoutNode, extracted, targetParentId, targetIndex)
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return { ...state, editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, fileTree: newTree } } }
          })
          return true
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, fileTree: newTree } : p
          ),
        }))
        return true
      },

      addComponent: (projectId, partial) => {
        const component = createComponent(partial)
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            let proj = state.editableTemplates?.[projectId]
            if (!proj) {
              const system = get().getSystemTemplates()[projectId === 'krds' ? 0 : 1]
              proj = deepCopyAsEditableTemplate(system, projectId)
            }
            const components = [...proj.components, component].sort(
              (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
            )
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, components } },
            }
          })
          return component.id
        }
        set((state) => {
          const proj = state.projects.find((p) => p.id === projectId)
          if (!proj) return state
          const components = [...proj.components, component].sort(
            (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
          )
          return {
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, components } : p
            ),
          }
        })
        return component.id
      },

      updateComponent: (projectId, componentId, partial) => {
        const now = Date.now()
        const apply = (p: Project) => {
          const components = p.components
            .map((c) => (c.id === componentId ? { ...c, ...partial, updatedAt: now } : c))
            .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
          return { ...p, components }
        }
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return { ...state, editableTemplates: { ...state.editableTemplates, [projectId]: apply(proj) } }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) => (p.id !== projectId ? p : apply(p))),
        }))
      },

      removeComponent: (projectId, componentId) => {
        const htmlName = `comp-${componentId}.html`
        const cssName = `comp-${componentId}.css`
        const jsName = `comp-${componentId}.js`
        const apply = (proj: Project) => {
          let tree = proj.fileTree ?? []
          for (const fileName of [htmlName, cssName, jsName]) {
            const node = findFileInFolder(tree, 'components', fileName)
            if (node) {
              const remove = (list: FileNode[]): FileNode[] =>
                list.filter((n) => n.id !== node.id).map((n) => ({ ...n, children: n.children ? remove(n.children) : undefined }))
              tree = remove(tree)
            }
          }
          const commonFiles = proj.commonFiles.filter(
            (f) => f.name !== htmlName && f.name !== cssName && f.name !== jsName
          )
          const components = proj.components.filter((c) => c.id !== componentId)
          return { ...proj, components, commonFiles, fileTree: tree }
        }
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return { ...state, editableTemplates: { ...state.editableTemplates, [projectId]: apply(proj) } }
          })
          return
        }
        set((state) => {
          const proj = state.projects.find((p) => p.id === projectId)
          if (!proj) return state
          return {
            projects: state.projects.map((p) => (p.id === projectId ? apply(p) : p)),
          }
        })
      },

      getComponent: (projectId, componentId) => {
        const project = get().getProject(projectId)
        return project?.components.find((c) => c.id === componentId)
      },

      setComponents: (projectId, components) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return { ...state, editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, components } } }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? { ...p, components } : p)),
        }))
      },

      addCategory: (projectId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            let proj = state.editableTemplates?.[projectId]
            if (!proj) {
              const system = get().getSystemTemplates()[projectId === 'krds' ? 0 : 1]
              proj = deepCopyAsEditableTemplate(system, projectId)
            }
            if (proj.categories.includes(trimmed)) return state
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, categories: [...proj.categories, trimmed] } },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId || p.categories.includes(trimmed)) return p
            return { ...p, categories: [...p.categories, trimmed] }
          }),
        }))
      },

      reorderCategories: (projectId, orderedNames) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            const orderSet = new Set(orderedNames)
            const rest = proj.categories.filter((c) => !orderSet.has(c))
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, categories: [...orderedNames, ...rest] } },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const orderSet = new Set(orderedNames)
            const rest = p.categories.filter((c) => !orderSet.has(c))
            return { ...p, categories: [...orderedNames, ...rest] }
          }),
        }))
      },
      removeCategory: (projectId, name) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            const next = proj.categories.filter((c) => c !== name)
            if (next.length === 0) return state
            const fallback = next[0]
            const components = proj.components.map((c) =>
              c.category === name ? { ...c, category: fallback, updatedAt: Date.now() } : c
            )
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: {
                  ...proj,
                  categories: next,
                  components: components.sort(
                    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
                  ),
                },
              },
            }
          })
          return
        }
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
        }))
      },

      addCommonFile: (projectId, item) => {
        const file: CommonFile = { ...item, id: crypto.randomUUID() }
        const folderName = item.type === 'html' ? 'components' : item.type === 'css' ? 'css' : 'js'
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            let proj = state.editableTemplates?.[projectId]
            if (!proj) {
              const system = get().getSystemTemplates()[projectId === 'krds' ? 0 : 1]
              proj = deepCopyAsEditableTemplate(system, projectId)
            }
            let tree = proj.fileTree ?? []
            if (item.type === 'html') tree = ensureFolderUnderRoot(tree, 'components')
            const newTree = ensureFileUnderFolder(tree, folderName, item.name)
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: { ...proj, commonFiles: [...proj.commonFiles, file], fileTree: newTree },
              },
            }
          })
          return
        }
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          let tree = project?.fileTree ?? []
          if (item.type === 'html') tree = ensureFolderUnderRoot(tree, 'components')
          const newTree = ensureFileUnderFolder(tree, folderName, item.name)
          return {
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, commonFiles: [...p.commonFiles, file], fileTree: newTree } : p
            ),
          }
        })
      },
      removeCommonFile: (projectId, fileId) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: { ...proj, commonFiles: proj.commonFiles.filter((f) => f.id !== fileId) },
              },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, commonFiles: p.commonFiles.filter((f) => f.id !== fileId) } : p
          ),
        }))
      },
      updateCommonFile: (projectId, fileId, partial) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: {
                  ...proj,
                  commonFiles: proj.commonFiles.map((f) => (f.id === fileId ? { ...f, ...partial } : f)),
                },
              },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, commonFiles: p.commonFiles.map((f) => (f.id === fileId ? { ...f, ...partial } : f)) }
              : p
          ),
        }))
      },

      addCommonAsset: (projectId, item) => {
        const asset: CommonAsset = { ...item, id: crypto.randomUUID() }
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            let proj = state.editableTemplates?.[projectId]
            if (!proj) {
              const system = get().getSystemTemplates()[projectId === 'krds' ? 0 : 1]
              proj = deepCopyAsEditableTemplate(system, projectId)
            }
            const tree = proj.fileTree ?? []
            const newTree = item.exportFolderId
              ? ensureFileUnderFolderById(tree, item.exportFolderId, item.name)
              : ensureFileUnderFolder(tree, 'img', item.name)
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: { ...proj, commonAssets: [...proj.commonAssets, asset], fileTree: newTree },
              },
            }
          })
          return
        }
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          const tree = project?.fileTree ?? []
          const newTree = item.exportFolderId
            ? ensureFileUnderFolderById(tree, item.exportFolderId, item.name)
            : ensureFileUnderFolder(tree, 'img', item.name)
          return {
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, commonAssets: [...p.commonAssets, asset], fileTree: newTree } : p
            ),
          }
        })
      },
      removeCommonAsset: (projectId, assetId) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: { ...proj, commonAssets: proj.commonAssets.filter((a) => a.id !== assetId) },
              },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, commonAssets: p.commonAssets.filter((a) => a.id !== assetId) } : p
          ),
        }))
      },
      updateCommonAsset: (projectId, assetId, partial) => {
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            return {
              ...state,
              editableTemplates: {
                ...state.editableTemplates,
                [projectId]: {
                  ...proj,
                  commonAssets: proj.commonAssets.map((a) => (a.id === assetId ? { ...a, ...partial } : a)),
                },
              },
            }
          })
          return
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, commonAssets: p.commonAssets.map((a) => (a.id === assetId ? { ...a, ...partial } : a)) }
              : p
          ),
        }))
      },

      syncCommonResourcesToFileTree: (projectId) => {
        const project = get().getProject(projectId)
        if (!project) return
        if (projectId === 'krds' || projectId === 'mxds') {
          set((state) => {
            const proj = state.editableTemplates?.[projectId]
            if (!proj) return state
            let tree = proj.fileTree ?? []
            const syncFiles = proj.commonFiles.filter((f) => !isComponentDerivedFile(f.name))
            const hasHtml = syncFiles.some((f) => f.type === 'html')
            if (hasHtml) tree = ensureFolderUnderRoot(tree, 'components')
            for (const f of syncFiles) {
              const folderName = f.type === 'html' ? 'components' : f.type === 'css' ? 'css' : 'js'
              tree = ensureFileUnderFolder(tree, folderName, f.name)
            }
            for (const a of proj.commonAssets) {
              if (a.exportFolderId) {
                tree = ensureFileUnderFolderById(tree, a.exportFolderId, a.name)
              } else {
                tree = ensureFileUnderFolder(tree, 'img', a.name)
              }
            }
            return {
              ...state,
              editableTemplates: { ...state.editableTemplates, [projectId]: { ...proj, fileTree: tree } },
            }
          })
          return
        }
        set((state) => {
          const proj = state.projects.find((p) => p.id === projectId)
          if (!proj) return state
          let tree = proj.fileTree ?? []
          const syncFiles = proj.commonFiles.filter((f) => !isComponentDerivedFile(f.name))
          const hasHtml = syncFiles.some((f) => f.type === 'html')
          if (hasHtml) tree = ensureFolderUnderRoot(tree, 'components')
          for (const f of syncFiles) {
            const folderName = f.type === 'html' ? 'components' : f.type === 'css' ? 'css' : 'js'
            tree = ensureFileUnderFolder(tree, folderName, f.name)
          }
          for (const a of proj.commonAssets) {
            if (a.exportFolderId) {
              tree = ensureFileUnderFolderById(tree, a.exportFolderId, a.name)
            } else {
              tree = ensureFileUnderFolder(tree, 'img', a.name)
            }
          }
          return {
            projects: state.projects.map((p) => (p.id === projectId ? { ...p, fileTree: tree } : p)),
          }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createSafeStorage()),
      /** 프로젝트(컴포넌트·리소스 포함)만 localStorage에 저장. 함수 제외해 직렬화 안정 + 컴포넌트 누락 방지 */
      partialize: (state) => ({
        projects: state.projects,
        systemTemplateMetaOverrides: state.systemTemplateMetaOverrides,
        editableTemplates: state.editableTemplates,
      }),
      merge: (persisted, current) => {
        const raw = persisted != null && typeof persisted === 'object' && 'state' in persisted
          ? (persisted as { state: unknown }).state
          : persisted
        const p = raw as {
          projects?: Project[]
          systemTemplateMetaOverrides?: SystemTemplateMetaOverrides
          editableTemplates?: EditableTemplates
          components?: ComponentItem[]
          categories?: string[]
          commonFiles?: CommonFile[]
          commonAssets?: CommonAsset[]
        }
        const persistedProjects = Array.isArray(p?.projects) ? p.projects : undefined
        let projects: Project[]
        if (Array.isArray(persistedProjects) && persistedProjects.length > 0) {
          const mapped = persistedProjects.map((proj): Project | null => {
            const base = { ...proj } as Project
            const withComponents = Array.isArray(base.components)
              ? { ...base, components: base.components.map((c) => normalizeComponentItem(c)) }
              : { ...base, components: [] }
            const withCategories = Array.isArray(withComponents.categories) && withComponents.categories.length > 0
              ? withComponents
              : { ...withComponents, categories: [...DEFAULT_CATEGORIES] }
            const withCommonFiles = Array.isArray(withCategories.commonFiles)
              ? { ...withCategories, commonFiles: withCategories.commonFiles.filter((f: CommonFile) => !isComponentDerivedFile(f.name)) }
              : { ...withCategories, commonFiles: [] }
            const withCommonAssets = Array.isArray(withCommonFiles.commonAssets) ? withCommonFiles : { ...withCommonFiles, commonAssets: [] }
            const withFileTree =
              !withCommonAssets.fileTree || withCommonAssets.fileTree.length === 0
                ? { ...withCommonAssets, fileTree: createDefaultFileTree() }
                : { ...withCommonAssets, fileTree: stripComponentDerivedFromFileTree(withCommonAssets.fileTree) }
            const withBookmark =
              typeof (withFileTree as Project).isBookmarkGuide === 'boolean'
                ? withFileTree
                : { ...withFileTree, isBookmarkGuide: false }
            const withType =
              withBookmark.type === 'systemTemplate' || withBookmark.type === 'editableTemplate' || withBookmark.type === 'userTemplate' || withBookmark.type === 'project'
                ? withBookmark
                : { ...withBookmark, type: 'project' as const }
            const withCreatedAt = typeof withType.createdAt === 'number' ? withType : { ...withType, createdAt: Date.now() }
            // 마이그레이션: type 없이 저장된 KRDS(예전 시드 복사본)는 제거. 시드는 getSystemTemplates에서 로드
            if (withCreatedAt.name === 'KRDS' && typeof (proj as Project).type === 'undefined') return null
            return withCreatedAt
          })
          projects = mapped.filter((p): p is Project => p != null)
          // 기존 KRDS 이름의 project(사용자 복사본)에 krds.min.css 없으면 시드에서 추가
          projects = projects.map((proj) => {
            if (proj.name !== 'KRDS') return proj
            if (proj.commonFiles.some((f) => f.name === 'krds.min.css')) return proj
            const seed = getKrdsSeedProject()
            const seedFile = seed.commonFiles.find((f) => f.name === 'krds.min.css')
            if (!seedFile) return proj
            const newFile = { ...seedFile, id: crypto.randomUUID() }
            const root = seed.fileTree?.[0]?.type === 'folder' ? seed.fileTree[0] : null
            const seedCss = root?.children?.find((n) => n.name === 'css')
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
              type: 'project' as const,
              createdAt: Date.now(),
              components: Array.isArray(p?.components) ? p.components.map((c) => normalizeComponentItem(c)) : [],
              categories: Array.isArray(p?.categories) && p.categories.length > 0 ? p.categories : [...DEFAULT_CATEGORIES],
              commonFiles: Array.isArray(p?.commonFiles) ? p.commonFiles.filter((f: CommonFile) => !isComponentDerivedFile(f.name)) : [],
              commonAssets: Array.isArray(p?.commonAssets) ? p.commonAssets : [],
              exportPathTree: [],
              fileTree: createDefaultFileTree(),
              isBookmarkGuide: false,
            },
          ]
        } else {
          projects = []
        }
        const systemTemplateMetaOverrides =
          p?.systemTemplateMetaOverrides && typeof p.systemTemplateMetaOverrides === 'object'
            ? p.systemTemplateMetaOverrides
            : current.systemTemplateMetaOverrides ?? {}
        const editableTemplatesRaw = p?.editableTemplates && typeof p.editableTemplates === 'object' ? p.editableTemplates : {}
        const normalizeEditable = (proj: Project, kind: 'krds' | 'mxds'): Project => {
          const withComponents = Array.isArray(proj.components)
            ? { ...proj, components: proj.components.map((c) => normalizeComponentItem(c)) }
            : { ...proj, components: [] }
          const withCategories =
            Array.isArray(withComponents.categories) && withComponents.categories.length > 0
              ? withComponents
              : { ...withComponents, categories: [...DEFAULT_CATEGORIES] }
          let withCommonFiles = Array.isArray(withCategories.commonFiles)
            ? { ...withCategories, commonFiles: withCategories.commonFiles.filter((f: CommonFile) => !isComponentDerivedFile(f.name)) }
            : { ...withCategories, commonFiles: [] }
          let withCommonAssets = Array.isArray(withCommonFiles.commonAssets) ? withCommonFiles : { ...withCommonFiles, commonAssets: [] }
          let fileTree: FileNode[]
          if (kind === 'krds') {
            // KRDS: 파일 구조는 항상 기본(WebContent/css, js, img, index.html), 리소스를 그 구조에 맞게 넣음
            const restored = getKrdsSeedResourcesRestored()
            if (withCommonFiles.commonFiles.length === 0) {
              withCommonFiles = { ...withCommonFiles, commonFiles: restored.commonFiles }
              withCommonAssets = { ...withCommonAssets, commonAssets: restored.commonAssets }
              fileTree = restored.fileTree
            } else {
              fileTree = restored.fileTree
              const root = fileTree[0]
              const newImg = root?.children?.find((c) => c.name === 'img')
              const newImgId = newImg?.id ?? ''
              withCommonAssets = {
                ...withCommonAssets,
                commonAssets: withCommonAssets.commonAssets.map((a) => ({
                  ...a,
                  exportFolderId: newImgId,
                })),
              }
              for (const f of withCommonFiles.commonFiles) {
                const folderName = f.type === 'css' ? 'css' : f.type === 'js' ? 'js' : 'css'
                fileTree = ensureFileUnderFolder(fileTree, folderName, f.name)
              }
              for (const a of withCommonAssets.commonAssets) {
                if (a.exportFolderId) fileTree = ensureFileUnderFolderById(fileTree, a.exportFolderId, a.name)
              }
            }
          } else {
            fileTree =
              withCommonAssets.fileTree?.length
                ? stripComponentDerivedFromFileTree(withCommonAssets.fileTree)
                : createDefaultFileTree()
          }
          return {
            ...withCommonAssets,
            commonFiles: withCommonFiles.commonFiles,
            commonAssets: withCommonAssets.commonAssets,
            fileTree,
            id: kind,
            type: 'editableTemplate' as const,
          }
        }
        const editableTemplates: EditableTemplates = {}
        if (editableTemplatesRaw.krds) editableTemplates.krds = normalizeEditable(editableTemplatesRaw.krds as Project, 'krds')
        if (editableTemplatesRaw.mxds) editableTemplates.mxds = normalizeEditable(editableTemplatesRaw.mxds as Project, 'mxds')
        return { ...current, projects, systemTemplateMetaOverrides, editableTemplates }
      },
    }
  )
)
