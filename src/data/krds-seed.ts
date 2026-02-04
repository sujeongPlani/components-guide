/**
 * KRDS/MXDS 시드: systemTemplate 기본 템플릿. data 폴더에서 로드.
 */
import type { Project, CommonFile, CommonAsset, FileNode } from '@/store/types'
import { DEFAULT_CATEGORIES } from '@/store/types'
import { createDefaultFileTree } from '@/lib/fileTree'

import mixinCss from './krds/mixin.css?raw'
import krdsTokensCss from './krds/krds_tokens.css?raw'
import krdsCss from './krds/krds.css?raw'
import krdsMinCss from './krds/krds.min.css?raw'
import krdsRespondCss from './krds/krds_respond.css?raw'
import componentCss from './krds/component.css?raw'
import patternJs from './krds/pattern.js?raw'
import componentJs from './krds/component.js?raw'

const svgModules = import.meta.glob('./krds/img/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

let cached: Project | null = null

function uuid() {
  return crypto.randomUUID()
}

function fileNode(name: string, type: 'folder' | 'file', children?: FileNode[], id?: string): FileNode {
  return { id: id ?? uuid(), name, type, children }
}

function svgToDataUrl(svgContent: string): string {
  const encoded = btoa(unescape(encodeURIComponent(svgContent)))
  return `data:image/svg+xml;base64,${encoded}`
}

export function getKrdsSeedProject(): Project {
  if (cached) return cached

  const imgFolderId = uuid()
  const iconFolderId = uuid()

  const commonFiles: CommonFile[] = [
    { id: uuid(), name: 'mixin.css', content: mixinCss as string, type: 'css' },
    { id: uuid(), name: 'krds_tokens.css', content: krdsTokensCss as string, type: 'css' },
    { id: uuid(), name: 'krds.css', content: krdsCss as string, type: 'css' },
    { id: uuid(), name: 'krds.min.css', content: krdsMinCss as string, type: 'css' },
    { id: uuid(), name: 'krds_respond.css', content: krdsRespondCss as string, type: 'css' },
    { id: uuid(), name: 'component.css', content: componentCss as string, type: 'css' },
    { id: uuid(), name: 'pattern.js', content: patternJs as string, type: 'js' },
    { id: uuid(), name: 'component.js', content: componentJs as string, type: 'js' },
  ]

  const commonAssets: CommonAsset[] = []
  const iconFileNodes: FileNode[] = []
  const imgRootFileNodes: FileNode[] = []

  for (const [path, mod] of Object.entries(svgModules)) {
    const content = typeof mod === 'string' ? mod : (mod as { default?: string })?.default
    if (!content) continue
    const pathNorm = path.replace(/\?raw$/, '').replace(/^\.\/krds\/img\//, '')
    const parts = pathNorm.split('/')
    const fileName = parts[parts.length - 1]
    const isInIcon = pathNorm.startsWith('icon/')
    commonAssets.push({
      id: uuid(),
      name: fileName,
      dataUrl: svgToDataUrl(content),
      exportFolderId: isInIcon ? iconFolderId : imgFolderId,
    })
    if (isInIcon) {
      iconFileNodes.push(fileNode(fileName, 'file'))
    } else {
      imgRootFileNodes.push(fileNode(fileName, 'file'))
    }
  }

  // WebContent/ ├ css/ │ └ *.css ├ js/ │ └ *.js ├ img/ │ └ (이미지·폴더) └ index.html
  const fileTree: FileNode[] = [
    fileNode('WebContent', 'folder', [
      fileNode('css', 'folder', [
        fileNode('mixin.css', 'file'),
        fileNode('krds_tokens.css', 'file'),
        fileNode('krds.css', 'file'),
        fileNode('krds.min.css', 'file'),
        fileNode('krds_respond.css', 'file'),
        fileNode('component.css', 'file'),
      ]),
      fileNode('js', 'folder', [
        fileNode('pattern.js', 'file'),
        fileNode('component.js', 'file'),
      ]),
      fileNode('img', 'folder', [
        fileNode('icon', 'folder', iconFileNodes, iconFolderId),
        ...imgRootFileNodes,
      ], imgFolderId),
      fileNode('index.html', 'file'),
    ]),
  ]

  cached = {
    id: uuid(),
    name: 'KRDS',
    description: '기본 디자인 시스템 가이드 (KRDS)',
    type: 'systemTemplate',
    createdAt: 0,
    components: [],
    categories: [...DEFAULT_CATEGORIES],
    commonFiles,
    commonAssets,
    fileTree,
    exportPathTree: [],
    isBookmarkGuide: false,
  }
  return cached
}

/** MXDS 시드: 기본 템플릿 (빈 구조). data 폴더에 MXDS 전용 에셋이 있으면 추후 확장 */
let mxdsCached: Project | null = null

export function getMxdsSeedProject(): Project {
  if (mxdsCached) return mxdsCached
  mxdsCached = {
    id: uuid(),
    name: 'MXDS',
    description: '기본 템플릿 (MXDS)',
    type: 'systemTemplate',
    createdAt: 0,
    components: [],
    categories: [...DEFAULT_CATEGORIES],
    commonFiles: [],
    commonAssets: [],
    fileTree: createDefaultFileTree(),
    exportPathTree: [],
    isBookmarkGuide: false,
  }
  return mxdsCached
}
