# FFmpeg Web（使用 webpack 与 ffmpeg.wasm）

一个在浏览器中运行 FFmpeg 的示例项目，支持在不具备 SIMD 指令的浏览器环境运行；可上传 TS（MPEG-TS）视频并按多步骤执行 ffmpeg.exec 指令：
- 步骤1：从 TS 提取音频
- 步骤2：从 TS 提取仅视频轨并封装为 MP4
- 步骤3：融合音视频生成最终 MP4
- 支持设置 `-threads` 以尽可能并行处理（跨源隔离满足时）

## 功能特性
- 上传 `.ts` 文件并在浏览器内完成处理，无需后端转码
- 非 SIMD 浏览器兼容：使用通用 UMD 核心构建，无需 SIMD 指令集
- 多步骤流水线：音频提取 → 视频提取 → 融合输出 MP4
- 线程数可调：通过 `-threads N` 让支持的编解码器尽量并行
- 具备日志与进度显示

## 环境要求
- Node：推荐 `>= 16`（最佳 `>= 18`）。旧版 Node（如 v12）可能无法安装部分依赖
- 现代浏览器（Chrome/Edge/Firefox 新版本）：
  - 若需“多线程”，必须满足 `SharedArrayBuffer` 与“跨源隔离”（COOP/COEP）
  - 若不满足，则自动以单线程运行，仍可完成处理

## 安装与启动
1. 安装依赖
   - 在项目根目录执行：
     - `npm install`
   - 如遇到旧版 Node 对 `@ffmpeg/ffmpeg 0.12.x` 的 engine 警告，可升级 Node，或执行 `npm config set engine-strict false` 后再安装
2. 开发模式启动
   - `npm run start`
   - 默认地址：`http://localhost:8080/`
   - 页面提供文件选择、线程数设置、运行按钮、日志与进度、预览与下载
3. 生产构建
   - `npm run build`
   - 将 `dist` 目录部署到你的静态资源服务器
   - 若希望在生产环境启用“多线程”，必须由服务器发送以下响应头：
     - `Cross-Origin-Opener-Policy: same-origin`
     - `Cross-Origin-Embedder-Policy: require-corp`
   - 同时需确保核心资源（`ffmpeg-core.js`/`ffmpeg-core.wasm`）与页面来自同一源或具备合规的跨源策略

## 使用说明
- 选择一个 TS 文件（`.ts` / `video/MP2T`）
- 可调整“线程数”（1~8，默认 4）
- 点击“开始处理”，等待日志与进度更新
- 处理完成后，可直接在页面预览并下载 `output.mp4`

## 处理流程与命令
本项目按以下顺序执行 ffmpeg 命令（均在浏览器内进行）：
1. 音频提取（原封不动拷贝）：
   - `-i input.ts -vn -c:a copy -threads {N} audio.m4a`
2. 视频提取并封装为 MP4（原封不动拷贝）：
   - `-i input.ts -an -c:v copy -movflags faststart -threads {N} video.mp4`
3. 融合音视频生成最终 MP4：
   - `-i video.mp4 -i audio.m4a -c:v copy -c:a copy -movflags faststart -shortest -threads {N} output.mp4`

对应实现位置：
- 加载核心与进度/日志：`src/index.js:22-34`
- 写入输入文件：`src/index.js:57-58`
- 步骤命令执行：`src/index.js:60-67`
- 读取输出并预览下载：`src/index.js:69-77`

## 关键技术点
- 跨源隔离（COOP/COEP）：
  - 为启用 `SharedArrayBuffer` 的多线程，开发服务器已注入响应头（`webpack.config.js:17-20`）
  - 生产环境需在你的服务器同样配置上述响应头
- 非 SIMD 浏览器兼容：
  - 使用 `@ffmpeg/core` 的 UMD 构建及 `ffmpeg-core.wasm`，不强制 SIMD 指令
- 资源复制与加载路径：
  - 构建时将 `node_modules/@ffmpeg/core/dist/umd` 复制至 `dist/ffmpeg`（`webpack.config.js:28-35`）
  - 运行时通过同源路径加载核心：`/ffmpeg/ffmpeg-core.js` 与 `/ffmpeg/ffmpeg-core.wasm`
- 受限与注意事项：
  - WebAssembly 典型内存限制下，单文件大小建议≤2GB
  - 某些编解码器的多线程支持受限；`-threads` 会尽量利用，但并非对所有操作都显著提速

## 常见问题
- 无法安装依赖（Node v12）：
  - 升级 Node 至 `>=16`（推荐 `>=18`），或使用 nvm-windows 管理版本
- 浏览器报错不支持 `SharedArrayBuffer`：
  - 说明当前站点未跨源隔离或浏览器版本过旧。可先以单线程运行（仍可完成处理），或按“生产构建”章节配置 COOP/COEP
- 核心资源加载 404 / CORS 错误：
  - 请确保 `/ffmpeg/ffmpeg-core.js` 与 `/ffmpeg/ffmpeg-core.wasm` 随应用一起部署，并与页面同源或满足跨源策略
- 端口占用：
  - 若 `8080` 被占用，可在命令行传入 `--port 8081` 启动开发服务

## 自定义
- 若需重编码（而非 `copy` 拷贝）：可将命令改为例如：
  - 视频：`-c:v libx264 -preset veryfast -crf 23`
  - 音频：`-c:a aac -b:a 128k`
- 可增减处理步骤（如去重、转码、滤镜），修改 `src/index.js` 中的 `ffmpeg.exec([...])` 命令数组即可

## 目录结构
```
ffmpeg-web/
├─ src/
│  ├─ index.html
│  └─ index.js
├─ dist/               # 打包输出（含拷贝的 ffmpeg 核心资源）
├─ webpack.config.js   # 开发服务器与资源复制配置
├─ package.json        # 依赖与脚本
└─ README.md
```

## 许可证
本示例仓库未显式指定许可证。请注意：`@ffmpeg/core` 的 WebAssembly 由 FFmpeg 源码转译而来，遵循 FFmpeg 及其外部库的许可条款；`@ffmpeg/ffmpeg` 为 MIT 许可的包装层。部署到生产前，请评估你的功能与依赖的许可合规性。
