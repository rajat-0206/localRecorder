from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from pathlib import Path
from utils import _generate_mp4, _trigger_hls_transcode

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'

@app.route('/static/<path:path>')
def serve_static(path):
    return send_file(f'static/{path}')

def ensure_upload_directory():
    Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

@app.route('/')
def serve_index():
    return send_file('index.html')

@app.route('/upload_chunk', methods=['POST'])
def upload_chunk():
        ensure_upload_directory()
        video_chunk = request.files.get('chunk')
        video_name = f"{request.form.get('video_name')}/original"
        chunk_name = request.form.get('sequence')

        if not video_chunk:
            return jsonify({"error": "Missing chunk"}), 400
        
        os.makedirs(os.path.join(UPLOAD_FOLDER, video_name), exist_ok=True)
    
        original_path = os.path.join(UPLOAD_FOLDER, f'{video_name}/original_{chunk_name}.mp4')
        video_chunk.save(original_path)
        
        
        return jsonify({
            "message": "Chunk saved successfully",
            "location": original_path
        }), 200

@app.route('/preprocess', methods=['POST'])
def preprocess():
    video_name = request.form.get('video_name')
    output_mp4 = os.path.join(UPLOAD_FOLDER, f'{video_name}/{video_name}.mp4')

    if not os.path.exists(output_mp4):
       return jsonify({"error": "MP4 not found. Please generate mp4 first"}), 404
    
    _trigger_hls_transcode(output_mp4, os.path.join(UPLOAD_FOLDER, f'{video_name}'))

    return jsonify({
        "message": "MP4 generated successfully",
        "location": output_mp4
    }), 200

@app.route('/generate_mp4', methods=['POST'])
def generate_mp4():
    video_name = request.form.get('video_name')
    require_download = request.form.get('return_mp4', 'false') == 'true'
    chunk_dir = os.path.join(UPLOAD_FOLDER, f"{video_name}/original")
    output_mp4 = os.path.join(UPLOAD_FOLDER, f'{video_name}/{video_name}.mp4')

    if not os.path.exists(chunk_dir):
        return jsonify({"error": "No video chunks found"}), 404

    if os.path.exists(output_mp4):
        if require_download:
            return send_file(output_mp4)
        return jsonify({
            "message": "MP4 already generated",
            "location": output_mp4
        }), 200
    
    all_files = os.listdir(chunk_dir)
    mp4_files = sorted([f for f in all_files if f.endswith('.mp4')], key=lambda x: int(x.split('_')[1].split('.')[0]))
    with open(f'{chunk_dir}/input.txt', 'w') as f:
        for webm_file in mp4_files:
            f.write(f"file '{webm_file}'\n")

    _generate_mp4(f'{chunk_dir}/input.txt', output_mp4)

    if require_download:
        return send_file(output_mp4)
    return jsonify({
        "message": "MP4 generated successfully",
        "location": output_mp4
    }), 200

@app.route('/stream/<video_name>/hls')
def serve_playlist(video_name):
    playlist_path = os.path.join(UPLOAD_FOLDER, f'{video_name}/playlist/hls.m3u8')
    if not os.path.exists(playlist_path):
        return "Playlist not found", 404
    return send_file(playlist_path, mimetype='application/vnd.apple.mpegurl')

@app.route('/stream/<video_name>/<chunk_name>')
def serve_chunk(video_name, chunk_name):
    chunk_path = os.path.join(UPLOAD_FOLDER, f'{video_name}/playlist/{chunk_name}')
    if not os.path.exists(chunk_path):
        return "Chunk not found", 404
    
    if chunk_name.endswith('.m3u8'):
        return send_file(chunk_path, mimetype='application/vnd.apple.mpegurl')
    return send_file(chunk_path, mimetype='video/mp2t')

if __name__ == '__main__':
    app.run(debug=True, port=8000)

