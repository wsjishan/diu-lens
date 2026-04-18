#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
DEV_STATE_DIR="$ROOT_DIR/.dev"
DEV_DB_ENV="$DEV_STATE_DIR/local-db.env"
LOG_DIR="$ROOT_DIR/.logs"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
DB_NAME="${DB_NAME:-diu_lens}"

port_listener_line() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sed -n '2p' || true
}

is_port_in_use() {
  local port="$1"
  [[ -n "$(port_listener_line "$port")" ]]
}

ensure_port_available() {
  local port="$1"
  local service_name="$2"
  if ! command -v lsof >/dev/null 2>&1; then
    echo "ERROR: lsof is required to check port availability for $service_name."
    exit 1
  fi
  local line
  line="$(port_listener_line "$port")"
  if [[ -n "$line" ]]; then
    echo "ERROR: Cannot start $service_name. Port $port is already in use."
    echo "Blocking process: $line"
    echo "Stop the process using port $port, then rerun."
    exit 1
  fi
}

stop_pid() {
  local pid="$1"
  local name="$2"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  local waited=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.2
    waited=$((waited + 1))
    if [[ "$waited" -ge 25 ]]; then
      echo "WARN: $name did not stop gracefully. Sending SIGKILL..."
      kill -9 "$pid" 2>/dev/null || true
      break
    fi
  done
}

load_api_env() {
  local env_file="$API_DIR/.env"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"

    key="$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if [[ "$value" =~ ^\'.*\'$ ]] || [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    [[ -z "$key" ]] && continue
    export "$key=$value"
  done < "$env_file"
}

require_backend_bins() {
  if [[ ! -x "$API_DIR/.venv/bin/alembic" ]]; then
    echo "ERROR: $API_DIR/.venv/bin/alembic not found."
    echo "Run: cd $API_DIR && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
  fi
  if [[ ! -x "$API_DIR/.venv/bin/uvicorn" ]]; then
    echo "ERROR: $API_DIR/.venv/bin/uvicorn not found. Install backend dependencies first."
    exit 1
  fi
}

require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "ERROR: pnpm is not installed."
    exit 1
  fi
}

require_web_files() {
  if [[ ! -f "$ROOT_DIR/pnpm-workspace.yaml" ]]; then
    echo "ERROR: pnpm-workspace.yaml not found at project root."
    exit 1
  fi
  if [[ ! -f "$WEB_DIR/package.json" ]]; then
    echo "ERROR: $WEB_DIR/package.json not found."
    exit 1
  fi
}

db_setup() {
  mkdir -p "$DEV_STATE_DIR"

  if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is not installed or not on PATH. Install PostgreSQL client tools first."
    exit 1
  fi

  local role=""
  local mode=""
  local port="5432"
  local socket_dir="/tmp"
  local conn=""
  local database_url=""

  try_connect() {
    local try_mode="$1"
    local host_arg="$2"
    local out=""

    if [[ -n "$host_arg" ]]; then
      out=$(psql -w -h "$host_arg" -d postgres -Atqc "select current_user || '|' || coalesce(inet_server_addr()::text,'') || '|' || current_setting('port') || '|' || current_setting('unix_socket_directories')" 2>/dev/null || true)
    else
      out=$(psql -w -d postgres -Atqc "select current_user || '|' || coalesce(inet_server_addr()::text,'') || '|' || current_setting('port') || '|' || current_setting('unix_socket_directories')" 2>/dev/null || true)
    fi

    if [[ -n "$out" ]]; then
      IFS='|' read -r role _server_addr port socket_dirs <<< "$out"
      [[ -z "$port" ]] && port="5432"
      socket_dir="$(printf '%s' "$socket_dirs" | cut -d',' -f1)"
      [[ -z "$socket_dir" ]] && socket_dir="/tmp"

      mode="$try_mode"
      if [[ "$mode" == "socket" ]]; then
        conn="postgresql://$role@/postgres?host=$socket_dir"
        database_url="postgresql+psycopg://$role@/$DB_NAME?host=$socket_dir"
      else
        conn="postgresql://$role@localhost:$port/postgres"
        database_url="postgresql+psycopg://$role@localhost:$port/$DB_NAME"
      fi
      return 0
    fi

    return 1
  }

  try_connect "socket" "" || try_connect "socket" "/tmp" || try_connect "tcp" "localhost" || {
    echo "ERROR: Could not connect to local PostgreSQL with passwordless local auth."
    echo "Try: brew services start postgresql@16"
    echo "Then test: psql -d postgres"
    echo "If your setup requires password auth, set DATABASE_URL manually in apps/api/.env and rerun."
    exit 1
  }

  local db_exists
  db_exists=$(psql "$conn" -Atqc "select 1 from pg_database where datname='$DB_NAME'" || true)
  if [[ "$db_exists" != "1" ]]; then
    echo "Creating database $DB_NAME..."
    psql "$conn" -v ON_ERROR_STOP=1 -qc "create database $DB_NAME;"
  fi

  cat > "$DEV_DB_ENV" <<EOF
DATABASE_URL=$database_url
API_DATABASE_URL=$database_url
PG_CONN=$conn
PG_ROLE=$role
PG_MODE=$mode
PG_PORT=$port
PG_SOCKET_DIR=$socket_dir
DB_NAME=$DB_NAME
EOF

  echo "PostgreSQL detected: role=$role mode=$mode db=$DB_NAME"
  echo "DATABASE_URL=$database_url"
}

