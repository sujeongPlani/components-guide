/**
 * Supabase 연동 (선택)
 * .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 있으면 DB와 동기화됩니다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Project } from '@/store/types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null
  if (!_client) _client = createClient(url, key)
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

/** 프로젝트 전체를 JSON으로 저장할 때 data에 넣을 필드 (id, name 제외) */
function projectToData(p: Project): Record<string, unknown> {
  const { id, name, ...rest } = p
  return rest as Record<string, unknown>
}

/** DB 행 + name → Project */
function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    ...(row.data as Omit<Project, 'id' | 'name'>),
  } as Project
}

/** Supabase에서 프로젝트 목록 조회 (type 'project'만 저장하므로 그대로 반환) */
export async function fetchProjectsFromSupabase(): Promise<Project[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('projects')
    .select('id, name, data')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => rowToProject(row as ProjectRow))
}

/** 프로젝트 한 개 저장(있으면 덮어쓰기) */
export async function saveProjectToSupabase(project: Project): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('projects').upsert(
    {
      id: project.id,
      name: project.name,
      data: projectToData(project),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw error
}

/** 프로젝트 한 개 삭제 */
export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('projects').delete().eq('id', projectId)
  if (error) throw error
}
