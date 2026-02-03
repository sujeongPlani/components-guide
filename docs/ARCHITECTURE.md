# 웹 퍼블리셔용 라이브 컴포넌트 가이드 툴 - 아키텍처

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        React App (SPA)                           │
├─────────────────────────────────────────────────────────────────┤
│  Routes                                                          │
│  ├ / (또는 /guide)     → 가이드 메인 (컴포넌트 목록)              │
│  ├ /edit/:id           → 컴포넌트 편집                            │
│  ├ /edit/new           → 새 컴포넌트 생성                         │
│  └ /share/:encoded     → 공유 뷰 (읽기 전용)                      │
├─────────────────────────────────────────────────────────────────┤
│  Zustand Store                                                   │
│  ├ components[]        → 컴포넌트 목록                            │
│  ├ categories          → 카테고리별 그룹핑                        │
│  └ persistence         → localStorage / URL encode               │
├─────────────────────────────────────────────────────────────────┤
│  Features                                                        │
│  ├ 실시간 Preview      → iframe srcdoc (sandbox)                  │
│  ├ 코드 에디터         → Monaco 또는 CodeMirror (경량)            │
│  ├ 다운로드            → Blob → component.css / component.js     │
│  └ 공유 URL            → state → base64/compress → query          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 데이터 모델

### Component
```ts
{
  id: string;           // uuid
  name: string;         // 표시 이름
  category: string;     // Button | Form | Card | Layout | etc
  description: string;  // 간단 설명 (추후 AI용)
  html: string;
  css: string;
  js: string;
  createdAt: number;
  updatedAt: number;
}
```

### Categories (기본값)
- Button, Form, Card, Layout, Navigation, Modal, Table, Typography, Etc

## 3. 폴더 구조

```
가이드ai/
├── public/
│   └── (정적 리소스)
├── src/
│   ├── app/                    # 앱 진입점, 라우팅
│   │   ├── App.tsx
│   │   └── routes.tsx
│   ├── store/                  # Zustand 스토어
│   │   ├── index.ts
│   │   └── types.ts
│   ├── features/
│   │   ├── guide/              # 가이드 메인
│   │   │   ├── GuidePage.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ComponentGrid.tsx
│   │   ├── editor/             # 컴포넌트 에디터
│   │   │   ├── EditorPage.tsx
│   │   │   ├── CodeEditorTabs.tsx
│   │   │   ├── LivePreview.tsx
│   │   │   └── DescriptionField.tsx
│   │   └── share/              # 공유 뷰
│   │       └── ShareViewPage.tsx
│   ├── components/              # 공통 UI
│   │   ├── ui/                  # 버튼, 카드, 탭 등
│   │   ├── ComponentCard.tsx    # 가이드용 컴포넌트 카드
│   │   └── CopyButton.tsx
│   ├── lib/
│   │   ├── export.ts            # 단일 파일 다운로드 로직
│   │   ├── share.ts             # URL 인코딩/디코딩
│   │   └── preview.ts           # iframe srcdoc 생성
│   ├── styles/
│   │   ├── index.css            # 글로벌 + 디자인 토큰
│   │   └── (필요 시 모듈)
│   └── main.tsx
├── docs/
│   └── ARCHITECTURE.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 4. 핵심 플로우

### 4.1 컴포넌트 생성/편집
1. 가이드에서 "새 컴포넌트 추가" → `/edit/new`
2. 이름, 카테고리, HTML/CSS/JS 입력 → 실시간 Preview
3. 저장 → store 업데이트 + localStorage → 가이드로 이동

### 4.2 다운로드
1. 가이드 또는 공유 뷰에서 "다운로드"
2. 모든 컴포넌트를 카테고리별로 정리:
   - `component.css`: 카테고리 주석 + 각 컴포넌트 CSS 병합
   - `component.js`: 카테고리 주석 + 각 컴포넌트 JS 병합
   - `index.html`: 가이드용 HTML (선택) 또는 컴포넌트 마크업만

### 4.3 공유 URL
1. 현재 store 상태(전체 컴포넌트)를 JSON 직렬화
2. 압축(예: pako) + base64 → `?data=xxx`
3. `/share?data=xxx` 또는 `/share/xxx` 로 접근 시 디코딩 후 읽기 전용 렌더

## 5. 기술 스택 (MVP)

| 항목 | 선택 |
|------|------|
| 프레임워크 | React 18 + Vite |
| 상태 관리 | Zustand |
| 라우팅 | React Router v6 |
| 코드 에디터 | @uiw/react-codemirror (경량) 또는 Monaco |
| 스타일 | CSS (미니멀 디자인 토큰) |
| ID 생성 | crypto.randomUUID() |
| 공유 인코딩 | LZ-string (compressToEncodedURIComponent) |

## 6. UX 원칙 반영

- **설정 화면 없음**: 카테고리는 드롭다운으로 즉시 선택
- **저장 즉시 반영**: 저장 시 가이드 그리드에 바로 표시
- **직관적 UI**: 복사 버튼은 아이콘+툴팁, 탭은 HTML/CSS/JS만
- **실무 적용**: 다운로드된 CSS/JS는 주석으로 구분되어 그대로 붙여넣기 가능
