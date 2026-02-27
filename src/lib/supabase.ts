/**
 * Supabase 연동 (선택)
 * .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 있으면 DB와 동기화됩니다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Project, ComponentItem, CommonFile, CommonAsset, FileNode } from '@/store/types'
import { DEFAULT_CATEGORIES } from '@/store/types'

// 공백·BOM·줄바꿈 제거. 키는 ASCII만 사용 (헤더 "non ISO-8859-1" 오류 방지)
const _rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const url = _rawUrl?.replace(/\s|\uFEFF/g, '') || undefined
const _rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
const key = _rawKey ? _rawKey.replace(/[\s\uFEFF]/g, '').replace(/[^\x20-\x7E]/g, '') : undefined

export const isSupabaseConfigured = Boolean(url && key)

let _client: SupabaseClient | null = null

/** 항상 최신 데이터를 가져오도록 캐시 비활성화 (다른 브라우저/탭에서 저장한 내용이 바로 보이도록) */
function fetchNoCache(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' })
}

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null
  if (!_client)
    _client = createClient(url, key, {
      global: { fetch: fetchNoCache },
    })
  return _client
}

/** DB의 projects 테이블 한 행 타입 */
interface ProjectRow {
  id: string
  name: string
  data: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

/** 프로젝트 전체를 JSON으로 저장할 때 data에 넣을 필드 (id, name 제외). components 등 필수 필드를 명시적으로 포함 */
function projectToData(p: Project): Record<string, unknown> {
  return {
    type: p.type,
    components: Array.isArray(p.components) ? p.components : [],
    categories: Array.isArray(p.categories) ? p.categories : [],
    commonFiles: Array.isArray(p.commonFiles) ? p.commonFiles : [],
    commonAssets: Array.isArray(p.commonAssets) ? p.commonAssets : [],
    fileTree: Array.isArray(p.fileTree) ? p.fileTree : undefined,
    createdAt: p.createdAt,
    coverImage: p.coverImage,
    description: p.description,
    participants: p.participants,
    isBookmarkGuide: p.isBookmarkGuide,
    exportPaths: p.exportPaths,
    exportPathTree: p.exportPathTree,
  }
}

/** DB에서 온 컴포넌트(raw)를 정규화 (created_at/createdAt 둘 다 허용) */
function normalizeComponent(raw: Record<string, unknown>): ComponentItem {
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : typeof (raw as { created_at?: number }).created_at === 'number' ? (raw as { created_at: number }).created_at : Date.now()
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : typeof (raw as { updated_at?: number }).updated_at === 'number' ? (raw as { updated_at: number }).updated_at : Date.now()
  return {
    id: String(raw.id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : '',
    category: typeof raw.category === 'string' ? raw.category : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    html: typeof raw.html === 'string' ? raw.html : '',
    css: typeof raw.css === 'string' ? raw.css : '',
    js: typeof raw.js === 'string' ? raw.js : '',
    createdAt,
    updatedAt,
  }
}

/** DB 행 → Project (data 문자열이면 파싱, components/categories/commonFiles/commonAssets 정규화) */
function rowToProject(row: ProjectRow): Project {
  let data = row.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as Record<string, unknown>
    } catch {
      data = {}
    }
  }
  const d = (data ?? {}) as Record<string, unknown>
  const componentsRaw = Array.isArray(d.components) ? d.components : []
  console.log('[Supabase] 불러옴:', row.name, '| data 안 컴포넌트:', componentsRaw.length, '개', '| data 키:', Object.keys(d))
  const components: ComponentItem[] = componentsRaw.map((c) => normalizeComponent(typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {}))
  const categories = Array.isArray(d.categories) && d.categories.length > 0 ? (d.categories as string[]) : []
  const commonFiles = Array.isArray(d.commonFiles) ? (d.commonFiles as CommonFile[]) : []
  const commonAssets = Array.isArray(d.commonAssets) ? (d.commonAssets as CommonAsset[]) : []
  const fileTree = Array.isArray(d.fileTree) && d.fileTree.length > 0 ? (d.fileTree as FileNode[]) : undefined

