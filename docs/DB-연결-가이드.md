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
