-- ============================================================
-- 클리닉실 관리 — Supabase(Postgres) 스키마
-- Supabase 대시보드의 SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================

-- 선생님: Supabase Auth 사용자와 1:1로 연결됩니다(auth_user_id).
-- 로그인 후 이 테이블에 자신의 행이 없으면 앱이 자동으로 만들어줍니다.
-- role: 'admin'(관리자 사이트 전체 접근) | 'teacher'(선생님 앱만 사용, 기본값).
-- 회원가입만으로 관리자 권한을 갖지 못하도록, 새로 가입한 계정은 항상 'teacher'로 시작합니다.
-- 처음 admin 계정은 가입 후 Supabase 대시보드에서 수동으로 role을 'admin'으로 바꿔줘야 합니다(README 참고).
create table if not exists teachers (
  id text primary key,
  name text not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'teacher'
);
alter table teachers add column if not exists role text not null default 'teacher';

create table if not exists students (
  id text primary key,
  name text not null,
  grade text,
  school text, -- 동명이인 구분용
  withdrawn boolean not null default false,
  withdrawn_at date
);
alter table students add column if not exists school text;

create table if not exists courses (
  id text primary key,
  name text not null,
  subject text,
  day_of_week int not null,
  start_time text not null,
  end_time text not null,
  teacher_id text references teachers(id) on delete set null
);

create table if not exists enrollments (
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  primary key (student_id, course_id)
);

create table if not exists course_curriculum (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  type text not null,
  material text,
  range_from text,
  range_to text,
  exam_minutes int,
  total_questions int
);

create table if not exists assignment_templates (
  id text primary key,
  type text not null,
  material text,
  range_from text,
  range_to text
);

-- 교재(type:'교재', 학원 전체 공유) / 학습지(type:'학습지', teacher_id로 만든 선생님 표시) 이름 목록.
-- hidden이 true면 화면(팝업)에서만 숨겨지고 실제 행은 지워지지 않습니다.
create table if not exists material_library (
  id text primary key,
  type text not null,
  name text not null,
  teacher_id text references teachers(id) on delete set null,
  hidden boolean not null default false
);

create table if not exists student_assignments (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  course_id text references courses(id) on delete set null,
  type text not null,
  material text,
  range_from text,
  range_to text,
  created_at date,
  status text not null default 'todo',
  done_date date,
  actual_range text,
  due_date date,
  total_questions int,
  correct_count int,
  alt_score int,
  alt_total int,
  done_range_from text,
  done_range_to text,
  done_note text,
  exam_session_id text,
  timing text default '클리닉중', -- '입실' | '클리닉중' | '퇴실' — 언제 확인/수행해야 하는 항목인지
  priority int, -- 같은 timing 안에서의 우선순위(작을수록 먼저). 담당 선생님이 지정.
  -- 매쓰플랫 등으로 만든 학습지/시험: 오답이 나오면 관리자가 직접 사이트에 접속해 오답(또는 쌍둥이 문제)을 뽑아 다시 풀리는 경우가 있어,
  -- 그 후속 처리 방식을 등록해두고(is_mathflat/mathflat_follow_up/mathflat_note), 관리자가 뽑아준 회차별 결과를 mathflat_rounds에 기록합니다.
  is_mathflat boolean default false,
  mathflat_follow_up text, -- 'none' | 'wrong_only' | 'twin' | 'other'
  mathflat_note text,
  mathflat_rounds jsonb, -- [{id, label, correctCount, totalQuestions}]
  wrong_numbers jsonb -- 시험 유형에서 관리자가 여유 있을 때 입력하는 틀린 문제 번호 배열, 예: [3,7,12]
);
alter table student_assignments add column if not exists timing text default '클리닉중';
alter table student_assignments add column if not exists priority int;
alter table student_assignments add column if not exists is_mathflat boolean default false;
alter table student_assignments add column if not exists mathflat_follow_up text;
alter table student_assignments add column if not exists mathflat_note text;
alter table student_assignments add column if not exists mathflat_rounds jsonb;
alter table student_assignments add column if not exists wrong_numbers jsonb;

create table if not exists teacher_notes (
  id text primary key,
  teacher_id text references teachers(id) on delete set null,
  message text not null,
  created_at date not null,
  course_id text references courses(id) on delete set null,
  student_ids jsonb -- 특정 학생들만 대상으로 하는 그룹 공지면 학생 id 배열, 전체 공지면 null
);
-- 이미 teacher_notes가 있던 경우(이전 버전 schema.sql을 실행했던 경우)에도 새 컬럼이 안전하게 추가됩니다.
alter table teacher_notes add column if not exists course_id text references courses(id) on delete set null;
alter table teacher_notes add column if not exists student_ids jsonb;

