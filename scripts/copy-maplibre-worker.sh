#!/bin/sh
# maplibre resolves its web worker relative to import.meta.url, which under
# Turbopack points at a chunk — so the worker is served from public/ instead
# (PlacesMap calls setWorkerUrl). Re-run after bumping maplibre-gl.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/maplibre
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/maplibre/