  return {
    id: row.id,
    name: row.name,
    type: (d.type as Project['type']) ?? 'project',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : undefined,
    coverImage: typeof d.coverImage === 'string' ? d.coverImage : undefined,
    description: typeof d.description === 'string' ? d.description : undefined,
    participants: Array.isArray(d.participants) ? (d.participants as string[]) : undefined,
    isBookmarkGuide: typeof d.isBookmarkGuide === 'boolean' ? d.isBookmarkGuide : undefined,
    exportPaths: d.exportPaths && typeof d.exportPaths === 'object' ? (d.exportPaths as Project['exportPaths']) : undefined,
    exportPathTree: Array.isArray(d.exportPathTree) ? (d.exportPathTree as Project['exportPathTree']) : undefined,
    fileTree,
    components,
    categories: categories.length > 0 ? categories : [...DEFAULT_CATEGORIES],
    commonFiles,
    commonAssets,
  }
}

/** KRDS/MXDS 편집본을 projects 테이블에 저장할 때 사용하는 고정 UUID (일반 프로젝트와 구분) */
export const EDITABLE_TEMPLATE_ROW_IDS = {
  krds: 'aaaaaaaa-0000-4000-8000-000000000001',
  mxds: 'aaaaaaaa-0000-4000-8000-000000000002',
} as const

/** Supabase에서 프로젝트 목록 조회 (KRDS/MXDS 편집본 행은 제외) */
export async function fetchProjectsFromSupabase(): Promise<Project[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('projects')
    .select('id, name, data')
    .order('updated_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as ProjectRow[]
  return rows
    .filter((row) => row.id !== EDITABLE_TEMPLATE_ROW_IDS.krds && row.id !== EDITABLE_TEMPLATE_ROW_IDS.mxds)
    .map((row) => rowToProject(row))
}

/** KRDS/MXDS 편집본만 조회 (store의 editableTemplates용) */
export async function fetchEditableTemplatesFromSupabase(): Promise<{ krds?: Project; mxds?: Project }> {
  const sb = getSupabase()
  if (!sb) return {}

  const { data, error } = await sb
    .from('projects')
    .select('id, name, data')
    .in('id', [EDITABLE_TEMPLATE_ROW_IDS.krds, EDITABLE_TEMPLATE_ROW_IDS.mxds])

  if (error) throw error
  const rows = (data ?? []) as ProjectRow[]
  const result: { krds?: Project; mxds?: Project } = {}
  for (const row of rows) {
    const project = rowToProject(row)
    if (row.id === EDITABLE_TEMPLATE_ROW_IDS.krds) {
      result.krds = { ...project, id: 'krds', type: 'editableTemplate' }
    } else if (row.id === EDITABLE_TEMPLATE_ROW_IDS.mxds) {
      result.mxds = { ...project, id: 'mxds', type: 'editableTemplate' }
    }
  }
  return result
}

/** 프로젝트 한 개 저장(있으면 덮어쓰기) */
export async function saveProjectToSupabase(project: Project): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const payload = projectToData(project)
  const compCount = Array.isArray(payload.components) ? (payload.components as unknown[]).length : 0
  console.log('[Supabase] 저장 시도:', project.name, '| 컴포넌트', compCount, '개', '| data 키:', Object.keys(payload))

  const { error } = await sb.from('projects').upsert(
    {
      id: project.id,
      name: project.name,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) {
    console.error('[Supabase] upsert 응답 오류:', error.message, '| code:', error.code, '| details:', error.details)
    throw error
  }
}

/** 프로젝트 한 개 삭제 */
export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

/** KRDS/MXDS 편집본 한 개 저장 (projects 테이블에 고정 UUID로 upsert) */
export async function saveEditableTemplateToSupabase(kind: 'krds' | 'mxds', project: Project): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const rowId = EDITABLE_TEMPLATE_ROW_IDS[kind]
  const payload = projectToData(project)
  const compCount = Array.isArray(payload.components) ? (payload.components as unknown[]).length : 0
  console.log('[Supabase] 편집 템플릿 저장:', project.name, '| 컴포넌트', compCount, '개')

  const { error } = await sb.from('projects').upsert(
    {
      id: rowId,
      name: project.name ?? (kind === 'krds' ? 'KRDS' : 'MXDS'),
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) {
    console.error('[Supabase] 편집 템플릿 upsert 오류:', error.message, '| code:', error.code)
    throw error
  }
}

/** KRDS/MXDS 편집본 한 개 DB에서 삭제 (초기화 시 사용) */
export async function deleteEditableTemplateFromSupabase(kind: 'krds' | 'mxds'): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const rowId = EDITABLE_TEMPLATE_ROW_IDS[kind]
  const { error } = await sb.from('projects').delete().eq('id', rowId)
  if (error) throw error
}

