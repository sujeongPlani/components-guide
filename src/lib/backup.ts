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