create table if not exists exam_sessions (
  id text primary key,
  date date not null,
  course_id text references courses(id) on delete set null,
  curriculum_item_id text,
  material text,
  range_from text,
  range_to text,
  duration_min int not null default 30,
  total_questions int
);

create table if not exists exam_session_participants (
  exam_session_id text not null references exam_sessions(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  start_time text not null,
  primary key (exam_session_id, student_id)
);

-- 반별 설정이 아니라 앱 전체에 걸친 값(자리 배치도 방향/크기 등)을 저장하는 단일 행 테이블.
create table if not exists app_settings (
  id text primary key default 'global',
  room_orientation text not null default 'landscape'
);
-- 이미 app_settings가 있던 경우(이전 버전 schema.sql을 실행했던 경우)에도 새 컬럼이 안전하게 추가됩니다.
alter table app_settings add column if not exists landscape_width int not null default 600;
alter table app_settings add column if not exists landscape_height int not null default 340;
alter table app_settings add column if not exists portrait_width int not null default 360;
alter table app_settings add column if not exists portrait_height int not null default 640;
insert into app_settings (id, room_orientation) values ('global', 'landscape') on conflict (id) do nothing;

create table if not exists seats (
  id text primary key,
  x int not null,
  y int not null,
  label text
);

-- 자리 배치도에 표시하는 입구/관리자석 같은 안내 마커(실제 학생 자리 아님).
create table if not exists room_markers (
  id text primary key,
  x int not null,
  y int not null,
  label text not null,
  icon text
);

-- customTasks(당일 추가 시 직접 입력한 학습항목)는 구조가 자유로워 jsonb로 저장합니다.
-- override_of: 매주 반복 일정 중 "오늘만 시간 조정"(지각 등)을 위해 만들어진 1회성 항목이면,
-- 원래의 반복 일정(scheduleEntries) id를 가리킵니다. 되돌리기(초기화) 시 이 값으로 원본을 찾습니다.
-- dismissal_mode: 'time'(정해진 시간에 귀가, 기본) | 'condition'(조건 완료 시 귀가, 시간 무관) | 'either'(조건 완료하면 시간 전에도 귀가 가능)
-- dismissal_condition: 담당 선생님이 적어두는 귀가 조건 설명 (예: "쎈 수2 3단원 다 풀고 오답노트까지 작성하면 귀가")
create table if not exists schedule_entries (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  start_time text not null,
  end_time text not null,
  recurrence text not null, -- 'weekly' | 'once'
  day_of_week int,
  date date,
  custom_tasks jsonb,
  override_of text,
  dismissal_mode text,
  dismissal_condition text
);
alter table schedule_entries add column if not exists override_of text;
alter table schedule_entries add column if not exists dismissal_mode text;
alter table schedule_entries add column if not exists dismissal_condition text;

create table if not exists schedule_skips (
  id text primary key,
  schedule_entry_id text not null references schedule_entries(id) on delete cascade,
  date date not null
);

-- tasks(체크리스트 항목 배열)와 seat_snapshot은 구조가 자유롭고 세션마다 달라 jsonb로 저장합니다.
-- dismissal_mode/dismissal_condition: 세션 생성 시 그날의 일정(scheduleEntries)에서 복사되어 옵니다.
-- condition_met: 관리자가 "조건을 충족했다"고 확인 체크하는 값.
-- early_leave_reason: 조건을 충족하지 못했지만(또는 시간이 안 됐지만) 몸이 아프거나 급한 사정 등으로
--   관리자가 예외적으로 조기 귀가시킬 때 남기는 사유.
create table if not exists sessions (
  id text primary key,
  date date not null,
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  teacher text,
  planned_start text,
  planned_end text,
  arrival_time text,
  end_time text,
  seat_id text,
  seat_snapshot jsonb,
  status text not null default '미배정',
  note text,
  tasks jsonb,
  dismissal_mode text,
  dismissal_condition text,
  condition_met boolean not null default false,
  early_leave_reason text
);
alter table sessions add column if not exists dismissal_mode text;
alter table sessions add column if not exists dismissal_condition text;
alter table sessions add column if not exists condition_met boolean not null default false;
alter table sessions add column if not exists early_leave_reason text;

-- ============================================================
-- Row Level Security
--
-- 예전에는 "로그인만 하면 전체 접근"이었는데, 이러면 회원가입만 해도(온보딩 전이라도) 데이터에
-- 접근할 길이 있었고, 특히 teachers.role을 스스로 'admin'으로 바꿔버릴 위험이 있었습니다.
-- 지금은:
--   1) teachers 테이블에 자기 행이 있는(=온보딩된) 사람만 데이터에 접근할 수 있고,
--   2) role은 관리자만 바꿀 수 있으며, 설령 다른 정책이 뚫리더라도 트리거가 한 번 더 막습니다.
-- ============================================================

