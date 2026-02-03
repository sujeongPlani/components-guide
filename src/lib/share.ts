import LZString from 'lz-string'
import type { ComponentItem, CommonFile, CommonAsset } from '@/store/types'

export interface SharePayload {
  components: ComponentItem[]
  v: number
  /** 공유 시 프로젝트 공통 파일 포함 시 프리뷰가 기본 앱과 동일하게 표시됨 */
  commonFiles?: CommonFile[]
  commonAssets?: CommonAsset[]
  projectName?: string
}

const CURRENT_VERSION = 2

/** 브라우저/메신저 등에서 잘리지 않도록 URL 해시 길이 제한. 공통 CSS/JS·에셋 포함을 위해 여유 있게 설정 */
const MAX_ENCODED_LENGTH = 4500

export interface BuildShareUrlOptions {
  commonFiles?: CommonFile[]
  commonAssets?: CommonAsset[]
  projectName?: string
}

function encodedLength(payload: SharePayload): number {
  const json = JSON.stringify(payload)
  return LZString.compressToEncodedURIComponent(json).length
}

export function encodeShareUrl(
  components: ComponentItem[],
  options?: BuildShareUrlOptions
): string {
  const full: SharePayload = {
    components,
    v: CURRENT_VERSION,
    commonFiles: options?.commonFiles,
    commonAssets: options?.commonAssets,
    projectName: options?.projectName,
  }
  let payload: SharePayload = full
  if (encodedLength(full) > MAX_ENCODED_LENGTH) {
    const withoutAssets: SharePayload = { ...full, commonAssets: undefined }
    if (encodedLength(withoutAssets) <= MAX_ENCODED_LENGTH) {
      payload = withoutAssets
    } else {
      payload = { components, v: CURRENT_VERSION, commonFiles: options?.commonFiles, projectName: options?.projectName }
      if (encodedLength(payload) > MAX_ENCODED_LENGTH) {
        payload = { components, v: CURRENT_VERSION }
      }
    }
  }
  const json = JSON.stringify(payload)
  return LZString.compressToEncodedURIComponent(json)
}

export function decodeShareUrl(encoded: string): SharePayload | null {
  if (!encoded || typeof encoded !== 'string') return null
  const normalized = encoded.replace(/ /g, '+')
  for (const input of [normalized, encoded]) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(input)
      if (!json) continue
      const payload = JSON.parse(json) as SharePayload
      if (payload.v === undefined || !Array.isArray(payload.components)) continue
      const v = Number(payload.v)
      if (Number.isNaN(v) || v < 1 || v > CURRENT_VERSION) continue
      return payload
    } catch {
      continue
    }
  }
  return null
}

/** 배포 시 사용할 공개 URL. .env에 VITE_PUBLIC_URL 로 설정하면 공유 링크에 이 주소가 사용됨 */
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL as string | undefined

export function buildShareUrl(
  components: ComponentItem[],
  options?: BuildShareUrlOptions
): string {
  const encoded = encodeShareUrl(components, options)
  let base: string
  if (PUBLIC_URL) {
    base = PUBLIC_URL.replace(/\/$/, '')
  } else if (typeof window !== 'undefined') {
    base = window.location.origin + window.location.pathname.replace(/\/$/, '')
  } else {
    base = ''
  }
  return `${base}#/share/${encoded}`
}
