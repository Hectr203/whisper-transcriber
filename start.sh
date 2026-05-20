#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

print_usage() {
  cat <<EOF
Uso: ./start.sh [all|backend|frontend]

Opciones:
  all       Instala dependencias si faltan y arranca frontend y backend juntos.
  backend   Instala dependencias si faltan y arranca solo el backend.
  frontend  Instala dependencias si faltan y arranca solo el frontend.

Ejemplos:
  ./start.sh all
  ./start.sh backend
  ./start.sh frontend
EOF
}

install_deps_if_needed() {
  local project_dir="$1"
  if [ ! -d "$project_dir/node_modules" ]; then
    echo "Instalando dependencias en $project_dir..."
    npm --prefix "$project_dir" install
  fi
}

run_backend() {
  echo "Iniciando backend..."
  npm --prefix "$ROOT_DIR/backend" run dev
}

run_frontend() {
  echo "Iniciando frontend..."
  npm --prefix "$ROOT_DIR/frontend" run dev -- --open
}

if [ "$#" -eq 0 ]; then
  MODE="all"
else
  MODE="$1"
fi

case "$MODE" in
  all)
    install_deps_if_needed "$ROOT_DIR/backend"
    install_deps_if_needed "$ROOT_DIR/frontend"
    ;;
  backend)
    install_deps_if_needed "$ROOT_DIR/backend"
    ;;
  frontend)
    install_deps_if_needed "$ROOT_DIR/frontend"
    ;;
  -*|help|--help)
    print_usage
    exit 0
    ;;
  *)
    echo "Opción inválida: $MODE"
    print_usage
    exit 1
    ;;
 esac

if [ "$MODE" = "backend" ]; then
  run_backend
elif [ "$MODE" = "frontend" ]; then
  run_frontend
else
  run_backend &
  PID_BACKEND=$!
  run_frontend &
  PID_FRONTEND=$!

  trap 'echo "\nDeteniendo backend y frontend..."; kill "$PID_BACKEND" "$PID_FRONTEND" 2>/dev/null || true; wait' INT TERM
  wait
fi
