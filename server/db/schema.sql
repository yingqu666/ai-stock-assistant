create table if not exists users (
  id text primary key,
  phone varchar(20) unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists watchlists (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  stock_code varchar(16) not null,
  stock_name text not null,
  reason text,
  ai_level text,
  group_name text not null default '长期观察',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stock_code)
);

create table if not exists watchlist_groups (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists portfolio (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  stock_code varchar(16) not null,
  stock_name text not null,
  cost_price numeric(18, 4) not null default 0,
  quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  date date not null,
  type varchar(32) not null,
  score integer,
  content jsonb not null,
  source_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  refresh_interval integer not null default 30,
  industries jsonb not null default '[]'::jsonb,
  risk_level varchar(16) not null default '中',
  ai_mode varchar(32) not null default 'fallback',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  date date not null,
  prediction_type varchar(32),
  prediction_content jsonb,
  target_date date,
  market_prediction text,
  sector_prediction jsonb,
  stock_prediction jsonb,
  risk_prediction jsonb,
  actual_result jsonb,
  accuracy_score numeric(5, 2),
  review_status varchar(32),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_feedback (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  question text not null,
  answer text not null,
  rating integer,
  feedback text,
  source text,
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  category varchar(64) not null,
  content text not null,
  source text,
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists investment_journal (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  stock text,
  action varchar(32),
  reason text,
  date date,
  result text,
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_history add column if not exists prediction_type varchar(32);
alter table ai_history add column if not exists prediction_content jsonb;
alter table ai_history add column if not exists target_date date;
alter table ai_history add column if not exists accuracy_score numeric(5, 2);
alter table ai_history add column if not exists review_status varchar(32);
alter table ai_history add column if not exists review_note text;
alter table watchlists add column if not exists group_name text not null default '长期观察';

create index if not exists idx_watchlists_user_id on watchlists(user_id);
create index if not exists idx_watchlists_user_id_group_name on watchlists(user_id, group_name);
create index if not exists idx_watchlist_groups_user_id on watchlist_groups(user_id);
create index if not exists idx_portfolio_user_id on portfolio(user_id);
create index if not exists idx_reports_user_id_date on reports(user_id, date desc);
create index if not exists idx_ai_history_user_id_date on ai_history(user_id, date desc);
create index if not exists idx_ai_history_user_id_target_date on ai_history(user_id, target_date desc);
create index if not exists idx_ai_history_prediction_type on ai_history(prediction_type);
create index if not exists idx_ai_feedback_user_id_created_at on ai_feedback(user_id, created_at desc);
create index if not exists idx_knowledge_user_id_category on knowledge(user_id, category);
create index if not exists idx_investment_journal_user_id_date on investment_journal(user_id, date desc);
