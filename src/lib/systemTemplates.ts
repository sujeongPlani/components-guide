/**
 * 시스템 템플릿(KRDS/MXDS) 읽기 전용 데이터 로더.
 * data/templates/*.json 에서 로드하며, 없으면 시드(getKrdsSeedProject 등)로 폴백.
 * 실제 파일 생성 없이 가상 파일 트리(fileTree)와 데이터 구조로만 관리.
 */
import type { Project, FileNode, CommonFile, CommonAsset, ComponentItem } from '@/store/types'
import { DEFAULT_CATEGORIES } from '@/store/types'
import { createDefaultFileTree } from '@/lib/fileTree'

function uuid() {
  return crypto.randomUUID()
}

function ensureIds<T extends { id?: string }>(items: T[]): T[] {
  return items.map((item) => (item.id ? item : { ...item, id: uuid() }))
}

function ensureFileNodeIds(nodes: FileNode[]): FileNode[] {
  return nodes.map((n) => ({
    ...n,
    id: n.id ?? uuid(),
    children: n.children?.length ? ensureFileNodeIds(n.children) : undefined,
  }))
}

/** JSON 파싱 결과를 Project 형태로 정규화 (id 부여, 타입 보장) */
export function normalizeTemplateFromJson(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : uuid()
  const name = typeof o.name === 'string' ? o.name : 'Template'
  const components: ComponentItem[] = Array.isArray(o.components)
    ? ensureIds((o.components as ComponentItem[]).map((c) => ({ ...c, createdAt: Number(c.createdAt) || 0, updatedAt: Number(c.updatedAt) || 0 })))
    : []
  const categories: string[] = Array.isArray(o.categories) && o.categories.length > 0
    ? (o.categories as string[])
    : [...DEFAULT_CATEGORIES]
  const commonFiles: CommonFile[] = Array.isArray(o.commonFiles)
    ? ensureIds((o.commonFiles as CommonFile[]).map((f) => ({ ...f, type: f.type || 'css' })))
    : []
  const commonAssets: CommonAsset[] = Array.isArray(o.commonAssets) ? ensureIds(o.commonAssets as CommonAsset[]) : []
  const fileTree: FileNode[] = Array.isArray(o.fileTree) && o.fileTree.length > 0
    ? ensureFileNodeIds(o.fileTree as FileNode[])
    : createDefaultFileTree()

  return {
    id,
    name,
    description: typeof o.description === 'string' ? o.description : undefined,
    type: 'systemTemplate',
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
    coverImage: typeof o.coverImage === 'string' ? o.coverImage : undefined,
    components,
    categories,
    commonFiles,
    commonAssets,
    fileTree,
    exportPathTree: [],
    isBookmarkGuide: false,
  }
}

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/'

/** data/templates/{kind}.json 을 fetch. 성공 시 정규화된 Project, 실패 시 null */
export async function fetchSystemTemplateJson(kind: 'krds' | 'mxds'): Promise<Project | null> {
  try {
    const res = await fetch(`${BASE}data/templates/${kind}.json`, { cache: 'no-store' })
    if (!res.ok) return null
    const raw = await res.json()
    return normalizeTemplateFromJson(raw)
  } catch {
    return null
  }
}
