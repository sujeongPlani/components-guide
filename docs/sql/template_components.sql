-- ============================================================
-- 템플릿(KRDS/MXDS) 전용 컴포넌트 테이블
-- Supabase SQL Editor에서 이 파일 내용을 붙여넣고 Run 실행
-- ============================================================

-- 한 행 = 템플릿에 속한 컴포넌트 한 개 (template_kind로 krds/mxds 구분)
create table if not exists template_components (
  id uuid primary key,
  template_kind text not null check (template_kind in ('krds', 'mxds')),
  name text not null default '',
  category text not null default '',
  description text not null default '',
  html text not null default '',
  css text not null default '',
  js text not null default '',
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- template_kind로 조회 시 인덱스 사용
create index if not exists idx_template_components_kind on template_components(template_kind);

comment on table template_components is 'KRDS/MXDS 템플릿에 속한 컴포넌트 목록 (템플릿별 정규화 저장)';
