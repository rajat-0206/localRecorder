const recorder = {
    value: null,
    stream: null
};

const SERVER_URL = "http://127.0.0.1:8000"

const ToastTypes = {
    INFO: 'INFO',
    ERROR: 'ERROR'
};
const chunks = [];
let recordingStartTime = null;
let mediaWorker = null;

const recorderConfig = {
    mimeType: 'video/mp4;codecs="avc1.4d002a,mp4a.40.2"', // using avc1 for better compatibility
    videoBitsPerSecond: 1500000, // 1.5 Mbps
    audioBitsPerSecond: 128000   // 128 kbps
  };

let video_name = 'default_name';

const startButton = document.querySelector('.start-button');
const stopButton = document.querySelector('.stop-button');
const titleBar = document.querySelector('#title-bar');
const videoPreview = document.querySelector('#video-preview');
const hlsPreview = document.querySelector('#hls-preview');


const showToast = ({ message, type, duration }) => {
    const toast = document.createElement('div');
    toast.classList.add('toast', `toast--${type}`);
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, duration);
};

const uploadToS3 = async (chunks, sequenceNumber) => {
    const backendUrl = `${SERVER_URL}/upload_chunk`;
    try {
        const formData = new FormData();
        console.log("Chunks is", chunks[sequenceNumber])
        
        formData.append('chunk', chunks[sequenceNumber], `${sequenceNumber}.webm`);
        formData.append('sequence', sequenceNumber);
        formData.append('duration', 3000);
        formData.append('video_name', video_name)

        const response = await fetch(backendUrl, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log(`Uploaded`);
        
    } catch (err) {
        console.error('Error uploading TS chunk', err);
        showToast({
            message: 'Error uploading chunk',
            type: ToastTypes.ERROR,
            duration: 3000
        });
    }
};

const preprocess = async (video_name) => {
    const backendUrl = `${SERVER_URL}/preprocess`;
    try {
        const formData = new FormData();
        
        formData.append('video_name', video_name)

        const response = await fetch(backendUrl, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showToast({
            message: 'Preprocessing started',
            type: ToastTypes.INFO,
            duration: 2000
        });
        
    } catch (err) {
        console.error('Error uploading TS chunk', err);
        showToast({
            message: 'Error uploading chunk',
            type: ToastTypes.ERROR,
            duration: 3000
        });
    }
}

const stopLocalRecording = async () => {
    console.log("Stopping recording");
    if (recorder.value?.state === 'recording') {
        await recorder.value.stop();
    }
    recorder.stream.getTracks().forEach(track => track.stop());
    showToast({
        message: 'Recording stopped',
        type: ToastTypes.INFO,
        duration: 1000
    });
    // sleep for 3 seconds to ensure all chunks are uploaded
    await new Promise(r => setTimeout(r, 3000));
    await generateMP4(video_name, false);
    await preprocess(video_name);
    titleBar.innerHTML = `Processing video: ${video_name}`;
    await new Promise(r => setTimeout(r, 5000));
    playHlsVideo(`${SERVER_URL}/stream/${video_name}/hls`, video_name);
    startButton.disabled = false;
    stopButton.disabled = true;
    
};

const startLocalRecording = () => {
    video_name = prompt("Please enter video name", "default_name");
    recordingStartTime = Date.now();
    chunkDuration = 3000;
    sequenceNumber = 0;
    navigator.mediaDevices
        .getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: {
                channelCount: 2,
                sampleRate: 44100
            }
        })
        .then(stream => {
            videoPreview.srcObject = stream;
            recorder.value = new MediaRecorder(stream, recorderConfig);
            recorder.stream = stream;
            recorder.value.ondataavailable = async e => {
                if (e.data.size > 0) {
                    console.log("Data available", sequenceNumber, chunks.length)
                    chunks.push(e.data);
                    await uploadToS3(chunks, sequenceNumber);
                    sequenceNumber++;
                }
            };
            recorder.value.start(chunkDuration + 2000);
            showToast({
                message: 'Recording started',
                type: ToastTypes.INFO,
                duration: 1000
            });

            setInterval(() => {
                if (recorder.value.state === "recording") {
                    console.log("Stopping");
                    recorder.value.stop();
                    console.log("Starting");
                    recorder.value.start(chunkDuration+ 2000);
                }
            }, chunkDuration);
        })
        .catch(err => {
            console.error('Error accessing media devices.', err);
            showToast({
                message: 'Error accessing camera and microphone',
                type: ToastTypes.ERROR,
                duration: 3000
            });
        });
        startButton.disabled = true;
        stopButton.disabled = false;       
};

const playHlsVideo = async (hlsPath, videoName) => {
    console.log("Playing HLS Video", hlsPath, videoName);
    videoPreview.style.display = 'none';
    hlsPreview.style.display = 'block';
    hlsPreview.controls = true;
    const videoSrc = hlsPath;
    titleBar.innerHTML = `Playing HLS: ${videoName}`;

    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: true,
            lowLatencyMode: true,
            backBufferLength: 30,
        });

        // Add more detailed error handling
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js Error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error, attempting to recover...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error, attempting to recover...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('Unrecoverable error, stopping playback');
                        hls.destroy();
                        break;
                }
            }
        });

        // Monitor buffer state
        hls.on(Hls.Events.BUFFER_APPENDING, (event, data) => {
            console.log('Buffer appending:', data.type);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            console.log('Fragment loaded:', data.frag.sn);
        });

        hls.loadSource(videoSrc);
        hls.attachMedia(hlsPreview);

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            // Set initial quality level if needed
            // hls.currentLevel = -1; // -1 for automatic quality selection

            hlsPreview.play().catch(error => {
                console.error('Error playing video:', error);
            });
        });

    } else if (hlsPreview.canPlayType('application/vnd.apple.mpegurl')) {
        // For browsers with native HLS support (Safari)
        hlsPreview.src = videoSrc;
        
        // Add error handling for native playback
        hlsPreview.addEventListener('error', (e) => {
            console.error('Native player error:', hlsPreview.error);
        });

        hlsPreview.addEventListener('loadedmetadata', () => {
            hlsPreview.play().catch(error => {
                console.error('Error playing video:', error);
            });
        });
    } else {
        console.error('HLS is not supported on this browser.');
    }

    hlsPreview.addEventListener('waiting', () => {
        console.log('Video is waiting for more data...');
    });

    hlsPreview.addEventListener('stalled', () => {
        console.log('Video playback has stalled');
    });
};

const playRecording = async () => {
    const video_name = prompt("Please enter video name", "default_name");
    playHlsVideo(`${SERVER_URL}/stream/${video_name}/hls`, video_name);
}

const generateMP4 = async (video_name, download_require=true) => {
    if(video_name === undefined) {
        video_name = prompt("Please enter video name", "default_name");
    }
    const backendUrl = `${SERVER_URL}/generate_mp4`;
    titleBar.innerHTML = `Generating MP4: ${video_name}`;
    try {
        const formData = new FormData();
        
        formData.append('video_name', video_name)
        formData.append('return_mp4', true);

        const response = await fetch(backendUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}: ${response.statusText}`);
        }
        if(download_require) {
        response.blob().then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${video_name}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        });
        titleBar.innerHTML = `MP4 Downloaded: ${video_name}`;
    }
    showToast({
        message: 'MP4 generated',
        type: ToastTypes.INFO,
        duration: 3000
    });
        
    } catch (err) {
        console.error('Error generating mp4', err);
        showToast({
            message: err.message,
            type: ToastTypes.ERROR,
            duration: 3000
        });
    }
}