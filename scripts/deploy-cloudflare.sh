#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
printf 'Cloudflare API token (girdi görünmez): '
IFS= read -r -s CLOUDFLARE_API_TOKEN
printf '\n'
if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  printf 'Token girilmedi; dağıtım durduruldu.\n' >&2
  exit 1
fi
export CLOUDFLARE_API_TOKEN
trap 'unset CLOUDFLARE_API_TOKEN' EXIT
npm exec --yes --package=node@24.22.1 -- vinext-cloudflare deploy
