#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_file="$repo_root/electron/ios-device-capture.swift"
bundle_dir="$repo_root/public/ios-device-capture/ToScreenIOSCapture.app"
output_file="$bundle_dir/Contents/MacOS/ToScreenIOSCapture"
build_dir="$(mktemp -d -t toscreen-ios-capture-build)"
export CLANG_MODULE_CACHE_PATH="$build_dir/clang-module-cache"
cleanup() {
  case "$build_dir" in
    /tmp/toscreen-ios-capture-build.*|/private/tmp/toscreen-ios-capture-build.*|/var/folders/*/T/toscreen-ios-capture-build.*|/private/var/folders/*/T/toscreen-ios-capture-build.*) rm -rf "$build_dir" ;;
    *) printf 'Refusing to remove unexpected build directory: %s\n' "$build_dir" >&2 ;;
  esac
}
trap cleanup EXIT
mkdir -p "$bundle_dir/Contents/MacOS"
xcrun swiftc -O -target arm64-apple-macosx14.0 "$source_file" -o "$build_dir/helper-arm64"
xcrun swiftc -O -target x86_64-apple-macosx14.0 "$source_file" -o "$build_dir/helper-x86_64"
xcrun lipo -create "$build_dir/helper-arm64" "$build_dir/helper-x86_64" -output "$output_file"
chmod 755 "$output_file"
xcrun lipo "$output_file" -verify_arch arm64 x86_64
