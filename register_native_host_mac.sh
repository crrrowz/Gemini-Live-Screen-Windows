#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_DEST="$HOST_DIR/com.gemini.live.screen.host.json"
COMPANION_SH="$DIR/native_host/companion.sh"

echo "=========================================================="
echo "  Registering Gemini Live Screen Native Host (macOS)..."
echo "=========================================================="

mkdir -p "$HOST_DIR"
chmod +x "$COMPANION_SH"

# Write macOS manifest
cat <<EOF > "$MANIFEST_DEST"
{
  "name": "com.gemini.live.screen.host",
  "description": "Native Messaging Companion Host for Gemini Live Screen",
  "path": "$COMPANION_SH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*/*"
  ]
}
EOF

echo ""
echo "[Success] Native Messaging Host registered successfully on macOS!"
echo "Path: $MANIFEST_DEST"
