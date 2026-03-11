create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_type varchar(50) not null check (recipient_type in ('sms', 'email', 'push', 'webhook')),
  recipient_address varchar(255) not null,
  message_type varchar(100) not null,
  message_content text not null,
  case_id varchar(255),
  user_id uuid references auth.users,
  status varchar(20) not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retry')),
  attempt_count integer default 0,
  max_attempts integer default 3,
  last_error text,
  sent_at timestamp,
  created_at timestamp default now()
);

create index if not exists idx_notification_queue_status_created
  on public.notification_queue (status, created_at);

create index if not exists idx_notification_queue_case_id
  on public.notification_queue (case_id);

create index if not exists idx_notification_queue_recipient
  on public.notification_queue (recipient_type, recipient_address);
