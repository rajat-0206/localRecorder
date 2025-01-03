from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from datetime import datetime
import subprocess
from pathlib import Path

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'

def ensure_upload_directory():
    Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

@app.route('/upload_chunk', methods=['POST'])
def upload_chunk():
        ensure_upload_directory()
        video_chunk = request.files.get('chunk')
        video_name = f"{request.form.get('video_name')}/playlist"
        chunk_name = request.form.get('sequence')

        if not video_chunk:
            return jsonify({"error": "Missing chunk"}), 400
        
        os.makedirs(os.path.join(UPLOAD_FOLDER, video_name), exist_ok=True)
    
        temp_path = os.path.join(UPLOAD_FOLDER, f'temp_{chunk_name}.webm')
        video_chunk.save(temp_path)
        
        output_ts = os.path.join(UPLOAD_FOLDER, f'{video_name}/{chunk_name}.ts')
        
        ffmpeg_command = [
            'ffmpeg',
            '-i', temp_path,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-f', 'mpegts',
            '-muxdelay', '0',
            '-y',
            output_ts
        ]
        
        process = subprocess.run(
            ffmpeg_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if process.returncode != 0:
            raise Exception(f"FFmpeg error: {process.stderr.decode()}")
            
        os.remove(temp_path)
        
        return jsonify({
            "message": "Chunk saved successfully",
            "location": output_ts
        }), 200

@app.route('/preprocess', methods=['POST'])
def preprocess():
    video_name = request.form.get('video_name')
    chunk_dir = os.path.join(UPLOAD_FOLDER, f"{video_name}/playlist")
    MAIN_MANIFEST = '''#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=275000,CODECS="avc1.42001e,mp4a.40.2",RESOLUTION=192x1080
playlist/playlist.m3u8
'''
    with open(os.path.join(UPLOAD_FOLDER, f'{video_name}/mainManifest.m3u8'), 'w') as f:
        f.write(MAIN_MANIFEST)
    
    ts_chunks = sorted([f for f in os.listdir(chunk_dir) if f.endswith('.ts')], key=lambda x: int(x.split('.')[0]))
    SUB_MANIFEST = '''#EXTM3U
#EXT-X-VERSION:4
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
'''

    with open(os.path.join(UPLOAD_FOLDER, f'{video_name}/playlist/playlist.m3u8'), 'w') as f:
        f.write(SUB_MANIFEST)
        for i, ts_chunk in enumerate(ts_chunks):
            f.write(f'#EXTINF:3.000000,\n')
            f.write(f'{ts_chunk}\n')
        f.write('#EXT-X-ENDLIST\n')
    
    return jsonify({"message": "All chunks converted successfully"}), 200


@app.route('/stream/<video_name>/mainmanifest.m3u8')
def serve_playlist(video_name):
    playlist_path = os.path.join(UPLOAD_FOLDER, f'{video_name}/mainManifest.m3u8')
    if not os.path.exists(playlist_path):
        return "Playlist not found", 404
    return send_file(playlist_path, mimetype='application/vnd.apple.mpegurl')

@app.route('/stream/<video_name>/playlist/<chunk_name>')
def serve_chunk(video_name, chunk_name):
    chunk_path = os.path.join(UPLOAD_FOLDER, f'{video_name}/playlist/{chunk_name}')
    if not os.path.exists(chunk_path):
        return "Chunk not found", 404
    return send_file(chunk_path, mimetype='video/mp2t')

@app.route('/generate_mp4', methods=['POST'])
def generate_mp4():
    video_name = request.form.get('video_name')
    return_mp4 = request.form.get('return_mp4', False)
    chunk_dir = os.path.join(UPLOAD_FOLDER, f"{video_name}/playlist")
    output_mp4 = os.path.join(UPLOAD_FOLDER, f'{video_name}.mp4')

    if not os.path.exists(chunk_dir):
        return jsonify({"error": "No video chunks found"}), 404

    if os.path.exists(output_mp4):
        if return_mp4:
            return send_file(output_mp4, mimetype='video/mp4')
        return jsonify({
            "message": "MP4 already generated",
            "location": output_mp4
        }), 200
    
    ffmpeg_command = [
    'ffmpeg',
    '-i',
    os.path.join(chunk_dir, 'playlist.m3u8'),
    '-vf', 'setpts=PTS-STARTPTS',
    '-af', 'aresample=async=1',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-y',
    output_mp4
]
    process = subprocess.run(
        ffmpeg_command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    if process.returncode != 0:
        raise Exception(f"FFmpeg error: {process.stderr.decode()}")
    
    if return_mp4:
        return send_file(output_mp4, mimetype='video/mp4')
        
    return jsonify({
        "message": "MP4 generated successfully",
        "location": output_mp4
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=8000)

