#!/bin/bash
set -Ee
INPUT_FILE="$1"
DESTINATION_DIR="$2"

ffmpeg -hide_banner \
-f concat \
-safe 0 -i $INPUT_FILE \
-c:v copy \
-c:a aac \
-b:a 128k \
-y $DESTINATION_DIR
