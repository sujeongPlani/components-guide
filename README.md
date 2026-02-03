# 웹 퍼블리셔용 라이브 컴포넌트 가이드 툴

HTML/CSS/JS 컴포넌트를 바로 구현하고 재사용하기 위한 실무용 툴입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` (또는 터미널에 표시된 주소)로 접속합니다.

## 주요 기능 (MVP)

- **가이드 메인**: 좌측 사이드바(카테고리, 검색, 새 컴포넌트, 다운로드, 공유 URL) + 컴포넌트 카드 그리드
- **컴포넌트 에디터**: 이름/카테고리, HTML/CSS/JS 탭 에디터, 실시간 Preview, 설명 입력, 저장/취소/공유
- **단일 파일 다운로드**: `component.css`, `component.js`, `index.html` 3개 파일로 다운로드 (카테고리·주석 구분)
- **공유 URL**: 현재 가이드 상태를 URL로 복사 → 다른 사용자는 읽기 전용으로 미리보기·복사·다운로드 가능 (로그인 불필요)

## 폴더 구조 요약

- `src/store` — Zustand 스토어, 컴포넌트 CRUD, localStorage persist
- `src/features/guide` — 가이드 메인 (Sidebar, ComponentGrid)
- `src/features/editor` — 에디터 (CodeEditorTabs, LivePreview, DescriptionField)
- `src/features/share` — 공유 뷰 (읽기 전용)
- `src/lib` — export(병합 CSS/JS/HTML, 다운로드), share(URL 인코딩/디코딩), preview(iframe srcdoc)

## 기술 스택

- React 18, Vite, TypeScript
- Zustand (상태 + persist)
- React Router (HashRouter)
- CodeMirror 6 (@uiw/react-codemirror)
- LZ-string (공유 URL 압축)

자세한 아키텍처는 `docs/ARCHITECTURE.md`를 참고하세요.
