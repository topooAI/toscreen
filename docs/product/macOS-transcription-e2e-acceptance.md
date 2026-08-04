# macOS 本地转录端到端验收

运行：

```bash
npm run accept:transcription
```

验收首先通过真实 `ToScreenTranscriber.app` Bundle 做只读授权预检。默认不会调用 `tccutil`、打开系统设置或请求权限。权限不是 `authorized` 时会返回结构化 `not_completed` 和修复说明。

授权已具备时，命令在独立临时目录生成一段英语合成语音，通过 `/usr/bin/open -n -W ToScreenTranscriber.app --args ...` 启动真实 App Bundle 身份执行本地转录，并要求返回至少一个非空时间分段。桌面应用正式转录 IPC 使用同一条 LaunchServices 路径；禁止直接执行 Bundle 内 binary，因为它与 App Bundle 的 TCC 身份不同。随后自动修改一条字幕、写入并重开项目 JSON，确认用户编辑仍在，并确认 Preview 与 Export 使用的统一 Render Settings 能取得相同字幕。

所有音频、JSONL 和项目证据均保留在输出给出的临时目录，不读取或删除用户已有媒体与项目。