-- 로그인은 했지만 teachers에 아직 자기 행이 없는 사람(가입만 하고 온보딩 전, 또는 승인 대기)은
-- 어떤 데이터도 읽거나 쓸 수 없습니다.
create or replace function is_onboarded()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from teachers where auth_user_id = auth.uid());
$$;

-- role이 'admin'인 사람만 통과.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from teachers where auth_user_id = auth.uid() and role = 'admin');
$$;

-- teachers 테이블은 다른 테이블과 다르게 취급합니다: 누구나 접근 가능한 공용 "온보딩/전체 접근" 정책을
-- 그대로 쓰면 학생이 몰래 가입해서 자기 role을 'admin'으로 바꿔버릴 수 있기 때문입니다.
alter table teachers enable row level security;
drop policy if exists "authenticated full access" on teachers;
drop policy if exists "teachers select" on teachers;
drop policy if exists "teachers insert self" on teachers;
drop policy if exists "teachers update" on teachers;
drop policy if exists "teachers delete" on teachers;

-- 읽기: 로그인한 사람이면 누구나(온보딩 전이라도) 선생님 목록 정도는 볼 수 있어야
-- 로그인 후 "선생님 등록" 화면이나 반 배정 드롭다운이 동작합니다.
create policy "teachers select" on teachers for select using (auth.role() = 'authenticated');

-- 추가: 자기 자신의 계정을 처음 온보딩할 때만. role은 무조건 'teacher'로만 만들 수 있어서
-- 가입 시점에 스스로 관리자 행을 만들어버리는 걸 막습니다.
create policy "teachers insert self" on teachers for insert
  with check (auth_user_id = auth.uid() and coalesce(role, 'teacher') = 'teacher');

-- 수정: 관리자는 전부 수정 가능, 본인은 자기 이름 정도는 스스로 고칠 수 있게 허용하되
-- role 값 자체는 아래 트리거가 한 번 더 막아줍니다(관리자가 아니면 role이 바뀌지 않음).
create policy "teachers update" on teachers for update
  using (is_admin() or auth_user_id = auth.uid())
  with check (is_admin() or auth_user_id = auth.uid());

-- 삭제: 관리자만.
create policy "teachers delete" on teachers for delete using (is_admin());

-- 방어선(2중 안전장치): UPDATE 정책이 어떻게 되어 있든, 관리자가 아닌 사람이 role을 바꾸려고 하면
-- 무조건 원래 값으로 되돌립니다. 이렇게 해두면 정책 실수로 뚫리더라도 role 상승은 막힙니다.
create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid()가 NULL이면 서비스 역할(Supabase 대시보드의 Table Editor/SQL Editor, service_role 키를 쓰는
  -- 시드 스크립트 등)로 실행 중인 것입니다. 이 경우는 이미 DB 전체에 대한 권한을 가진 상태이므로
  -- (이 트리거로 막아도 의미가 없고, 오히려 최초 관리자 부트스트랩을 막아버리는 부작용이 있었습니다) 손대지 않습니다.
  -- 일반 로그인 사용자(anon key + RLS)가 auth.uid()를 가진 채로 관리자가 아닌데 role을 바꾸려는 경우에만 막습니다.
  if auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;
drop trigger if exists teachers_prevent_role_escalation on teachers;
create trigger teachers_prevent_role_escalation
  before update on teachers
  for each row execute function prevent_self_role_escalation();

-- 그 외 테이블들: teachers에 자기 행이 있는(온보딩된) 사람이면 읽고 쓸 수 있습니다.
-- 클리닉실 운영 특성상 선생님/관리자가 서로 학생 데이터를 같이 봐야 해서, 여기까지는
-- admin/teacher 구분 없이 "온보딩된 사람이면 전체 접근"으로 둡니다. 더 세밀한 제한(예: 자기 반만)이
-- 필요해지면 이 부분만 나중에 손보면 됩니다.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'students','courses','enrollments','course_curriculum',
      'assignment_templates','student_assignments','material_library','teacher_notes',
      'exam_sessions','exam_session_participants','seats','room_markers',
      'schedule_entries','schedule_skips','sessions','app_settings'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "authenticated full access" on %I;', t);
    execute format('drop policy if exists "onboarded full access" on %I;', t);
    execute format(
      'create policy "onboarded full access" on %I for all using (is_onboarded()) with check (is_onboarded());',
      t
    );
  end loop;
end $$;
