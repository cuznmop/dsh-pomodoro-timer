# dsh-pomodoro-timer

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面的番茄钟：**侧栏整页**（专注 / 短休息 / 长休息循环）+ **输入框旁倒计时胶囊**。

[English](README.md) | 简体中文

仓库：<https://github.com/cuznmop/dsh-pomodoro-timer> · 问题反馈：<https://github.com/cuznmop/dsh-pomodoro-timer/issues> · npm：<https://www.npmjs.com/package/dsh-pomodoro-timer>

## 功能

- **侧栏整页** —— 左栏面板列表里的时钟图标，打开带环形进度、控制按钮和统计的完整页面。
- **输入框胶囊** —— 消息框旁的紧凑倒计时，点一下跳到页面；你在对话里工作时它照常走。
- **循环控制** —— 默认专注 25 / 短休息 5 / 长休息 15 分钟，每 4 个番茄进长休息，可开启自动进入下一阶段。
- **操作** —— 开始、暂停、继续、重置当前阶段、跳过当前阶段。
- **统计** —— 本轮第几个番茄、今天完成多少个，跨天自动清零。
- **提示音** —— 阶段自然结束时三声短音（可关闭；浏览器需要一次交互后才允许出声）。
- **刷新不丢** —— 结束时刻写入 `localStorage`，刷新页面后接着倒计时。
- **明暗主题** —— 配色全部用 `--dsw-alias-*` 主题 token；不 import 任何 Harness 客户端包，不会因为内部改动而被打断。
- **中英双语** —— 跟随 GUI 语言设置。

## 环境要求

| 组件 | 要求 |
| --- | --- |
| DeepSeek Harness | 已在 `0.2.0-rc.2` 实测（Web / 桌面版 profile）；只使用公开的客户端 `slots` 与 `locale` 服务，不声明 DSH peer 依赖 |
| DSH profile | 有 Web 界面（`web` 或桌面版）；headless profile 没有 UI |
| Node.js | `^22.19.0` 或 `>=24.0.0`（仅本地自检需要） |

## 安装

```powershell
# 普通 dsh web profile
dsh plugin --profile web add dsh-pomodoro-timer
```

桌面版可以在插件市场页面里装，或走「设置 → 插件」。装完重启 Harness（或刷新页面），左栏面板列表里会出现时钟图标。

## 使用

| 控件 | 行为 |
| --- | --- |
| 开始 / 暂停 | 开始或暂停当前阶段 |
| 重置 | 把当前阶段恢复成完整时长并暂停 |
| 跳过 | 进入下一阶段，不计入番茄数 |
| 设置 | 专注时长、短休息、长休息、几个番茄后长休息、自动接续、提示音 |

暂停状态下改时长会立刻生效；运行中改则从下一阶段开始生效。

状态存在 `localStorage` 的 `dsh.plugin.pomodoro-timer.v1` 键下。

## 卸载

```powershell
dsh plugin --profile web remove dsh-pomodoro-timer
```

## 开发

没有构建步骤：`client.js` 就是发布出去的浏览器 bundle。包里自带离线自检。

```powershell
npm run check     # 对两个半边做语法检查 + 跑离线 bundle 测试
# pnpm run check 等价。如果机器上只有 DSH 自带的那份运行时，
# 先把工作区的 shim 加进 PATH： $env:PATH = "<工作区>\bin;$env:PATH"
```

`test/client.test.mjs` 用模块加载器桩和假的客户端 context 载入 bundle，覆盖注册 id、阶段机、持久化、组件渲染。它证明的是逻辑，**不是**观感——观感要在跑起来的 GUI 里看。

### 目录结构

| 路径 | 作用 |
| --- | --- |
| `package.json` | 清单：bundle patch、client 声明、导出表、图标、发布文件白名单 |
| `cordis.patch.yml` | 插入让浏览器 bundle 进入模块图的 Host 行 |
| `index.js` | Host 半边，故意为空实现 |
| `client.js` | 计时 store、侧栏页面、输入框胶囊、中英字典 |
| `locale/*.json` | 插件卡片标题与描述 |
| `icon.svg` | 插件卡片图标 |
| `test/client.test.mjs` | 离线自检 |

## 说明

- 除了自己那个 `localStorage` 键，这个插件不读写任何东西：没有 Host 服务、没有工具、没有网络访问。
- 它注册进 `sidebar.panellist`、`main` 和 `conversation.composer.dock`；不会替换应用根节点，也不会往 `document.body` 追加内容。

## 许可证

[MIT](LICENSE)
