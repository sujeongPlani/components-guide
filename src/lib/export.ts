import JSZip from 'jszip'
import type { ComponentItem, CommonFile, CommonAsset, ExportPathNode, FileNode } from '@/store/types'
import { resolveCssPath, resolveJsPath, resolveImgPath, resolveFolderPath, resolveIndexHtmlPath } from '@/lib/fileTree'

const GUIDE_LAYOUT_CSS = `
/* ========== Guide Layout ========== */
.guide-wrapper { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.guide-section { margin-bottom: 2rem; }
.guide-section-title { font-size: 1.25rem; margin-bottom: 1rem; font-weight: 600; }
.guide-component { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; }
.guide-component-desc { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
.guide-component-preview { min-height: 2rem; }
`

/**
 * 카테고리별로 정리된 단일 CSS 문자열 생성
 */
export function buildMergedCss(components: ComponentItem[]): string {
  const byCategory = new Map<string, ComponentItem[]>()
  for (const c of components) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category)!.push(c)
  }
  const lines: string[] = [GUIDE_LAYOUT_CSS]
  for (const [category, items] of byCategory) {
    lines.push(`\n/* ========== ${category} ========== */\n`)
    for (const item of items) {
      lines.push(`/* --- ${item.name} --- */\n`)
      lines.push(item.css.trim() || '/* (no styles) */')
      lines.push('\n')
    }
  }
  return lines.join('').trim()
}

/**
 * 카테고리별로 정리된 단일 JS 문자열 생성
 */
export function buildMergedJs(components: ComponentItem[]): string {
  const byCategory = new Map<string, ComponentItem[]>()
  for (const c of components) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category)!.push(c)
  }
  const lines: string[] = []
  for (const [category, items] of byCategory) {
    lines.push(`\n/* ========== ${category} ========== */\n`)
    for (const item of items) {
      lines.push(`/* --- ${item.name} --- */\n`)
      lines.push(item.js.trim() || '/* (no script) */')
      lines.push('\n')
    }
  }
  return lines.join('').trim()
}

const DEFAULT_CSS_PATH = 'assets/css/component.css'
const DEFAULT_JS_PATH = 'assets/js/component.js'
const DEFAULT_IMAGES_PATH = 'assets/images/'

function flattenPathTree(nodes: ExportPathNode[]): Map<string, string> {
  const map = new Map<string, string>()
  const walk = (list: ExportPathNode[]) => {
    list.forEach((n) => {
      map.set(n.id, n.path.replace(/\/?$/, '/'))
      walk(n.children)
    })
  }
  walk(nodes)
  return map
}

function getExtFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^/]+)\/([^;]+)/)
  if (!m) return '.bin'
  const subtype = m[2].toLowerCase()
  if (subtype === 'png') return '.png'
  if (subtype === 'jpeg' || subtype === 'jpg') return '.jpg'
  if (subtype === 'gif') return '.gif'
  if (subtype === 'webp') return '.webp'
  if (subtype === 'svg+xml') return '.svg'
  return '.' + subtype.replace(/[^a-z0-9]/g, '')
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'asset'
}

/**
 * 리소스별 내보내기 URL 맵 생성 (이름 -> 경로)
 * fileTree가 있으면 파일 트리 기준 경로 사용, 없으면 exportPaths/exportPathTree 사용
 */
export function buildAssetUrlMap(
  commonAssets: CommonAsset[],
  options: { imagesBase?: string; exportPathTree?: ExportPathNode[]; fileTree?: FileNode[] }
): Record<string, string> {
  const map: Record<string, string> = {}
  const fileTree = options.fileTree
  const useFileTree = fileTree?.length

  commonAssets.forEach((a) => {
    let dir: string
    if (useFileTree) {
      dir = a.exportFolderId ? resolveFolderPath(fileTree!, a.exportFolderId) : resolveImgPath(fileTree!)
    } else {
      const folderById = options.exportPathTree?.length ? flattenPathTree(options.exportPathTree) : new Map<string, string>()
      dir = (options.imagesBase?.trim() || DEFAULT_IMAGES_PATH).replace(/\/?$/, '/')
      if (a.exportFolderId && folderById.has(a.exportFolderId)) dir = folderById.get(a.exportFolderId)!
    }
    const ext = getExtFromDataUrl(a.dataUrl)
    const filename = sanitizeFileName(a.name) + ext
    map[a.name] = dir + filename
  })
  return map
}

/** HTML에서 data-asset="NAME"을 src="URL"로 치환 */
function replaceAssetRefsInHtml(html: string, assetUrlMap: Record<string, string>): string {
  let out = html
  Object.entries(assetUrlMap).forEach(([name, url]) => {
    out = out.replace(
      new RegExp(`data-asset=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi'),
      `src="${url.replace(/"/g, '&quot;')}"`
    )
  })
  return out
}

