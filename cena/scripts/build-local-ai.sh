#!/usr/bin/env bash
set -euo pipefail
cena_root="$(cd "$1" && pwd)"
llama_root="$(cd "$2" && pwd)"
for target_abi in arm64-v8a x86_64; do
  cmake -S "$cena_root/android/app/src/main/cpp" -B "$cena_root/android/local-ai-build/$target_abi" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$ANDROID_HOME/ndk/28.0.13004108/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$target_abi" -DANDROID_PLATFORM=android-26 -DANDROID_STL=c++_static \
    -DCMAKE_BUILD_TYPE=Release -DLLAMA_SOURCE_DIR="$llama_root" -DLLAMA_BUILD_NUMBER=12020 -DLLAMA_BUILD_COMMIT=0ec4027a
  cmake --build "$cena_root/android/local-ai-build/$target_abi" --target cenallm -j 3
  mkdir -p "$cena_root/android/app/src/main/jniLibs/$target_abi"
  cp "$cena_root/android/local-ai-build/$target_abi/libcenallm.so" "$cena_root/android/app/src/main/jniLibs/$target_abi/"
done
