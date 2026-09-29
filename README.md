# 素材搜索下载器 (sucai)

Windows 桌面素材搜索下载工具（Electron + React + TypeScript）：一个界面聚合搜索 9 个免费图库 / 素材源，缩略图预览、大图预览、批量下载到本地。

## 聚合的素材源

| 来源 | 类型 |
|---|---|
| Unsplash / Pexels / Pixabay | 高质量图片 |
| Flickr | 图片 |
| Wikimedia Commons | 图片 |
| Giphy | GIF |
| Vimeo | 视频缩略图 |
| Art Institute of Chicago / Met Museum | 博物馆藏品图像 |

## 运行

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
