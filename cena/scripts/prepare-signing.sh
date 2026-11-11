#!/usr/bin/env bash
set -euo pipefail
# A private draft keeps the prototype signing identity beyond ephemeral CI caches.
# Never publish this draft or upload the key as a build artifact.
test "$(gh repo view "$GITHUB_REPOSITORY" --json isPrivate --jq .isPrivate)" = true
mkdir -p "$(dirname "$CENA_KEYSTORE_PATH")"
for attempt in $(seq 1 60); do
  if gh release download cena-internal-signing --repo "$GITHUB_REPOSITORY" --pattern cena-preview.keystore --dir "$(dirname "$CENA_KEYSTORE_PATH")" --clobber >/dev/null 2>&1; then
    test -s "$CENA_KEYSTORE_PATH"
    chmod 600 "$CENA_KEYSTORE_PATH"
    exit 0
  fi
  if [ "${1:-}" = initialize ]; then
    # Only the serialized APK build may initialize this identity.
    keytool -genkeypair -keystore "$CENA_KEYSTORE_PATH" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=CENA Preview' >/dev/null 2>&1
    if ! gh release view cena-internal-signing --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
      gh release create cena-internal-signing --repo "$GITHUB_REPOSITORY" --draft --title 'Internal CENA prototype signing — keep private' --notes 'Private CI signing identity. Do not publish or delete: future preview updates depend on this file.'
    fi
    test "$(gh release view cena-internal-signing --repo "$GITHUB_REPOSITORY" --json isDraft --jq .isDraft)" = true
    gh release upload cena-internal-signing "$CENA_KEYSTORE_PATH" --repo "$GITHUB_REPOSITORY"
    chmod 600 "$CENA_KEYSTORE_PATH"
    exit 0
  fi
  sleep 5
done
echo 'Persistent preview signing key unavailable.' >&2
exit 1
