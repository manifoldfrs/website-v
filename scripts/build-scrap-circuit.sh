#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../games/scrap-circuit"
assets="../../public/games/scrap-circuit"
go_bin=go

if [[ "${VERCEL:-}" == "1" ]]; then
  go_version="1.27.3"
  if [[ "$(go env GOVERSION 2>/dev/null || true)" != "go$go_version" ]]; then
    case "$(uname -m)" in
      x86_64)
        arch="amd64"
        sha="65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40"
        ;;
      aarch64)
        arch="arm64"
        sha="a06e99309dbcbdca1a8ccd2282c3ee146e55930886e26b4f1193269587165f49"
        ;;
      *)
        printf 'Unsupported Vercel build architecture: %s\n' "$(uname -m)" >&2
        exit 1
        ;;
    esac
    toolchain="$(mktemp -d)"
    trap 'rm -rf "$toolchain"' EXIT
    archive="$toolchain/go.tar.gz"
    curl --fail --silent --show-error --location --retry 3 \
      "https://go.dev/dl/go${go_version}.linux-${arch}.tar.gz" --output "$archive"
    printf '%s  %s\n' "$sha" "$archive" | sha256sum --check --status
    tar -xzf "$archive" -C "$toolchain"
    go_bin="$toolchain/go/bin/go"
  fi
fi

GOOS=js GOARCH=wasm "$go_bin" build -trimpath -ldflags="-s -w" -o "$assets/fight.wasm" .
cp "$("$go_bin" env GOROOT)/lib/wasm/wasm_exec.js" "$assets/wasm_exec.js"
