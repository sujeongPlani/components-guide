# DB 연결 가이드

이 프로젝트는 현재 **프론트엔드만** 있으며, 데이터는 **Zustand + localStorage**에 저장됩니다. DB를 연결하려면 **백엔드(API)** 가 필요하고, 저장소 연동을 API 호출로 바꿔야 합니다.

---

## Supabase 막 시작했을 때 (대시보드에서 할 일)

Supabase에 가입하고 **프로젝트를 만들었다**면, 아래 순서대로 하면 됩니다.

### 1단계: URL과 API 키 복사

1. [Supabase 대시보드](https://supabase.com/dashboard) 로그인 후 **만든 프로젝트** 클릭
2. 왼쪽 메뉴에서 **Project Settings**(톱니바퀴) → **API**
3. 아래 두 값을 복사해 둡니다.
   - **Project URL** → 나중에 `.env`의 `VITE_SUPABASE_URL`에 넣을 값
   - **anon public** 키 → `VITE_SUPABASE_ANON_KEY`에 넣을 값

### 2단계: 테이블 만들기

1. 왼쪽 메뉴 **SQL Editor** 클릭
2. **New query** 로 새 쿼리 열기
3. 아래 SQL 전체를 붙여넣고 **Run** 실행

```sql
-- 프로젝트 한 개를 한 행으로 저장 (data에 나머지 필드 전부 JSON)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

4. **템플릿 전용 컴포넌트 테이블** (KRDS/MXDS 컴포넌트 정규화 저장용)  
   - **SQL Editor**에서 **New query**로 열고, 프로젝트의 `docs/sql/template_components.sql` 파일 내용 전체를 붙여넣은 뒤 **Run** 실행합니다.  
   - 이 테이블이 없어도 앱은 동작하며, 템플릿 컴포넌트는 기존처럼 `projects.data` 안에만 저장됩니다. 테이블을 만들면 템플릿 컴포넌트가 이 테이블에 추가로 저장·조회됩니다.

> 나중에 로그인(인증)을 붙이려면 `user_id` 컬럼과 RLS 정책을 추가하면 됩니다. 지금은 인증 없이 동작하도록 했습니다.

### 3단계: 프로젝트 폴더에 환경 변수 설정

1. 프로젝트 루트에 `.env` 파일이 없으면 만들기
2. 1단계에서 복사한 값으로 아래처럼 넣기 (값은 반드시 본인 프로젝트 것으로 교체)

```env
VITE_SUPABASE_URL=https://여기에본인프로젝트id.supabase.co
VITE_SUPABASE_ANON_KEY=여기에_anon_public_키_전체
```

3. 저장 후 **개발 서버를 한 번 껐다가 다시 실행** (`npm run dev`)

이렇게 하면 앱이 켜질 때 Supabase에서 프로젝트 목록을 불러오고, 프로젝트를 추가/수정/삭제할 때마다 DB에 자동으로 반영됩니다.

### DB에 안 들어갈 때 확인할 것

- **브라우저 콘솔(F12)** 을 연 다음 페이지를 새로고침하세요.
  - `[Supabase] DB 연동 사용 중` 이 보이면 → .env가 적용된 것이고, 변경 후 약 1.5초 뒤에 저장이 시도됩니다.
  - `[Supabase] .env에 ... 없어 DB 동기화를 쓰지 않습니다` 가 보이면 → .env가 안 읽힌 것입니다. **개발 서버를 끄고 다시 `npm run dev`** 한 번 해보세요.
  - `[Supabase] 저장 실패` / `[Supabase] 프로젝트 목록 불러오기 실패` 가 보이면 → 에러 메시지를 보고 (테이블 이름, RLS, 네트워크 등) 확인하면 됩니다.
- **Supabase에 저장되는 것**: **일반 프로젝트** + **KRDS / MXDS 편집본** 모두 DB에 저장됩니다. KRDS/MXDS는 같은 `projects` 테이블에 고정 UUID로 저장되며, 편집 시 변경 내용이 즉시 반영됩니다.

### 다른 브라우저/기기에서 프로젝트가 안 보일 때

1. **콘솔 로그 확인** (F12 → Console)  
   - `[Supabase] 프로젝트 없음 → DB에서 불러오는 중…` 다음에  
   - `[Supabase] DB에서 N개 프로젝트 불러옴` 이 나오는지 봅니다.  
   - **N이 0**이면 DB 조회 결과가 비어 있는 것입니다. 저장은 되는데 읽기가 안 되는 경우가 많습니다.

2. **RLS(행 수준 보안) 확인**  
   - Supabase **Table Editor** → **projects** 테이블 → **RLS** 가 켜져 있으면, **정책**에서 **SELECT**가 anon 사용자에게 허용되는지 봅니다.  
   - `auth.uid() = user_id` 같은 정책만 있으면, 로그인하지 않은 anon 키로는 **0건**만 조회됩니다.  
   - **테스트용**으로 읽기까지 쓰려면:  
     - **Authentication** 없이 쓰는 경우: RLS를 끄거나,  
     - **정책 추가**: `projects` 테이블에 **SELECT** 정책을 추가해서 **anon**이 모든 행을 읽을 수 있게 하세요.  
   - (나중에 로그인을 붙이면 `user_id`와 `auth.uid()`로 다시 제한하면 됩니다.)

### 프로젝트는 불러오는데 컴포넌트가 안 보일 때 (저장/불러오기 범위)

**저장되는 내용**

- Supabase `projects` 테이블에는 **한 프로젝트당 한 행**이 들어갑니다.
- 컬럼: `id`, `name`, `data`(JSONB), `created_at`, `updated_at`
- **`data` 안에** 프로젝트의 나머지 정보가 전부 들어갑니다:
  - `type`, `components`, `categories`, `commonFiles`, `commonAssets`, `fileTree`
  - 그 외 `createdAt`, `coverImage`, `description`, `participants`, `isBookmarkGuide`, `exportPaths`, `exportPathTree`
- **저장 시점**: 프로젝트/편집 템플릿 내용이 바뀔 때마다 **해당 행이 즉시** DB에 저장됩니다 (액션 호출 시마다).
- **KRDS / MXDS 기본 템플릿 편집본**도 같은 `projects` 테이블에 저장됩니다. 고정 UUID(`EDITABLE_TEMPLATE_ROW_IDS`)로 구분되며, 목록 조회 시에는 제외되고 `editableTemplates` 로만 불러옵니다.

**불러오는 내용**

- 앱 로드 시 `fetchProjectsFromSupabase()`로 일반 프로젝트 행을, `fetchEditableTemplatesFromSupabase()`로 KRDS/MXDS 편집본 행을 조회합니다.
- 각 행의 `data`에서 `data.components`, `data.categories`, `data.commonFiles` 등을 꺼내서 화면에 씁니다 (프로젝트 → `projects`, KRDS/MXDS → `editableTemplates`).
- 콘솔에 `[Supabase] 불러옴: 프로젝트명 | data 안 컴포넌트: N개 | data 키: ...` 및 `KRDS/MXDS 편집본: N개` 로그가 찍힙니다.

**검증 방법**

1. **저장이 됐는지**  
   - 컴포넌트 추가/수정 후 **최소 1.5초 이상** 기다리거나, 프로젝트 이름 수정 등 다른 변경을 한 뒤 1.5초 후 저장 로그를 확인하세요.  
   - 콘솔에 `[Supabase] 저장 시도: 프로젝트명 | 컴포넌트 N개 | data 키: ...` 가 나와야 하고, 컴포넌트를 넣었다면 N이 1 이상이어야 합니다.

2. **불러오기가 됐는지**  
   - 페이지 새로고침 후 콘솔에서 `[Supabase] 불러옴: ... | data 안 컴포넌트: N개` 를 확인하세요.  
   - **N이 0**인데 컴포넌트가 있어야 한다면:
     - 직전에 저장이 **컴포넌트 반영 전**에만 됐을 수 있습니다. (예: 프로젝트만 만들고 곧바로 새로고침)
     - 한 번 해당 프로젝트에서 컴포넌트를 다시 추가/수정한 뒤 **1.5초 이상 기다린 다음** 새로고침해 보세요.
   - Supabase **Table Editor**에서 해당 프로젝트 행의 `data` 컬럼을 열어 `data.components` 배열이 들어 있는지 직접 확인할 수도 있습니다.

**요약**

| 구분 | 범위 |
|------|------|
| DB에 저장되는 것 | 일반 프로젝트(`type === 'project'`) + **KRDS/MXDS 편집본**(고정 UUID 행). 각각 **전체 데이터**(컴포넌트, 카테고리, commonFiles, fileTree 등)가 `data` JSON에 들어감. |
| 저장 시점 | 프로젝트/편집 템플릿 변경 시 **해당 항목 즉시** 저장 (액션 호출 시마다). |
| 불러오기 | 앱 시작 시 DB에서 일반 프로젝트 목록 + KRDS/MXDS 편집본을 가져와 `projects` / `editableTemplates`에 반영. |

### 저장 완료인데 다른 브라우저/기기에서 안 보일 때

1. **Supabase 대시보드로 DB 직접 확인**  
   - [Supabase 대시보드](https://supabase.com/dashboard) → 해당 프로젝트 → **Table Editor** → `projects` 테이블  
   - 해당 행(예: 54541)의 **`data`** 컬럼을 펼쳐 보세요.  
   - **`data` 안에 `components` 배열이 있고, 길이가 1 이상이면** DB에는 정상 반영된 것입니다. → 아래 2번으로.  
   - **`components`가 비어 있거나 없으면** 저장이 DB까지 반영되지 않은 것입니다. → RLS 정책(INSERT/UPDATE 허용 여부), 네트워크 오류 로그 확인.

2. **DB에는 있는데 다른 브라우저에서만 0개로 보일 때**  
   - 다른 브라우저에서 **강력 새로고침**(Ctrl+Shift+R 또는 Cmd+Shift+R) 후 다시 로드해 보세요.  
   - 이 앱은 Supabase 요청 시 **캐시를 쓰지 않도록** 설정되어 있어, 매번 최신 데이터를 가져옵니다.  
   - 그래도 0개면: 해당 브라우저 콘솔에서 `[Supabase] 불러옴: ... | data 안 컴포넌트: N개` 의 N이 몇인지 확인하고, Table Editor의 `data.components` 길이와 비교해 보세요.

3. **저장 직후 곧바로 다른 브라우저를 열었을 때**  
   - 저장 로그가 뜬 뒤 **2~3초 정도 기다린 다음** 다른 브라우저를 열거나 새로고침하는 것이 안전합니다.

---

## 현재 데이터 구조

| 저장 위치 | 내용 |
|-----------|------|
| `localStorage` (키: `live-component-guide`) | `projects`, `editableTemplates`, `systemTemplateMetaOverrides` |
| `authService` | 로그인 세션 (mock, localStorage) |

**주요 엔티티**: `Project` (id, name, components, commonFiles, commonAssets, fileTree, categories 등)

---

## DB 연결 옵션

### 1. Supabase (추천)

- **PostgreSQL** 기반, REST/실시간 API 제공
- 인증(Auth) 내장 → 로그인을 Supabase Auth로 전환 가능
- 무료 티어 있음

**필요 작업 요약**

1. [Supabase](https://supabase.com) 프로젝트 생성
2. 테이블 설계: `projects` (JSONB로 한 행에 프로젝트 전체 저장 가능), `users`는 Auth 사용
3. `@supabase/supabase-js` 설치 후, 프로젝트 로드/저장을 Supabase API로 교체
4. Zustand `persist`를 **localStorage 대신** “API에서 불러오기 / API로 저장” 레이어로 교체

### 2. Firebase (Firestore)

- 실시간 동기화, 인증 내장
- 문서형 DB

**필요 작업 요약**

1. Firebase 프로젝트 생성, Firestore 사용
2. 컬렉션 설계: 예) `users/{userId}/projects/{projectId}`
3. `firebase` SDK 설치, 로드/저장을 Firestore `get/set`으로 구현
4. Zustand 쪽은 Supabase와 동일하게 “API 연동 레이어”로 전환

### 3. 자체 백엔드 + DB

- Node.js(Express 등) + PostgreSQL / MySQL 등
- REST 또는 GraphQL API 직접 설계

**필요 작업 요약**

1. 백엔드 서버 구현 (예: `POST/GET /api/projects`, `GET /api/projects/:id`)
2. DB 스키마 설계 후 프로젝트 CRUD 구현
3. 프론트에서 `fetch` 또는 axios로 API 호출
4. Zustand 초기 로드는 API, 저장 시 API 호출하도록 변경

---

## 공통으로 할 작업 (어떤 방식을 선택해도 동일)

1. **환경 변수**  
   API URL, anon key 등은 `.env`에 두고 `VITE_` 접두사로 사용 (Vite 클라이언트 노출 가능한 값만).

2. **저장소 연동 변경**  
   - **초기 로드**: 앱 시작 시 `localStorage` 대신 **API에서 프로젝트 목록/상세 조회**  
   - **저장**: 프로젝트 추가/수정/삭제 시 **API 호출** 후 성공 시 스토어 반영  
   - 선택: Zustand `persist` 제거하고, “수동”으로 필요한 시점에 API 호출

3. **인증 연동 (선택)**  
   Supabase/Firebase를 쓰면 해당 Auth와 연동; 자체 백엔드면 JWT 등으로 로그인 후 API 요청에 토큰 붙이기.

4. **에러/로딩 처리**  
   API 실패 시 사용자 메시지, 재시도, 로딩 스피너 등.

---

## 이미 적용된 Supabase 연동 (이 프로젝트 기준)

아래는 **이미 코드에 반영된** 내용입니다. 대시보드에서 **1~2단계 + .env**만 하면 됩니다.

### 1) 설치

```bash
npm install @supabase/supabase-js
```
→ 이미 설치되어 있습니다.

### 2) 환경 변수 (`.env`)

프로젝트 루트에 `.env` 파일을 만들고, **Supabase 막 시작했을 때** 절에서 복사한 값으로 채웁니다.

### 3) 테이블 (SQL Editor에서 실행)

**Supabase 막 시작했을 때** 절의 SQL과 동일합니다. (인증 없이 사용하는 단순 테이블)

### 4) API 레이어 (`src/lib/supabase.ts`)

`src/lib/supabase.ts`에 다음이 구현되어 있습니다.

- **fetchProjectsFromSupabase()** – DB에서 프로젝트 목록 조회
- **saveProjectToSupabase(project)** – 프로젝트 한 개 저장/덮어쓰기
- **deleteProjectFromSupabase(projectId)** – 프로젝트 한 개 삭제
- **isSupabaseConfigured** – `.env`에 URL/키가 있는지 여부

동작 방식:

- **앱 로드 시**: `.env`에 Supabase 설정이 있으면 DB에서 프로젝트를 불러와 화면에 띄웁니다.
- **변경 시**: 프로젝트 추가/수정/삭제 후 2초 뒤에 자동으로 DB에 반영됩니다.

---

## 다음 단계

1. **Supabase / Firebase / 자체 백엔드** 중 하나를 선택합니다.
2. 선택한 방식에 맞춰:
   - DB(또는 Firestore) 스키마 설계
   - `src/store/index.ts`의 `persist` 설정을 유지할지, 제거하고 API만 쓸지 결정
   - 프로젝트 로드/저장을 API 호출로 바꾸는 함수를 추가하고, 스토어 액션에서 호출

원하시면 선택하신 방식(Supabase / Firebase / Node+DB)을 알려주시면, 이 리포지토리 구조에 맞춰 **어디를 어떻게 수정하면 되는지** 단계별로 짚어드리겠습니다.