/** JS에서 getAsset('name') / getAsset("name")을 URL 문자열로 치환 */
function replaceAssetRefsInJs(js: string, assetUrlMap: Record<string, string>): string {
  let out = js
  Object.entries(assetUrlMap).forEach(([name, url]) => {
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    out = out.replace(
      new RegExp(`getAsset\\s*\\(\\s*['"]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*\\)`, 'g'),
      esc(`'${url}'`)
    )
  })
  return out
}

export interface BuildIndexHtmlOptions {
  cssPath?: string
  jsPath?: string
  /** 리소스 이름 -> 내보내기 URL (있으면 HTML에서 data-asset 치환) */
  assetUrlMap?: Record<string, string>
}

/**
 * 다운로드용 index.html (가이드용 마크업, CSS/JS는 외부 파일 링크)
 */
export function buildIndexHtml(
  components: ComponentItem[],
  options?: BuildIndexHtmlOptions
): string {
  const cssPath = options?.cssPath?.trim() || DEFAULT_CSS_PATH
  const jsPath = options?.jsPath?.trim() || DEFAULT_JS_PATH
  const assetUrlMap = options?.assetUrlMap ?? {}
  const byCategory = new Map<string, ComponentItem[]>()
  for (const c of components) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category)!.push(c)
  }
  const sections: string[] = [
    `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>컴포넌트 가이드</title>
  <link rel="stylesheet" href="${escapeAttr(cssPath)}" />
</head>
<body>
  <div class="guide-wrapper">`,
  ]
  for (const [category, items] of byCategory) {
    sections.push(`\n    <section class="guide-section" data-category="${escapeAttr(category)}">`)
    sections.push(`\n      <h2 class="guide-section-title">${category}</h2>`)
    for (const item of items) {
      const html = Object.keys(assetUrlMap).length ? replaceAssetRefsInHtml(item.html, assetUrlMap) : item.html
      sections.push(`\n      <div class="guide-component" data-id="${item.id}" data-name="${item.name}">`)
      if (item.description) {
        sections.push(`\n        <p class="guide-component-desc">${escapeHtml(item.description)}</p>`)
      }
      sections.push(`\n        <div class="guide-component-preview">`)
      sections.push(html)
      sections.push(`\n        </div>`)
      sections.push(`\n      </div>`)
    }
    sections.push('\n    </section>')
  }
  sections.push(`
  </div>
  <script src="${escapeAttr(jsPath)}"><\/script>
</body>
</html>`)
  return sections.join('')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Blob 다운로드 (문자열)
 */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** data URL을 Blob으로 변환 후 다운로드 */
