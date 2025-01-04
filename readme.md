# Project Title
Recording and steaming video
## Description
This project records the users video in browser and uploads the recorded chunks to a server. On the server, we convert these chunks into TS (Transport Stream) files, enabling them to be streamed later. Additionally, we provide APIs to convert TS chunks into MP4 format for easier playback.

![Flow diagram](/static/output.png)

Read more about the project [here](https://www.notion.so/Local-Recording-and-streaming-171d18334ad480e5b751e6f986d010a9?pvs=4).

## Prerequisites
Before you begin, ensure you have met the following requirements:
- Python 3.x installed on your machine.
- Access to a terminal or command prompt.

## Installation
### Step 1: Install FFmpeg
FFmpeg is a powerful multimedia framework for handling video, audio, and other multimedia files and streams.

#### For Windows:
1. Download the FFmpeg build from [FFmpeg's official website](https://ffmpeg.org/download.html).
2. Extract the downloaded zip file.
3. Add the `bin` folder to your system's PATH:
   - Right-click on 'This PC' or 'My Computer' and select 'Properties'.
   - Click on 'Advanced system settings'.
   - Click on 'Environment Variables'.
   - Under 'System variables', find the `Path` variable and click 'Edit'.
   - Click 'New' and add the path to the `bin` folder (e.g., `C:\ffmpeg\bin`).
4. Verify the installation by running `ffmpeg -version` in your command prompt.

#### For macOS:
1. Open the Terminal.
2. Install Homebrew if you haven't already:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Install FFmpeg using Homebrew:
   ```bash
   brew install ffmpeg
   ```
4. Verify the installation by running `ffmpeg -version`.

#### For Linux:
1. Open the terminal.
2. Install FFmpeg using your package manager. For example, on Ubuntu:
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
3. Verify the installation by running `ffmpeg -version`.

### Step 2: Install Python Dependencies
1. Run the following command to install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```



## Usage

# Locally
To run the project locally, follow these steps:
1. Install the dependencies as mentioned in the Installation section.
2. Run the server:
   ```bash
   python server.py
   ```
3. Open the url `http://127.0.0.1:8000` in your browser.