migrate() {
  db_setup
  require_backend_bins
  load_api_env
  # shellcheck disable=SC1090
  source "$DEV_DB_ENV"
  export DATABASE_URL
  export API_DATABASE_URL
  (
    cd "$API_DIR"
    .venv/bin/alembic upgrade head
  )
}

run_api() {
  migrate
  ensure_port_available "$API_PORT" "API"
  load_api_env
  # shellcheck disable=SC1090
  source "$DEV_DB_ENV"
  export DATABASE_URL
  export API_DATABASE_URL
  echo "Starting API at http://127.0.0.1:$API_PORT"
  exec "$API_DIR/.venv/bin/uvicorn" app.main:app --app-dir "$API_DIR" --host 127.0.0.1 --port "$API_PORT" --reload
}

run_web() {
  require_pnpm
  require_web_files
  ensure_port_available "$WEB_PORT" "web"
  echo "Starting web at http://127.0.0.1:$WEB_PORT"
  cd "$ROOT_DIR"
  exec pnpm --filter web exec next dev --port "$WEB_PORT"
}

run_dev() {
  migrate
  require_pnpm
  require_web_files
  ensure_port_available "$API_PORT" "API"
  ensure_port_available "$WEB_PORT" "web"

  mkdir -p "$LOG_DIR"
  local api_log="$LOG_DIR/api.dev.log"
  local web_log="$LOG_DIR/web.dev.log"
  : > "$api_log"
  : > "$web_log"

  load_api_env
  # shellcheck disable=SC1090
  source "$DEV_DB_ENV"
  export DATABASE_URL
  export API_DATABASE_URL

  echo "Starting API and web..."
  echo "API: http://127.0.0.1:$API_PORT"
  echo "WEB: http://127.0.0.1:$WEB_PORT"
  echo "Logs: $api_log, $web_log"

  "$API_DIR/.venv/bin/uvicorn" app.main:app --app-dir "$API_DIR" --host 127.0.0.1 --port "$API_PORT" --reload >"$api_log" 2>&1 &
  local api_pid=$!

  (
    cd "$ROOT_DIR"
    pnpm --filter web exec next dev --port "$WEB_PORT"
  ) >"$web_log" 2>&1 &
  local web_pid=$!

  local tail_api_pid=""
  local tail_web_pid=""
  local exit_status=0
  local shutting_down=0

  cleanup() {
    if [[ "$shutting_down" -eq 1 ]]; then
      return 0
    fi
    shutting_down=1

    stop_pid "$api_pid" "API"
    stop_pid "$web_pid" "web"
    stop_pid "$tail_api_pid" "API log tail"
    stop_pid "$tail_web_pid" "web log tail"
  }

  on_interrupt() {
    echo
    echo "Stopping API and web..."
    exit_status=130
    cleanup
    exit "$exit_status"
  }

  trap on_interrupt INT TERM
  trap cleanup EXIT

  tail -n +1 -f "$api_log" | sed -u 's/^/[api] /' &
  tail_api_pid=$!
  tail -n +1 -f "$web_log" | sed -u 's/^/[web] /' &
  tail_web_pid=$!

  while true; do
    if ! kill -0 "$api_pid" 2>/dev/null; then
      wait "$api_pid" || exit_status=$?
      if [[ "$exit_status" -ne 0 ]]; then
        echo "ERROR: API process exited unexpectedly (status $exit_status). Stopping web..."
      else
        echo "INFO: API process exited. Stopping web..."
      fi
      break
    fi
    if ! kill -0 "$web_pid" 2>/dev/null; then
      wait "$web_pid" || exit_status=$?
      if [[ "$exit_status" -ne 0 ]]; then
        echo "ERROR: web process exited unexpectedly (status $exit_status). Stopping API..."
      else
        echo "INFO: web process exited. Stopping API..."
      fi
      break
    fi
    sleep 1
  done

  cleanup
  exit "$exit_status"
}

cmd="${1:-help}"
case "$cmd" in
  db-setup)
    db_setup
    ;;
  migrate)
    migrate
    ;;
  api)
    run_api
    ;;
  web)
    run_web
    ;;
  dev)
    run_dev
    ;;
  *)
    echo "Usage: $0 {db-setup|migrate|api|web|dev}"
    exit 1
    ;;
esac