function downloadDataUrlAsFile(filename: string, dataUrl: string): void {
  const res = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!res) return
  const mime = res[1]
  const bin = atob(res[2])
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  const blob = new Blob([arr], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface DownloadGuideOptions {
  commonFiles?: CommonFile[]
  commonAssets?: CommonAsset[]
  /** 다운로드된 index.html에 넣을 CSS/JS/이미지 경로 (프로젝트 설정) */
  exportPaths?: { css?: string; js?: string; images?: string }
  exportPathTree?: ExportPathNode[]
  /** 파일 트리 기반 구조 (있으면 경로를 여기서 해석) */
  fileTree?: FileNode[]
}

/** 공통 CSS 병합. component.css는 후순위(맨 뒤)로 넣어 적용되도록 함 */
function mergeCommonCss(commonFiles: CommonFile[]): string {
  const list = commonFiles
    .filter((f) => f.type === 'css')
    .sort((a, b) => ((a.name === 'component.css' ? 1 : 0) - (b.name === 'component.css' ? 1 : 0)))
  return list.map((f) => f.content.trim()).filter(Boolean).join('\n\n')
}

/** 공통 JS 병합. component.js는 후순위(맨 뒤)로 넣어 적용되도록 함 */
function mergeCommonJs(commonFiles: CommonFile[]): string {
  const list = commonFiles
    .filter((f) => f.type === 'js')
    .sort((a, b) => ((a.name === 'component.js' ? 1 : 0) - (b.name === 'component.js' ? 1 : 0)))
  return list.map((f) => f.content.trim()).filter(Boolean).join('\n\n')
}

/**
 * 가이드 다운로드: index.html, component.css, component.js, (이미지 파일들)
 * commonFiles → CSS/JS 상단 포함, commonAssets → 이미지 경로 치환 및 파일 다운로드
 */
export function downloadGuide(
  components: ComponentItem[],
  options?: DownloadGuideOptions
): void {
  const commonFiles = options?.commonFiles ?? []
  const commonAssets = options?.commonAssets ?? []
  const fileTree = options?.fileTree
  const useFileTree = fileTree?.length

  const cssPath = useFileTree ? resolveCssPath(fileTree!) : (options?.exportPaths?.css?.trim() || DEFAULT_CSS_PATH)
  const jsPath = useFileTree ? resolveJsPath(fileTree!) : (options?.exportPaths?.js?.trim() || DEFAULT_JS_PATH)

  const assetUrlMap =
    commonAssets.length > 0
      ? buildAssetUrlMap(commonAssets, {
          imagesBase: options?.exportPaths?.images,
          exportPathTree: options?.exportPathTree,
          fileTree: options?.fileTree,
        })
      : {}

  const commonCss = mergeCommonCss(commonFiles)
  const commonJs = mergeCommonJs(commonFiles)
  const componentCss = buildMergedCss(components)
  let componentJs = buildMergedJs(components)
  if (Object.keys(assetUrlMap).length > 0) {
    componentJs = replaceAssetRefsInJs(componentJs, assetUrlMap)
  }
  const css = commonCss ? commonCss + '\n\n' + componentCss : componentCss
  const js = commonJs ? commonJs + '\n\n' + componentJs : componentJs
  const html = buildIndexHtml(components, {
    cssPath,
    jsPath,
    assetUrlMap: Object.keys(assetUrlMap).length > 0 ? assetUrlMap : undefined,
  })

  downloadBlob('component.css', css, 'text/css')
  setTimeout(() => downloadBlob('component.js', js, 'application/javascript'), 80)
  setTimeout(() => downloadBlob('index.html', html, 'text/html'), 160)

  commonAssets.forEach((a, i) => {
    const ext = getExtFromDataUrl(a.dataUrl)
    const filename = sanitizeFileName(a.name) + ext
    const delay = 240 + i * 120
    setTimeout(() => downloadDataUrlAsFile(filename, a.dataUrl), delay)
  })
}

/** index.html 기준 상대 경로 (ZIP 내 HTML에서 사용) */
function relativeToIndexDir(indexHtmlPath: string, fullPath: string): string {
  const indexDir = indexHtmlPath.replace(/\/[^/]+$/, '') // WebContent
  if (!indexDir || !fullPath.startsWith(indexDir + '/')) return fullPath
  return fullPath.slice(indexDir.length + 1) // css/component.css
}

/** data URL → Uint8Array (ZIP에 바이너리 추가용) */
function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const res = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!res) return null
  const bin = atob(res[2])
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

/**
 * 파일 트리 구조대로 전체를 ZIP으로 다운로드
 * fileTree가 있어야 하며, index.html / component.css / component.js / 이미지가 경로에 맞게 포함됨
 */
export async function downloadGuideAsZip(
  components: ComponentItem[],
  options: DownloadGuideOptions & { fileTree: FileNode[]; zipFileName?: string }
): Promise<void> {
  const { fileTree, zipFileName = 'guide.zip' } = options
  const commonFiles = options.commonFiles ?? []
  const commonAssets = options.commonAssets ?? []

  const indexHtmlPath = resolveIndexHtmlPath(fileTree)
  const cssPath = resolveCssPath(fileTree)
  const jsPath = resolveJsPath(fileTree)

  const assetUrlMap =
    commonAssets.length > 0
      ? buildAssetUrlMap(commonAssets, { fileTree })
      : {}
  const relCss = relativeToIndexDir(indexHtmlPath, cssPath)
  const relJs = relativeToIndexDir(indexHtmlPath, jsPath)
  const relAssetUrlMap: Record<string, string> = {}
  Object.entries(assetUrlMap).forEach(([name, path]) => {
    relAssetUrlMap[name] = relativeToIndexDir(indexHtmlPath, path)
  })

  const commonCss = mergeCommonCss(commonFiles)
  const commonJs = mergeCommonJs(commonFiles)
  const componentCss = buildMergedCss(components)
  let componentJs = buildMergedJs(components)
  if (Object.keys(relAssetUrlMap).length > 0) {
    componentJs = replaceAssetRefsInJs(componentJs, relAssetUrlMap)
  }
  const css = commonCss ? commonCss + '\n\n' + componentCss : componentCss
  const js = commonJs ? commonJs + '\n\n' + componentJs : componentJs
  const html = buildIndexHtml(components, {
    cssPath: relCss,
    jsPath: relJs,
    assetUrlMap: Object.keys(relAssetUrlMap).length > 0 ? relAssetUrlMap : undefined,
  })

  const zip = new JSZip()
  zip.file(indexHtmlPath, html, { binary: false })
  zip.file(cssPath, css, { binary: false })
  zip.file(jsPath, js, { binary: false })

  commonAssets.forEach((a) => {
    const path = assetUrlMap[a.name]
    if (!path) return
    const bin = dataUrlToUint8Array(a.dataUrl)
    if (bin) zip.file(path, bin, { binary: true })
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipFileName.endsWith('.zip') ? zipFileName : zipFileName + '.zip'
  a.click()
  URL.revokeObjectURL(url)
}
