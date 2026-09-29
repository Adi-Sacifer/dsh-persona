# dsh-persona

给 [DeepSeek Harness](https://github.com/deepseek-ai) 的**人设插件**：把「怎么称呼你 / 我叫什么 / 用什么语气」
写进**系统提示词本身** —— 聊天亲切有性格，正式产出照样干净专业。

不写死任何名字：装完跑一次向导，之后随时能改。

## 快速开始

```sh
# 1) 装（在 profile 目录里，见下）
# 2) 配：一次性问几个问题
node setup.mjs
# 3) 重启 DSH
```

向导会问：怎么称呼你、你叫什么、名字后面跟个小尾巴吗、语气、正式产出要不要保持中性。

## 配置

配置写在 `$DSH_HOME/persona.config.json`（**插件外面**，改完只要重启，不用重装）：

| 键 | 默认 | 说明 |
|---|---|---|
| `userName` | `朋友` | 怎么称呼你 |
| `userMark` | 空 | 你的名字后面跟什么（颜文字 / emoji，可留空） |
| `assistantName` | `小助手` | 它叫什么 |
| `assistantMark` | 空 | 它的名字后面跟什么 |
| `tone` | `warm` | `warm` 热情 / `lively` 跳脱 / `calm` 温和 |
| `emojiInChat` | `true` | 聊天里用颜文字和表情 |
| `strictWorkOutput` | `true` | 正式文档 / 代码 / 提交信息保持中性专业 |
| `extra` | 空 | 追加到提示词最后的额外要求 |
| `enabled` | `true` | `false` 关闭 |

命令行也行：

```sh
node setup.mjs --show                              # 看当前配置 + 最终提示词文本
node setup.mjs --set userName=小明 --set assistantName=阿助
node setup.mjs --set tone=calm --set strictWorkOutput=false
node setup.mjs --preset fishcat                    # 内置示例预设
node setup.mjs --reset                             # 恢复默认
```

优先级：**bundle 配置**（profile 的 `cordis.patch.yml` 里那一行的 `config`）
> **`persona.config.json`** > **内置默认值**。

## 它做了什么

注册两段**静态**系统提示词段落：

| 段落 | order | 位置 |
|---|---|---|
| `local:persona-prefix` | `-500` | 固定开场白之后、部署人设前缀之前 |
| `local:persona-suffix` | `10300` | 部署人设后缀（10200）之后 —— **系统提示词的最后一段** |

静态文本、不含 `{{…}}`，不会因变量解析失败打断提示词组装；注册失败只告警并降级为「不加文本」，
不会阻止宿主启动。

## 安装

在目标 profile 目录（例如 `$DSH_HOME/profiles/desktop`）：

1. `package.json` 的 `dependencies` 加 `"@local/dsh-persona": "file:<本仓库绝对路径>"`
2. 同文件 `dsh.profile.bundles` 末尾加 `"@local/dsh-persona"`
3. `pnpm install --ignore-scripts`，然后**重启 DSH**

> 装了 `plugin_manager` 的预设可以直接：
> `plugin_manager install_bundle target: file:<本仓库绝对路径>`

插件文件会被复制/硬链接进 `node_modules`，**改了源码要重跑 `pnpm install --force`**；
改称呼不用——那是配置文件的事。

## 验收

重启后新开一个会话，打开任意一轮的「系统提示词」，搜你设定的名字 —— 应该出现两次（开头附近 + 最末尾）。

## 卸载

删掉 `package.json` 里那两行 → `pnpm install` → 重启。

## 自检

```sh
node test/smoke.mjs
```

离线跑：用假的 `ctx.systemPrompt` 校验段落名称 / order / 称呼渲染 / 配置优先级 / 资源释放，无需启动宿主。

## License

MIT
