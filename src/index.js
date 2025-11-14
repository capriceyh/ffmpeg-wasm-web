import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const fileInput = document.getElementById('fileInput');
const runBtn = document.getElementById('runBtn');
const logBox = document.getElementById('log');
const progressBox = document.getElementById('progress');
const preview = document.getElementById('preview');
const downloadLink = document.getElementById('download');
const threadsInput = document.getElementById('threads');

const ffmpeg = new FFmpeg();
let loaded = false;

const baseURL = '/ffmpeg';

function appendLog(msg) {
  logBox.textContent += (msg.endsWith('\n') ? msg : msg + '\n');
  logBox.scrollTop = logBox.scrollHeight;
}

ffmpeg.on('log', ({ message }) => appendLog(message));
ffmpeg.on('progress', ({ progress, time }) => {
  progressBox.textContent = `进度: ${(progress * 100).toFixed(1)}% 时间: ${time ?? ''}`;
});

async function ensureLoaded() {
  if (loaded) return;
  await ffmpeg.load({
    coreURL: `${baseURL}/ffmpeg-core.js`,
    wasmURL: `${baseURL}/ffmpeg-core.wasm`,
  });
  loaded = true;
}

fileInput.addEventListener('change', () => {
  runBtn.disabled = !fileInput.files?.length;
});

runBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  logBox.textContent = '';
  progressBox.textContent = '';
  preview.style.display = 'none';
  downloadLink.style.display = 'none';

  try {
    await ensureLoaded();

    const inputName = 'input.ts';
    const audioName = 'audio.m4a';
    const videoName = 'video.mp4';
    const outputName = 'output.mp4';
    const threads = Math.max(1, Math.min(8, Number(threadsInput.value) || 4));

    appendLog('写入输入文件...');
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    appendLog('提取音频...');
    await ffmpeg.exec(['-i', inputName, '-vn', '-c:a', 'copy', '-threads', String(threads), audioName]);

    appendLog('提取仅视频轨...');
    await ffmpeg.exec(['-i', inputName, '-an', '-c:v', 'copy', '-movflags', 'faststart', '-threads', String(threads), videoName]);

    appendLog('融合音视频为 MP4...');
    await ffmpeg.exec(['-i', videoName, '-i', audioName, '-c:v', 'copy', '-c:a', 'copy', '-movflags', 'faststart', '-shortest', '-threads', String(threads), outputName]);

    appendLog('读取输出文件...');
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    preview.src = url;
    preview.style.display = 'block';
    downloadLink.href = url;
    downloadLink.style.display = 'inline-block';
  } catch (e) {
    appendLog(`错误: ${e?.message || e}`);
  }
});

window.addEventListener('DOMContentLoaded', async () => {
  runBtn.disabled = true;
  appendLog('初始化中...');
  try {
    await ensureLoaded();
    appendLog('FFmpeg 已加载');
  } catch (e) {
    appendLog('加载失败，可能是浏览器不支持 SharedArrayBuffer 或跨源隔离未启用');
  }
});
