const recorder = {
    value: null,
    stream: null
};

const ToastTypes = {
    INFO: 'INFO',
    ERROR: 'ERROR'
};
const chunks = [];
let recordingStartTime = null;
let mediaWorker = null;

const recorderConfig = {
    mimeType: 'video/webm;codecs=h264', // H264 is more widely supported for streaming
    videoBitsPerSecond: 2500000, // 2.5 Mbps
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
    const backendUrl = "http://127.0.0.1:8000/upload_chunk";
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
    const backendUrl = "http://127.0.0.1:8000/preprocess";
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
    await preprocess(video_name);
    titleBar.innerHTML = `Processing video: ${video_name}`;
    await new Promise(r => setTimeout(r, 5000));
    playHlsVideo(`http://127.0.0.1:8000/stream/${video_name}/mainmanifest.m3u8`, video_name);
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

const playHlsVideo = async (hls_path, video_name) => {
        console.log("Playing HLS Video", hls_path, video_name);
        videoPreview.style.display = 'none';
        hlsPreview.style.display = 'block';
        const videoSrc = hls_path;
        titleBar.innerHTML = `Playing HLS: ${video_name}`;
    
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(videoSrc);
          hls.attachMedia(hlsPreview);
    
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            hlsPreview.play();
          });
    
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js Error:', data);
          });
        } else if (hlsPreview.canPlayType('application/vnd.apple.mpegurl')) {
          // For browsers like Safari with native HLS support
          hlsPreview.src = videoSrc;
          hlsPreview.addEventListener('loadedmetadata', () => {
            hlsPreview.play();
          });
        } else {
          console.error('HLS is not supported on this browser.');
        }
}

const playRecording = async () => {
    const video_name = prompt("Please enter video name", "default_name");
    playHlsVideo(`http://127.0.0.1:8000/stream/${video_name}/mainmanifest.m3u8`, video_name);
}

const generateMP4 = async () => {
    const video_name = prompt("Please enter video name", "default_name");
    const backendUrl = "http://127.0.0.1:8000/generate_mp4";
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
        showToast({
            message: 'MP4 generated',
            type: ToastTypes.INFO,
            duration: 3000
        });
        titleBar.innerHTML = `MP4 Downloaded: ${video_name}`;
        
    } catch (err) {
        console.error('Error uploading TS chunk', err);
        showToast({
            message: err.message,
            type: ToastTypes.ERROR,
            duration: 3000
        });
    }
}