// --- template_components 테이블 (템플릿 전용 컴포넌트) ---

/** template_components 테이블 한 행 타입 */
interface TemplateComponentRow {
  id: string
  template_kind: string
  name: string
  category: string
  description: string
  html: string
  css: string
  js: string
  sort_order: number
  created_at?: string
  updated_at?: string
}

/** DB 행 → ComponentItem (created_at/updated_at → ms) */
function templateComponentRowToItem(row: TemplateComponentRow): ComponentItem {
  const createdAt =
    typeof (row as { created_at?: string }).created_at === 'string'
      ? new Date((row as { created_at: string }).created_at).getTime()
      : Date.now()
  const updatedAt =
    typeof (row as { updated_at?: string }).updated_at === 'string'
      ? new Date((row as { updated_at: string }).updated_at).getTime()
      : Date.now()
  return {
    id: String(row.id),
    name: row.name ?? '',
    category: row.category ?? '',
    description: row.description ?? '',
    html: row.html ?? '',
    css: row.css ?? '',
    js: row.js ?? '',
    createdAt,
    updatedAt,
  }
}

/** 템플릿(KRDS/MXDS) 전용 컴포넌트 목록 조회 */
export async function fetchTemplateComponentsFromSupabase(
  kind: 'krds' | 'mxds'
): Promise<ComponentItem[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('template_components')
    .select('id, template_kind, name, category, description, html, css, js, sort_order, created_at, updated_at')
    .eq('template_kind', kind)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if ((error as { code?: string }).code === '42P01') {
      console.warn('[Supabase] template_components 테이블이 없습니다. docs/sql/template_components.sql 실행 후 다시 시도하세요.')
      return []
    }
    throw error
  }
  const rows = (data ?? []) as TemplateComponentRow[]
  return rows.map(templateComponentRowToItem)
}

/** 템플릿(KRDS/MXDS) 전용 컴포넌트 목록 전체 저장 (해당 kind 기존 행 삭제 후 일괄 삽입) */
export async function saveTemplateComponentsToSupabase(
  kind: 'krds' | 'mxds',
  components: ComponentItem[]
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error: deleteError } = await sb.from('template_components').delete().eq('template_kind', kind)
  if (deleteError) {
    if ((deleteError as { code?: string }).code === '42P01') {
      console.warn('[Supabase] template_components 테이블이 없습니다. docs/sql/template_components.sql 실행 후 다시 시도하세요.')
      return
    }
    throw deleteError
  }

  if (components.length === 0) return

  const rows = components.map((c, i) => ({
    id: c.id,
    template_kind: kind,
    name: c.name ?? '',
    category: c.category ?? '',
    description: c.description ?? '',
    html: c.html ?? '',
    css: c.css ?? '',
    js: c.js ?? '',
    sort_order: i,
    updated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await sb.from('template_components').insert(rows)
  if (insertError) throw insertError
  console.log('[Supabase] template_components 저장:', kind, components.length, '개')
}

/** 템플릿 초기화 시 해당 kind의 template_components 행 삭제 */
export async function deleteTemplateComponentsFromSupabase(kind: 'krds' | 'mxds'): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('template_components').delete().eq('template_kind', kind)
  if (error && (error as { code?: string }).code !== '42P01') throw error
}
