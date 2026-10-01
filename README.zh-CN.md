# 素材搜索下载器 (sucai)

[English](README.md)

Windows 桌面素材搜索下载工具（Electron + React + TypeScript）：一个界面聚合搜索 9 个免费图库 / 素材源，缩略图预览、大图预览、批量下载到本地。

## 聚合的素材源

| 来源 | 类型 |
|---|---|
| Unsplash / Pexels / Pixabay | 高质量图片 |
| Flickr | 图片 |
| Wikimedia Commons | 图片 |
| Giphy | GIF |
| Vimeo | 视频缩略图（经 Pixabay 视频接口返回的 Vimeo 托管视频） |
| Art Institute of Chicago / Met Museum | 博物馆藏品图像 |

## 功能特性

- **一次搜索，九源并发**：并行请求所有已启用素材源，网络偶发超时自动重试一次；单个来源失败不影响整体结果，只提示告警
- **三个来源免配置**：Wikimedia Commons、Met Museum、芝加哥艺术学院开箱即用；其余在应用内设置面板（SettingsDialog）粘贴免费 API key 即可
- **先预览再下载**：缩略图网格 + 大图预览
- **批量下载**：多选素材、逐任务进度、保存到任意本地文件夹
- **密钥仅存本地**：API key 保存在本地设置中，不入库、不同步
- **插件化架构**：每个素材源是 `electron/plugins/` 下的一个独立模块

## 运行

前置要求：Node.js 18+，Windows。

```powershell
npm install
npm run electron:dev      # 开发模式（Vite + Electron）
npm run package           # 打包 Windows 安装包（release/）
```

各素材源的 API key 在应用内设置面板（SettingsDialog）配置，密钥保存在本地，不入库。

## 项目结构

```
src/            React 界面（搜索栏 / 缩略图网格 / 预览 / 下载面板 / 设置）
electron/       主进程、预加载脚本与各素材源插件（plugins/*.js）
resources/      应用图标
```

## 许可证

[MIT](LICENSE)

## 🤖 Agent API

内置本地 HTTP 接口，可让你的 agent 把素材搜索/下载当 tool 调用——无需打开界面：

```bash
npm run agent-api        # 服务 http://127.0.0.1:8391（自动复用界面里保存的各平台 key）
```

| 路由 | 方法 | 请求体 | 返回 |
|---|---|---|---|
| `/health` | GET | — | `{ok, tool, version}` |
| `/api/sources` | GET | — | 各平台配置状态 |
| `/api/search` | POST | `{query, mediaType?, sources?, page?, perPage?}` | `{data: [素材列表], warnings}` |
| `/api/download` | POST | `{item, destDir?}` | `{filePath}`（item 取自 `/api/search` 的某条结果） |

`met` / `artic` / `wikimedia` 三源免 key 开箱即用。端口覆盖：`SUCAI_API_PORT`。

## 许可证
