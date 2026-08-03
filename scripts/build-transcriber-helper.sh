#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_file="$repo_root/electron/transcribe.swift"
bundle_dir="$repo_root/public/transcriber/ToScreenTranscriber.app"
output_file="$bundle_dir/Contents/MacOS/ToScreenTranscriber"
build_dir="$(mktemp -d -t toscreen-transcriber-build)"
export CLANG_MODULE_CACHE_PATH="$build_dir/clang-module-cache"
export SWIFT_MODULECACHE_PATH="$build_dir/swift-module-cache"

cleanup() {
  case "$build_dir" in
    /tmp/toscreen-transcriber-build.*|/private/tmp/toscreen-transcriber-build.*|/var/folders/*/T/toscreen-transcriber-build.*|/private/var/folders/*/T/toscreen-transcriber-build.*) rm -rf "$build_dir" ;;
    *) printf 'Refusing to remove unexpected build directory: %s\n' "$build_dir" >&2 ;;
  esac
}
trap cleanup EXIT

mkdir -p "$bundle_dir/Contents/MacOS"
xcrun swiftc -O -target arm64-apple-macosx11.0 "$source_file" -o "$build_dir/ToScreenTranscriber-arm64"
xcrun swiftc -O -target x86_64-apple-macosx11.0 "$source_file" -o "$build_dir/ToScreenTranscriber-x86_64"
xcrun lipo -create \
  "$build_dir/ToScreenTranscriber-arm64" \
  "$build_dir/ToScreenTranscriber-x86_64" \
  -output "$output_file"
chmod 755 "$output_file"
xcrun lipo "$output_file" -verify_arch arm64 x86_64
file "$output_file"
