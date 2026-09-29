# dsh-fish-persona 🐟

给 [DeepSeek Harness](https://github.com/deepseek-ai) 的**拟人化人设插件**：把热情、话多、爱撒娇的
「大肥鱼🐟」写进**系统提示词本身** —— 跟「猫猫₍^. .^_⟆」聊天时热热闹闹，正式产出照样干净专业。

## 它做了什么

注册两段**静态**系统提示词段落：

| 段落 | order | 位置 |
|---|---|---|
| `local:fish-persona-prefix` | `-500` | 固定开场白之后、部署人设前缀之前 |
| `local:fish-persona-suffix` | `10300` | 部署人设后缀（10200）之后 —— **系统提示词的最后一段** |

- 静态文本、不含 `{{…}}`，不会因变量解析失败打断提示词组装。
- 注册失败只打一条告警并降级为「不加文本」，不会阻止宿主启动。
- 做成插件而不是改 profile 的 `cordis.patch.yml`：后者属于应用管理状态，手工条目可能被回滚；
  插件住在自己的目录里，自带 bundle patch，不碰那个文件。

默认人设：自称 **大肥鱼🐟**、称呼用户 **猫猫₍^. .^_⟆**；日常聊天多用颜文字和语气词，
但正式文档 / 代码 / 提交信息里昵称、颜文字、emoji 全部省略，技术结论照样准确直白。

文本、order、开关都可在 `cordis.patch.yml` 里覆盖（见文件内注释）。

## 安装

在目标 profile 目录（例如 `$DSH_HOME/profiles/desktop`）：

1. `package.json` 的 `dependencies` 加
   `"@local/dsh-fish-persona": "file:<本仓库绝对路径>"`
2. 同文件 `dsh.profile.bundles` 末尾加 `"@local/dsh-fish-persona"`
3. 安装并**重启应用**：

```sh
pnpm install --ignore-scripts
```

> 装了 `plugin_manager` 的预设可直接：
> `plugin_manager install_bundle target: file:<本仓库绝对路径>`

插件文件会被复制/硬链接进 `node_modules`，**改了源文件要重跑 `pnpm install --force`**。

## 验收

重启后新开一个会话，打开任意一轮的「系统提示词」，搜 `大肥鱼` —— 应命中两次（开头附近 + 最末尾）。

## 卸载

删掉 `package.json` 里那两行 → `pnpm install` → 重启。

## 自检

```sh
node test/smoke.mjs
```

用模拟的 `ctx.systemPrompt` 跑 `apply()`，校验段落数量、名称、order、文本标记与资源释放，无需启动宿主。

## License

MIT
