#!/usr/bin/env bash
# Static security analysis over what ships and the pipeline that ships it.
#
#     npm run sast        (needs semgrep: pipx install semgrep)
#
# Semgrep's open-source engine with the security rules of the public
# semgrep-rules repository, pinned to one commit so a scan gives the same answer
# on every machine and a new upstream rule cannot turn CI red overnight. Bump
# RULES_COMMIT on purpose and fix what the new rules find.
#
# Why not CodeQL: on a private repository it needs GitHub's paid Code Security,
# and its licence does not cover private code without it.
#
# A false positive is silenced on its line with `nosemgrep: <rule>` and a reason.
set -euo pipefail

RULES_REPO=https://github.com/semgrep/semgrep-rules.git
RULES_COMMIT=a84ff9cc2453ca91d581380de4b8b3f272f6f4be
RULES_DIR=${SEMGREP_RULES_DIR:-node_modules/.cache/semgrep-rules}

if [ "$(git -C "$RULES_DIR" rev-parse HEAD 2>/dev/null)" != "$RULES_COMMIT" ]; then
  rm -rf "$RULES_DIR"
  mkdir -p "$RULES_DIR"
  git -C "$RULES_DIR" init -q
  git -C "$RULES_DIR" fetch -q --depth 1 "$RULES_REPO" "$RULES_COMMIT"
  git -C "$RULES_DIR" checkout -q FETCH_HEAD
fi

configs=()
while IFS= read -r dir; do
  configs+=(--config "$dir")
done < <(find "$RULES_DIR"/javascript "$RULES_DIR"/typescript "$RULES_DIR"/html "$RULES_DIR"/yaml/github-actions -type d -name security | sort)

# Unit tests build hostile strings on purpose; they are excluded, not the code they test.
semgrep scan --metrics=off --disable-version-check --error \
  "${configs[@]}" \
  --exclude '*test.ts' \
  app src supabase admin public .github
