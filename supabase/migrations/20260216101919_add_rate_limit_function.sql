create table if not exists api_rate_limits (
  identifier text primary key,
  window_start timestamptz not null,
  request_count integer not null,
  updated_at timestamptz default current_timestamp
);

create or replace function check_rate_limit(
  p_identifier text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, remaining integer) as $$
declare
  v_now timestamptz := current_timestamp;
  v_window_start timestamptz;
  v_count integer;
begin
  insert into api_rate_limits (identifier, window_start, request_count, updated_at)
  values (p_identifier, v_now, 1, v_now)
  on conflict (identifier) do update
  set request_count = case
        when api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval then 1
        else api_rate_limits.request_count + 1
      end,
      window_start = case
        when api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval then v_now
        else api_rate_limits.window_start
      end,
      updated_at = v_now
  returning api_rate_limits.request_count, api_rate_limits.window_start
  into v_count, v_window_start;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  return next;
end;
$$ language plpgsql;
