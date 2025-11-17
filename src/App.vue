<template>
  <div class="wrap">
    <h2>TS 视频多步骤处理（提取音频→提取视频→融合为 MP4）</h2>
    <div class="row">
      <input type="file" accept="video/MP2T, .ts" @change="onFileChange" />
      <button @click="run" :disabled="!canRun">开始处理</button>
    </div>
    <div class="row">
      <label>线程数：</label>
      <input type="number" min="1" max="8" v-model="threads" />
    </div>
    <div class="progress">{{ progressText }}</div>
    <div class="log">{{ logText }}</div>
    <div class="row">
      <video controls style="max-width: 100%;" v-show="showPreview" :src="previewURL"></video>
    </div>
    <div class="row">
      <a :href="downloadURL" download="output.mp4" v-show="showDownload">下载输出 MP4</a>
    </div>
  </div>
</template>

<script>
import { fetchFile } from '@ffmpeg/util'
import { ref, computed, onMounted } from 'vue'

export default {
  setup() {
    const FFmpegClass = window.FFmpegWASM && window.FFmpegWASM.FFmpeg
    let ffmpeg = new FFmpegClass()
    const loaded = ref(false)
    const file = ref(null)
    const threads = ref(4)
    const progressText = ref('')
    const logText = ref('')
    const previewURL = ref('')
    const showPreview = ref(false)
    const downloadURL = ref('')
    const showDownload = ref(false)
    const canRun = computed(() => !!file.value)

    function appendLog(msg) {
      logText.value += (msg.endsWith('\n') ? msg : msg + '\n')
    }

    function bindEvents () {
      ffmpeg.on('log', ({ message }) => appendLog(message))
      ffmpeg.on('progress', ({ progress, time }) => {
        progressText.value = `进度: ${(progress * 100).toFixed(1)}% 时间: ${time || ''}`
      })
    }
    bindEvents()

    const coreMt = { js: '/ffmpeg/ffmpeg-core.js', wasm: '/ffmpeg/ffmpeg-core.wasm' }
    const coreSt = { js: '/ffmpeg-st/ffmpeg-core.js', wasm: '/ffmpeg-st/ffmpeg-core.wasm' }

    async function ensureLoaded() {
      if (loaded.value) return
      try {
        await ffmpeg.load({ coreURL: coreMt.js, wasmURL: coreMt.wasm })
      } catch (e) {
        appendLog('SIMD/线程不可用，切换到非SIMD单线程内核...')
        try { ffmpeg.terminate() } catch (_) {}
        ffmpeg = new FFmpegClass()
        bindEvents()
        await ffmpeg.load({ coreURL: coreSt.js, wasmURL: coreSt.wasm })
      }
      loaded.value = true
    }

    function onFileChange(e) {
      const files = e && e.target && e.target.files ? e.target.files : null
      const f = files && files[0] ? files[0] : null
      file.value = f
    }

    async function run() {
      const f = file.value
      if (!f) return
      logText.value = ''
      progressText.value = ''
      showPreview.value = false
      showDownload.value = false
      try {
        await ensureLoaded()
        const inputName = 'input.ts'
        const audioName = 'audio.m4a'
        const videoName = 'video.mp4'
        const outputName = 'output.mp4'
        const t = Math.max(1, Math.min(8, Number(threads.value) || 4))
        appendLog('写入输入文件...')
        await ffmpeg.writeFile(inputName, await fetchFile(f))
        appendLog('提取音频...')
        await ffmpeg.exec(['-i', inputName, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', '-movflags', 'faststart', '-threads', String(t), audioName])
        appendLog('提取仅视频轨...')
        await ffmpeg.exec(['-i', inputName, '-an', '-c:v', 'copy', '-movflags', 'faststart', '-threads', String(t), videoName])
        appendLog('融合音视频为 MP4...')
        await ffmpeg.exec(['-i', videoName, '-i', audioName, '-c:v', 'copy', '-c:a', 'copy', '-movflags', 'faststart', '-shortest', '-threads', String(t), outputName])
        appendLog('读取输出文件...')
        const data = await ffmpeg.readFile(outputName)
        const blob = new Blob([data.buffer], { type: 'video/mp4' })
        const url = URL.createObjectURL(blob)
        previewURL.value = url
        showPreview.value = true
        downloadURL.value = url
        showDownload.value = true
      } catch (e) {
        appendLog('错误: ' + ((e && e.message) ? e.message : e))
      }
    }

    onMounted(async () => {
      appendLog('初始化中...')
      try {
        await ensureLoaded()
        appendLog('FFmpeg 已加载')
      } catch (e) {
        appendLog('加载失败，可能是浏览器不支持 SharedArrayBuffer 或跨源隔离未启用')
      }
    })

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
      run
    }
  }
}
</script>

<style>
.wrap { font-family: system-ui, sans-serif; margin: 24px; }
.row { margin-bottom: 12px; }
.log { white-space: pre-wrap; background: #111; color: #0f0; padding: 12px; height: 200px; overflow: auto; }
.progress { margin: 8px 0; }
button { padding: 8px 12px; }
</style>