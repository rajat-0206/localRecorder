#!/bin/bash
set -Ee
INPUT_FILE="$1"
DESTINATION_DIR="$2"
ERROR_FILE="$3"

DIRECTORY="$DESTINATION_DIR/playlist/stream_%v"
FPS="30"
PIX_FMT="yuv420p"
GOP_SIZE="60"
PRESET="medium"
CODEC="libx264"
PROFILE="high"
PROBESIZE="50M"
HLS_TIME="4"
V_SIZE_1="1280x720"
VAR_STREAM_MAP="v:0,a:0"

ffmpeg -hide_banner \
-thread_queue_size 1024 -probesize $PROBESIZE \
-i $INPUT_FILE \
-c:v $CODEC -x264opts "keyint=$GOP_SIZE:min-keyint=$GOP_SIZE:no-scenecut" \
-preset $PRESET -pix_fmt $PIX_FMT -profile:v $PROFILE \
\
-map 0:v:0 -s:1 $V_SIZE_1 -maxrate:1 2.5M -bufsize:1 5M \
\
-map 0:a? \
-c:a "aac" \
-ar "48000" \
-ab "128k" \
-af "aresample=async=1:min_hard_comp=0.1:first_pts=0" \
\
-r $FPS -f hls \
\
-var_stream_map "$VAR_STREAM_MAP" \
-hls_playlist_type vod \
-hls_flags append_list+independent_segments+second_level_segment_index \
-hls_time $HLS_TIME \
-strftime 1 \
-hls_segment_filename "$DIRECTORY"_file-%Y%m%d-%s-%%09d.ts \
-master_pl_name hls.m3u8 \
"$DIRECTORY"_hls.m3u8
