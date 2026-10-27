-- setup.sql – 현장 일정 날씨판 F-06 : Supabase 표 wx_tasks 만들기
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (이미 있으면 건너뜀).

-- 1) 표 만들기 + 값 규칙 (화면의 logic.js 규칙과 같게 DB 에서도 막음)
create table if not exists public.wx_tasks (
  id         bigint generated always as identity primary key,       -- 순번 (자동 증가, 목록 순서 기준)
  title      text not null
             check (char_length(btrim(title)) between 1 and 50),    -- 일정 이름: 빈칸 금지, 50자 이하
  region     text not null
             check (region in ('세종', '대전', '태안', '보령', '서산')),  -- 지역: 선택 목록 5곳만
  kind       text not null
             check (kind in ('야외', '고소', '실내')),               -- 구분: 3가지만
  owner      text not null
             check (char_length(btrim(owner)) between 1 and 20),    -- 담당: 빈칸 금지, 20자 이하
  created_at timestamptz not null default now()                     -- 추가한 시각
);

-- 2) 행 단위 보안(RLS) 켜기: 정책으로 허락한 일만 할 수 있음
alter table public.wx_tasks enable row level security;

-- 공개용 키(anon · publishable)로는 '읽기'와 '추가'만 허락합니다.
-- 수정(update) · 삭제(delete) 정책은 만들지 않으므로 막힙니다.
drop policy if exists "wx_tasks 누구나 읽기" on public.wx_tasks;
create policy "wx_tasks 누구나 읽기"
  on public.wx_tasks for select
  to anon, authenticated
  using (true);

drop policy if exists "wx_tasks 누구나 추가" on public.wx_tasks;
create policy "wx_tasks 누구나 추가"
  on public.wx_tasks for insert
  to anon, authenticated
  with check (true);

-- 공개용 키가 이 표에 접근할 수 있는 권한 (읽기 · 추가만)
grant select, insert on public.wx_tasks to anon, authenticated;

-- 3) 처음 보이는 가상 일정 6건 (표가 비어 있을 때만 넣음 → 다시 실행해도 중복 없음)
insert into public.wx_tasks (title, region, kind, owner)
select title, region, kind, owner
from (values
  ('다중이용시설 안전점검',   '세종', '야외', '김안전'),
  ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('옥상 태양광 설비 점검',   '태안', '고소', '박설비'),
  ('하천 수위계 확인',        '대전', '야외', '최현장'),
  ('청사 외벽 간판 보수',     '세종', '고소', '정시설'),
  ('비상연락 훈련',           '대전', '실내', '한상황')
) as seed(title, region, kind, owner)
where not exists (select 1 from public.wx_tasks);

-- 4) 확인: 6건이 보이면 성공
select id, title, region, kind, owner from public.wx_tasks order by id;
