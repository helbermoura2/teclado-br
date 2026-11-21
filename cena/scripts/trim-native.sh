#!/usr/bin/env bash
set -euo pipefail
cena_root="$(cd "$1" && pwd)"
strip_tool="$ANDROID_HOME/ndk/28.0.13004108/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip"
for target_abi in arm64-v8a x86_64; do
  library="$cena_root/android/app/src/main/jniLibs/$target_abi/libcenallm.so"
  before_bytes=$(stat -c %s "$library")
  "$strip_tool" --strip-unneeded "$library"
  after_bytes=$(stat -c %s "$library")
  echo "Local AI $target_abi: $before_bytes -> $after_bytes bytes (runtime exports retained)"
done
