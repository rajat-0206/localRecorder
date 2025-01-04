#!/bin/bash
set -Ee

INPUT_FILE="$1"
DESTINATION_DIR="$2"

ffmpeg -hide_banner \
-i $INPUT_FILE \
-c:v libx264 -x264opts "keyint=60:min-keyint=60:no-scenecut" \
-preset medium -pix_fmt yuv420p -profile:v high \
\
-map 0:v:0 -s:1 1280x720 -maxrate:1 2.5M -bufsize:1 5M \
\
-map 0:a? \
-c:a "aac" \
-ar "48000" \
-ab "128k" \
-af "aresample=async=1:min_hard_comp=0.1:first_pts=0" \
\
-r 30 -f hls \
\
-var_stream_map "v:0,a:0" \
-hls_playlist_type vod \
-hls_flags append_list+independent_segments+second_level_segment_index \
-hls_time 4 \
-strftime 1 \
-hls_segment_filename "$DESTINATION_DIR/playlist/chunk_%v_file-%Y%m%d-%s-%%09d.ts" \
-master_pl_name hls.m3u8 \
"$DESTINATION_DIR/playlist/chunk_%v_hls.m3u8"