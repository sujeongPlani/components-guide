export const CATEGORIES = [
  'Button',
  'Form',
  'Card',
  'Layout',
  'Navigation',
  'Modal',
  'Table',
  'Typography',
  'Etc',
] as const

/** 스토어 초기값·내보내기용. 편집 가능한 카테고리는 스토어의 categories 사용 */
export const DEFAULT_CATEGORIES = [...CATEGORIES]

export type Category = (typeof CATEGORIES)[number]

export interface ComponentItem {
  id: string
  name: string
  category: string
  description: string
  html: string
  css: string
  js: string
  createdAt: number
  updatedAt: number
}

export type GuideState = {
  components: ComponentItem[]
}

/** 공통 CSS/JS 파일 (reset.css, font.css, swiper.js 등) */
export interface CommonFile {
  id: string
  name: string
  content: string
  type: 'css' | 'js'
}

/** 공통 리소스 - 파일 업로드로 등록한 이미지/폰트 등 (data URL 저장) */
export interface CommonAsset {
  id: string
  name: string
  dataUrl: string
  /** 내보낼 폴더 ID (exportPathList 중 하나, 비면 images 기본 경로 사용) */
  exportFolderId?: string
}

/** 내보내기 경로 트리 노드 (폴더) - 이미지/리소스가 놓일 경로 */
export interface ExportPathNode {
  id: string
  name: string
  /** 경로 (끝에 / 권장, 예: assets/images/) */
  path: string
  children: ExportPathNode[]
}

/** 다운로드 시 index.html에 넣을 CSS/JS/이미지 경로 (프로젝트별 설정) */
export interface ExportPaths {
  css?: string
  js?: string
  /** 이미지·리소스 기본 경로 (폴더 미지정 시 사용, 예: assets/images/) */
  images?: string
}

/** 파일 트리 노드 (폴더/파일) - 경로 일관성의 단일 소스 */
export interface FileNode {
  id: string
  name: string
  type: 'folder' | 'file'
  children?: FileNode[]
}

/** 삭제 불가 기본 파일명 */
export const PROTECTED_FILE_NAMES = ['component.css', 'component.js', 'index.html'] as const

/** 프로젝트 단위 가이드 (컴포넌트·카테고리·공통 리소스) */
export interface Project {
  id: string
  name: string
  /** 비주얼/커버 이미지 (data URL) */
  coverImage?: string
  /** 참여자 명 (여러 명) */
  participants?: string[]
  /** 북마크 가이드로 등록 여부 (별 아이콘, 새 프로젝트 생성 시 템플릿으로 선택 가능) */
  isBookmarkGuide?: boolean
  /** 다운로드 시 사용할 CSS/JS/이미지 경로 (비우면 기본값 사용) */
  exportPaths?: ExportPaths
  /** 내보내기 경로 트리 (폴더 목록) - 리소스별로 놓일 폴더 선택 */
  exportPathTree?: ExportPathNode[]
  /** 파일 트리 기반 구조 (있으면 경로 해석에 사용) */
  fileTree?: FileNode[]
  components: ComponentItem[]
  categories: string[]
  commonFiles: CommonFile[]
  commonAssets: CommonAsset[]
}
