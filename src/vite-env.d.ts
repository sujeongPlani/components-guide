/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 배포된 앱의 공개 URL. 설정 시 공유 링크가 이 주소로 생성됨 (예: https://guide.mycompany.com) */
  readonly VITE_PUBLIC_URL?: string
  /** Vite 빌드 기준 경로. 서브경로 배포 시 사용 (예: /guide/) */
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*?raw' {
  const content: string
  export default content
}
