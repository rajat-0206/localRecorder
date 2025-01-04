import subprocess
from pathlib import Path

STICHING_SCRIPT = 'stitch_chunks.sh'
TRANSCODING_SCRIPT = 'generate_streaming_chunks.sh'

def _generate_mp4(chunk_dir, output_mp4):
    stich_command = [
        'sh',
        STICHING_SCRIPT,
        chunk_dir,
        output_mp4
    ]
    process = subprocess.run(
        stich_command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    if process.returncode != 0:
        raise Exception(f"Stitching error: {process.stderr.decode()}")

def _trigger_hls_transcode(input_mp4, output_location):
    Path(f"{output_location}/playlist").mkdir(parents=True, exist_ok=True)
    transcode_command = [
        'sh',
        TRANSCODING_SCRIPT,
        input_mp4,
        output_location
    ]
    process= subprocess.run(transcode_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        raise Exception(f"FFmpeg error: {process.stderr.decode()}")