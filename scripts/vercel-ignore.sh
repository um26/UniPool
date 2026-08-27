#!/usr/bin/env bash

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$prev" ]; then
  exit 1
fi

if ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$prev" >/dev/null 2>&1 || exit 1
fi

git diff --quiet "$prev" HEAD -- app/frontend vercel.json scripts/vercel-ignore.sh
