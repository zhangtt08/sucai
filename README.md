# sucai — Stock Asset Search & Downloader

One search box for 9 free stock sources — Unsplash, Pexels, Pixabay, Flickr, Wikimedia Commons, Giphy, Vimeo-hosted clips and two museum collections — with previews and batch download, in a single Windows desktop app.
一个界面聚合搜索 9 大免费素材源，缩略图预览、大图预览、批量下载到本地（Windows 桌面应用）。

Hunting for free images and GIFs usually means opening five tabs, searching each site separately, and downloading one file at a time. **sucai** puts all the sources behind a single search bar in an Electron app: one query fans out to every configured source in parallel, results land in one thumbnail grid, and you batch-download whatever you pick.

[中文说明](README.zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-blueviolet)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)

## ✨ Features

- **One query, nine sources** — parallel search with an automatic retry on transient network failures; a failing source is reported without sinking the whole search
- **Three sources need zero setup** — Wikimedia Commons, the Met Museum and the Art Institute of Chicago work out of the box; the rest take a free API key pasted into the in-app settings dialog
- **Preview before you commit** — thumbnail grid plus a full-size preview panel
- **Batch download** — pick multiple assets, watch per-task progress, save to any local folder
- **Local-only secrets** — API keys are stored in app-local settings, never synced or committed
- **Plugin architecture** — every source is a small module in `electron/plugins/`, so adding a source is a single file

## 🚀 Quick Start

Prerequisites: **Node.js 18+** and Windows.

```powershell
git clone https://github.com/zhangtt08/sucai.git
cd sucai
npm install
npm run electron:dev   # dev mode (Vite + Electron)
npm run package        # build a Windows installer into release/
```

After launching, open the in-app Settings dialog and paste free API keys for Unsplash / Pexels / Pixabay / Giphy / Flickr (get them from each platform's developer portal). Wikimedia Commons, Met Museum and the Art Institute of Chicago need no key.

## 🏗️ Architecture

```
src/            React UI (TypeScript) — search bar, thumbnail grid, preview, download panel, settings
electron/       Main process, preload bridge, per-source plugins (plugins/*.js)
resources/      App icons
```

Pipeline: renderer → IPC (`search` / `download`) → plugin registry → every configured plugin queried in parallel (`Promise.allSettled`, one automatic retry) → merged thumbnail grid. Downloads stream through the main process and report progress events back to the UI.

## 📄 License

[MIT](LICENSE)

## 🤖 Agent API

A local HTTP API lets external agents use Sucai as a tool — standalone, no GUI needed:

```bash
npm run agent-api        # serves http://127.0.0.1:8391 (reuses keys saved by the GUI)
```

| Endpoint | Method | Body | Result |
|---|---|---|---|
| `/health` | GET | — | `{ok, tool, version}` |
| `/api/sources` | GET | — | configured sources |
| `/api/search` | POST | `{query, mediaType?, sources?, page?, perPage?}` | `{data: [items], warnings}` |
| `/api/download` | POST | `{item, destDir?}` | `{filePath}` (item = one entry from `/api/search`) |

Keyless sources (`met`, `artic`, `wikimedia`) work out of the box. Port override: `SUCAI_API_PORT`.

## 📄 License
