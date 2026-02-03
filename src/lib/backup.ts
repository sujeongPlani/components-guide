import type { Project } from '@/store/types'

export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  exportedAt: string
  projects: Project[]
}

/** 현재 스토어의 projects를 JSON으로 내보내서 파일 다운로드 */
export function downloadBackup(projects: Project[]): void {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `live-component-guide-backup-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 백업 JSON 문자열 파싱. 형식이 맞으면 payload 반환, 아니면 null */
export function parseBackupFile(json: string): BackupPayload | null {
  try {
    const data = JSON.parse(json) as unknown
    if (data == null || typeof data !== 'object') return null
    const obj = data as Record<string, unknown>
    if (!Array.isArray(obj.projects)) return null
    return {
      version: typeof obj.version === 'number' ? obj.version : BACKUP_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      projects: obj.projects,
    }
  } catch {
    return null
  }
}
