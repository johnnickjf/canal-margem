#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
unformatted=$(gofmt -l cmd internal integration)
if [ -n "$unformatted" ]; then
  printf 'Arquivos Go sem formatação:\n%s\n' "$unformatted" >&2
  exit 1
fi
go vet ./...
go test -race ./...
