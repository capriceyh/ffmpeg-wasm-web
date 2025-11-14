import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const { createApp, ref, computed, onMounted } = window.Vue;

createApp({
  setup() {
    const ffmpeg = new FFmpeg();
    const loaded = ref(false);
    const file = ref(null);
    const threads = ref(4);
    const progressText = ref('');
    const logText = ref('');
    const previewURL = ref('');
    const showPreview = ref(false);
    const downloadURL = ref('');
    const showDownload = ref(false);
    const canRun = computed(() => !!file.value);

    function appendLog(msg) {
      logText.value += (msg.endsWith('\n') ? msg : msg + '\n');
    }

    ffmpeg.on('log', ({ message }) => appendLog(message));
    ffmpeg.on('progress', ({ progress, time }) => {
      progressText.value = `进度: ${(progress * 100).toFixed(1)}% 时间: ${time ?? ''}`;
    });

    const baseURL = '/ffmpeg';

    async function ensureLoaded() {
      if (loaded.value) return;
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });
      loaded.value = true;
    }

    function onFileChange(e) {
      const f = e.target.files?.[0] || null;
      file.value = f;
    }

    async function run() {
      const f = file.value;
      if (!f) return;
      logText.value = '';
      progressText.value = '';
      showPreview.value = false;
      showDownload.value = false;
      try {
        await ensureLoaded();
        const inputName = 'input.ts';
        const audioName = 'audio.m4a';
        const videoName = 'video.mp4';
        const outputName = 'output.mp4';
        const t = Math.max(1, Math.min(8, Number(threads.value) || 4));
        appendLog('写入输入文件...');
        await ffmpeg.writeFile(inputName, await fetchFile(f));
        appendLog('提取音频...');
        await ffmpeg.exec(['-i', inputName, '-vn', '-c:a', 'copy', '-threads', String(t), audioName]);
        appendLog('提取仅视频轨...');
        await ffmpeg.exec(['-i', inputName, '-an', '-c:v', 'copy', '-movflags', 'faststart', '-threads', String(t), videoName]);
        appendLog('融合音视频为 MP4...');
        await ffmpeg.exec(['-i', videoName, '-i', audioName, '-c:v', 'copy', '-c:a', 'copy', '-movflags', 'faststart', '-shortest', '-threads', String(t), outputName]);
        appendLog('读取输出文件...');
        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        previewURL.value = url;
        showPreview.value = true;
        downloadURL.value = url;
        showDownload.value = true;
      } catch (e) {
        appendLog(`错误: ${e?.message || e}`);
      }
    }

    onMounted(async () => {
      appendLog('初始化中...');
      try {
        await ensureLoaded();
        appendLog('FFmpeg 已加载');
      } catch (e) {
        appendLog('加载失败，可能是浏览器不支持 SharedArrayBuffer 或跨源隔离未启用');
      }
    });

    return {
      threads,
      progressText,
      logText,
      previewURL,
      showPreview,
      downloadURL,
      showDownload,
      canRun,
      onFileChange,
      run,
    };
  },
}).mount('#app');
