# Phase 1 结构化用户验收入口

默认命令是只读的：

```bash
npm run accept:phase1
```

它列出 UA-01..UA-08、审计表实时的 Completed/Not completed 数量、每项机器证据、真人操作、当前签字状态和所需确认短语。机器门禁通过只代表证据准备完成，不会自动修改 `Accepted`。

用户完成对应实机动作并明确确认后，才允许逐项写入：

```bash
npm run accept:phase1 -- --accept UA-03 --confirmed-by "用户姓名" --confirmation "I ACCEPT UA-03" --note "实机拖拽、磁吸和导出已确认"
```

不存在 `accept-all`。UA-08 只有在 UA-01..UA-07 全部已由用户签字后才能执行，并要求独立放行确认：

```bash
npm run accept:phase1 -- --accept UA-08 --confirmed-by "用户姓名" --confirmation "I RELEASE PHASE 1"
```

Runner 不会启动或伪造实机操作，不会根据测试结果代替用户签字，也不会在 UA-01..UA-07 未完成时写入 `Released / 已放行`。
