# iPhone / iPad 有线录屏真机验收

连接并解锁一台 iPhone 或 iPad，使用 USB 连接 Mac，确认“信任此电脑”，关闭正在占用设备屏幕源的应用，然后运行：

```bash
npm run accept:ios-device
```

命令会严格筛选 AVFoundation 暴露的有线 muxed 屏幕源，只选择一个可用设备，录制约 6 秒并正常停止。随后使用 `ffprobe` 验证输出是非空 MOV、时长不少于 5 秒且至少包含一条视频轨道，同时核对录制结果到 Editor 的 handoff 契约。

多台设备同时可用时默认选择第一台；可通过 `TOSCREEN_IOS_DEVICE_ID` 指定。没有设备、设备锁屏/占用或缺少 `ffprobe` 时，命令返回结构化 `not_completed` 并以状态码 2 结束，不会假报通过。

验收素材保留在命令输出的独立临时目录中。脚本不会读取、移动或删除用户已有录制。
