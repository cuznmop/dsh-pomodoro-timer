# 把它发到社区：你要做的和你不用做的

这个目录已经是一个**可以直接 `npm publish` 的包**了。下面分成「我已经做完的」和「只有你能做的」。

## 我已经做完的

| 项 | 状态 |
| --- | --- |
| 包名 | `dsh-pomodoro-timer`（我查过 npm，没被占用；`dsh-pomodoro`、`dsh-pomodoro-dock` 已被别人占了） |
| 发布清单 | `package.json` 里有 `dsh.bundle.patch`、`dsh.client`、`exports["./client"]`、`icon`、`files` 白名单、`keywords`（含 **`dsh-plugin`**——市场/目录就是靠这个关键词扫到你） |
| 兼容性 | 不声明 DSH peer 依赖（本插件不 import 任何 Harness 包），所以不会被版本门禁挡住 |
| 双语 README | `README.md`（英文，npm 默认展示）+ `README.zh.md` |
| 许可证 | `LICENSE`（MIT） |
| 自带测试 | `test/client.test.mjs` + `npm run check`（语法 + 离线 bundle 测试） |
| 发布流程 | `.github/workflows/publish.yml`（GitHub Release → npm Trusted Publishing） |
| 包内容自检 | 我用 `pnpm pack` 打过真实 tarball，并在一个**临时 profile** 里从 tarball 装了一遍、用 `dsh --profile … --dump-config` 确认 patch 能组成 |

## 你要做的（三步）

### 0. 先让 `npm` / `pnpm` 能用（DSH 只自带 node + pnpm，没有全局 npm）

DSH 只自带 `node` 和 `pnpm`，**没有装 npm**（npm 不是单独装的东西，它随 Node.js 一起来；这台机器上没有任何全局 Node.js），所以直接敲 `npm` 会报 "无法将 npm 项识别为…"。三条路，选一条：

```powershell
# 办法 A（推荐，零安装、不用管理员）：把工作区的 shim 目录加进当前会话的 PATH
$env:PATH = "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;$env:PATH"
npm --version                  # → 11.21.0（挂在 DSH 自带 node 上的 npm）
pnpm --version                 # → 11.7.0
node --version                 # → v24.21.0
```

`bin\` 下的 `npm.cmd` / `npx.cmd` / `pnpm.cmd` / `node.cmd` 都只是转发到 DSH 自带的那份运行时；npm 本体装在 `bin\npm-runtime\`（约 25 MB，删掉即可回收）。注意这是**当前会话**生效；新开窗口要重新执行那一行。想永久生效（用户级、不需要管理员）：

```powershell
[Environment]::SetEnvironmentVariable('PATH',
  "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;" + [Environment]::GetEnvironmentVariable('PATH','User'),
  'User')
```

```powershell
# 办法 B：装一个系统级 Node.js（自带 npm，会写 Program Files 并弹 UAC）
winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

```powershell
# 办法 C：干脆不用 npm —— pnpm 自己就能 pack / login / publish
pnpm pack --dry-run
pnpm login
pnpm publish --access public
```

下面命令按办法 A 写；办法 B 装好后把 `npm` 换成 `pnpm`（或反过来）即可，参数基本一致（`npm publish --access public` ↔ `pnpm publish --access public`）。

> 小坑：用 shim 调 `npm run <script>` 时，脚本里的 `node` 也要能找到——所以那一行 PATH 是必须的（不能只调 `bin\npm.cmd` 的绝对路径）。另外如果你的 shell 被沙箱限制，npm 默认缓存目录 `%LOCALAPPDATA%\npm-cache` 可能写不进去，加 `--cache <工作区里的目录>` 即可。

### 1. 填作者信息

- `LICENSE`：把 `<YOUR NAME>` 换成你的名字或 ID。
- `package.json`：补上 `repository`、`homepage`、`bugs` 三个字段（现在故意留空，写了错的比不写更糟）：

```jsonc
"repository": { "type": "git", "url": "git+https://github.com/<你的用户名>/dsh-pomodoro-timer.git" },
"homepage": "https://github.com/<你的用户名>/dsh-pomodoro-timer#readme",
"bugs": { "url": "https://github.com/<你的用户名>/dsh-pomodoro-timer/issues" },
```

- `README.md` / `README.zh.md` 顶部可以加上仓库链接和截图（截图放在 `docs/images/`，npm 上显示效果最好；这一步我做不了——我没有浏览器控制能力，也不想拿假图糊上去）。

### 2. 发布到 npm

```powershell
$env:PATH = "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;$env:PATH"
cd C:\Users\33249\Documents\deepseek-harness\default-workspace\plugins\dsh-pomodoro-timer

npm pack --dry-run      # 先看会发出去哪些文件（实测结果见下）
npm login               # 没有账号先去 npmjs.com 注册并验证邮箱
npm publish --access public
```

实测输出（`npm pack --dry-run`，走上面的 shim）：

```
npm notice name: dsh-pomodoro-timer
npm notice version: 1.0.0
npm notice filename: dsh-pomodoro-timer-1.0.0.tgz
npm notice package size: 13.1 kB
npm notice unpacked size: 37.4 kB
npm notice total files: 10
npm notice 1.1kB LICENSE         npm notice 25.2kB client.js      npm notice 403B icon.svg
npm notice 4.3kB README.md       npm notice 341B cordis.patch.yml npm notice 409B index.js
npm notice 3.9kB README.zh.md    npm notice 153B locale/en.json   npm notice 131B locale/zh.json
npm notice 1.4kB package.json
```

- 首次发布前确认包名没被抢：`npm view dsh-pomodoro-timer` 返回 404 就是空的。
- 建议先 `git init` + `git commit` 再发布（`pnpm publish` 默认会做 git 检查；`npm publish` 不做）。用 pnpm 发布想跳过检查就加 `--no-git-checks`。
- `package.json` 里已经写好 `publishConfig.access = public` 和 `registry`，所以 `npm publish` 不带 `--access public` 也行；`npm run release` = 自检 + 发布。
- **想换成自己作用域下的名字**（例如 `@你的用户名/dsh-pomodoro-timer`）要同时改四处，缺一处就会加载失败：
  1. `package.json` 的 `name`
  2. `cordis.patch.yml` 里行的 `name`
  3. `client.js` 第一行 `window.__ModuleLoader__.load({ id: … })`
  4. 如果你在本机 profile 里还链着它，重新 `dsh plugin add` 一次（依赖键变了）

### 2.1 如果发布报 403（必需的一步：先开 2FA）

你本机实测遇到的：

```
npm error code E403
npm error 403 403 Forbidden - PUT https://registry.npmjs.org/dsh-pomodoro-timer
npm error Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

**含义**：npm 现在要求发布必须经过一次**交互式 2FA 挑战**——要么账号开了 2FA（发布时用验证码），要么用「带 bypass 2FA 的细粒度令牌」。你账号当前 `npm profile get` 显示 `two-factor auth: disabled`，而浏览器网页登录拿到的是普通细粒度令牌，两者都不满足，所以 403。**包本身没问题**（那一刻 tarball 已经算好 shasum 了，只是被挡在 PUT 之前）。

官方依据：
- [Restricting npm bypass-2FA granular access tokens](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/)：bypass-2FA 令牌不再能改账号/包权限、**也不配配置 trusted publishing**，都要交互式 2FA。
- 同篇 "Coming next"：**2027 年 1 月起 bypass-2FA 令牌连直接发布也会失去**，只剩「读私有包 + 暂存发布」；官方建议迁到 trusted publishing (OIDC) 或 staged publishing。

**第一步（必做）**：登录 [npmjs.com](https://www.npmjs.com/) → 头像 → **Account** → **Two-Factor Authentication** → 用认证器 App（TOTP）或 passkey 开启。开完之后：

```powershell
$env:PATH = "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;$env:PATH"
cd C:\Users\33249\Documents\deepseek-harness\default-workspace\plugins\dsh-pomodoro-timer

npm publish                 # 开了 2FA 后 npm 会提示输入一次性验证码
# 或者一次给全：
npm publish --otp=123456    # 认证器 App 里的 6 位码
```

之后每次发新版本都要一个验证码（或者走下面的信任发布，彻底免码）。

### 2.2 长期方案：trusted publishing（推荐，免令牌免验证码）

首次发布成功、仓库推上 GitHub 之后，把发布交给 GitHub Actions（我附的 `.github/workflows/publish.yml` 已经写好 OIDC 流程）：

```powershell
# 在仓库目录里执行；注意这一步本身也需要交互式 2FA（会提示验证码）
npm trust github dsh-pomodoro-timer --file publish.yml --repo <你的用户名>/dsh-pomodoro-timer --allow-publish
npm trust list dsh-pomodoro-timer      # 确认配置生效
```

之后只要推一个 GitHub Release（tag 形如 `v1.0.1`），工作流就会校验 tag 与 `package.json` 版本一致后自动 `npm publish --provenance`，**不需要任何 token，也不需要每次输验证码**。

两个注意点：
- 配置信任发布时如果提示无法验证，记得仓库里 `publish.yml` 的**文件名/仓库名**要和上面 `--file` / `--repo` 一致；未经验证的信任发布配置会自动过期（[2026-10-02 变更](https://github.blog/changelog/2026-10-02-unvalidated-npm-trusted-publishing-configurations-now-expire)）。
- 如果你更想保留「人来点一下」的把关，可以用 **staged publishing**（`npm stage publish`，2026-10 起支持创建新包），CI 只暂存，再由维护者用 2FA 批准。

### 2.3 不要走的路

- **bypass-2FA 令牌**：现在建令牌/改权限本身就要 2FA，且 2027-01 起连直接发布也会被砍，别把发布流程建在它上面。
- **把账号 2FA 从 auth-and-writes 降级成 auth-only**：能少输验证码，但会削弱账号安全，不建议。

### 3. 建仓库、让社区目录收录

**本地仓库已经建好并提交了**（`main` 分支，14 个文件，远端已指向 `https://github.com/cuznmop/dsh-pomodoro-timer.git`）：

```powershell
cd C:\Users\33249\Documents\deepseek-harness\default-workspace\plugins\dsh-pomodoro-timer
git log --oneline -1     # fe31721 dsh-pomodoro-timer 1.0.0: sidebar Pomodoro page + composer countdown pill
git ls-files             # 14 个文件（.github/workflows/publish.yml、README×2、LICENSE、client.js、index.js、cordis.patch.yml、icon.svg、locale/*、package.json、test/*、.gitignore）
```

#### 3.1 网络：开加速器后 github.com 可达，但要额外信任加速器的根证书

没有加速器时实测：`github.com`、`codeload.github.com` TCP 443 直接超时（`api.github.com` 反而通）。开了加速器（本机是 **Watt Toolkit / SteamTools，BeyondDimension**）之后连接立刻成功，但**它在中间换了证书**：

| 现象 | 原因 | 解法 |
| --- | --- | --- |
| Node 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Node 默认用自带 CA 列表，不认加速器注入的根证书 | 加 `--use-system-ca`（Node 24 支持），或 `NODE_OPTIONS=--use-system-ca` |
| git 报 `schannel: AcquireCredentialsHandle failed` | 受限 shell 下 schannel 取不到凭据 | 用 OpenSSL 后端 + 导出的 CA：`-c http.sslBackend=openssl -c http.sslCAInfo=<CA bundle>` |
| `sh.exe: couldn't create signal pipe` | 受限 shell 禁止 pipe，git 拉不起 msys 的 sh（凭据助手/终端提示） | 在正常 PowerShell 里执行 git 推送 |

加速器的根证书是 **`SteamTools Certificate`（O=BeyondDimension, C=CN）**，三个轮换版本都在 Windows 证书库里。导出成一个 bundle（放在仓库外，别提交）：

```powershell
$dest = "C:\Users\33249\Documents\deepseek-harness\default-workspace\tools\certs\steamtools-ca.crt"
$cas = Get-ChildItem Cert:\CurrentUser\Root,Cert:\LocalMachine\Root -ErrorAction SilentlyContinue |
       Where-Object { $_.Subject -like '*SteamTools*' } | Sort-Object Thumbprint -Unique
[System.IO.File]::WriteAllText($dest,
  (($cas | ForEach-Object { "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($_.RawData,'InsertLineBreaks') + "`n-----END CERTIFICATE-----" }) -join "`n") + "`n")
```

验证：`git -c http.sslBackend=openssl -c "http.sslCAInfo=$dest" ls-remote https://github.com/git/git.git HEAD` 能返回 SHA 就说明 git 通路好了（已实测通过）。

#### 3.2 建库 + 推送（只差你的凭据）

**路 A：用 GitHub API 推（推荐，令牌不外传）**

[tools/github-push-api.mjs](../../tools/github-push-api.mjs) 走 `api.github.com` 的 Git Data API（blobs → tree → commit → ref）完成建库+推送，顺带填描述/主页/Topics（`dsh-plugin`、`deepseek-harness`、`dsh`、`pomodoro`、`timer`），最后回读远端文件数做校验。已用假令牌验证过链路：只差一个有效令牌。

```powershell
$env:PATH = "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;$env:PATH"

# 1) 建细粒度令牌（github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens）
#    Repository access: All repositories
#    Permissions: Administration = Read and write，Contents = Read and write
#    Expiration: 1 天（用完就删）
$env:GITHUB_TOKEN = '<粘贴令牌>'

# 2) 一条命令：建库 + 推送 + Topics + 校验（在仓库目录里执行，只给 owner/repo 即可）
cd C:\Users\33249\Documents\deepseek-harness\default-workspace\plugins\dsh-pomodoro-timer
node --use-system-ca C:\Users\33249\Documents\deepseek-harness\default-workspace\tools\github-push-api.mjs `
     cuznmop/dsh-pomodoro-timer --topics dsh-plugin,deepseek-harness,dsh,pomodoro,timer

Remove-Item Env:\GITHUB_TOKEN      # 用完立刻清掉，并去 GitHub 撤销这个令牌
```

脚本支持两种传参（`--use-system-ca` 不能省，否则加速器证书会挡住 Node）：

```powershell
# 在仓库目录里：只给 owner/repo
node --use-system-ca <工作区>\tools\github-push-api.mjs cuznmop/dsh-pomodoro-timer --topics a,b
# 在工作区根目录：先给仓库目录，再给 owner/repo
node --use-system-ca tools\github-push-api.mjs plugins\dsh-pomodoro-timer cuznmop/dsh-pomodoro-timer --topics a,b
```

（注意脚本路径：在插件目录里写 `tools\...` 会解析到 `<插件目录>\tools\...`，所以要么给绝对路径，要么用 `..\..\tools\...`。）

脚本不打印令牌、不落盘，只上传本地 `HEAD` 那次提交；会先校验目标目录是不是一个含提交的 git 仓库。两个已知的 GitHub 限制都由脚本自己处理：

- **空仓库**：GitHub 的 Git Data API 不允许在「零提交」的仓库里创建对象（`POST /git/blobs` 返回 `409 Git Repository is empty`）。脚本检测到分支还不存在时，会先用 Contents API 播一个初始提交（用仓库里的 `.gitignore`），再把真正的提交接在它后面——所以你会看到 `seeded the empty repository with .gitignore`。
- **空仓库 + 分支名**：分支名取仓库的 `default_branch`（通常是 `main`），不是写死的。

**路 B：自己在浏览器建库再 push（不用令牌）**

```powershell
# 1) 浏览器打开（不要勾 README / .gitignore / license，保持空库）：
#    https://github.com/new?name=dsh-pomodoro-timer
# 2) 在正常 PowerShell（非受限 shell）里：
cd C:\Users\33249\Documents\deepseek-harness\default-workspace\plugins\dsh-pomodoro-timer
git push -u origin main       # 首次会弹 Git Credential Manager 浏览器授权
```

若路 B 报证书错误，加上仓库本地的 CA 设置即可：

```powershell
git config http.sslBackend openssl
git config http.sslCAInfo "C:\Users\33249\Documents\deepseek-harness\default-workspace\tools\certs\steamtools-ca.crt"
```

**路 C：在另一台能上 GitHub 的机器上推**（连同 `.git` 一起拷过去，`git push -u origin main`）。

> 关了加速器之后，路 B 的 `git push` 又会连接超时；这台机器要保持加速器开着才能推 GitHub。

#### 3.3 推上去之后

- 仓库 **Topics**：`dsh-plugin`、`deepseek-harness`、`dsh`、`pomodoro`、`timer`（`dsh-find-plugin` 这类工具就是按 GitHub 的 `dsh-plugin` topic 搜的；路 A 的脚本会自动设好）。
- 社区目录（[dshbase](https://dshbase.com/zh/plugins/)、[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)、[dshmarket](https://dshmarket.com)）基本都**自动扫 npm 的 `dsh-plugin` 关键词**，npm 发布后通常会被自动收录；几天后还没出现，就去对应目录站提 issue。
- 配 **trusted publishing**（免令牌自动发布，见 2.2；需要仓库已存在且 `publish.yml` 已推送）：

```powershell
npm trust github dsh-pomodoro-timer --file publish.yml --repo cuznmop/dsh-pomodoro-timer --allow-publish
npm trust list dsh-pomodoro-timer
```

> 已发布的 **1.0.0 是在建库之前发的**，所以那份包里没有 `repository` / `homepage` / `bugs`（npm 页面上不会显示仓库链接）。建库之后发一个 **1.0.1** 补上即可（改 `version` → 提交 → `npm publish` 或推 Release 走工作流）。


## 发新版本

```powershell
# 1) 改 package.json 的 version
# 2) 提交并打 tag，推 Release（走工作流），或本地 npm publish
git tag v1.1.0 && git push origin v1.1.0
```

一个容易踩的坑：社区里的 `dshmarket` 对新发布的 npm 版本有一段**新版本等待期**（fresh-release wait），刚发出去的版本短时间内它可能拒绝安装；等过了就好，`dsh plugin add` 不受影响（这个行为我是从 dshmarket 的源码注释里读到的）。

## 本机先把新包名接上

已经替你做了：`desktop` profile 现在指向 `plugins/dsh-pomodoro-timer`（旧目录 `plugins/dsh-plugin-pomodoro` 已删除）。旧目录里那份和这份内容一致，只是包名不同，避免两份代码漂移。

## 再检查一遍（可选）

```powershell
$env:PATH = "C:\Users\33249\Documents\deepseek-harness\default-workspace\bin;$env:PATH"
cd plugins\dsh-pomodoro-timer
npm run check           # = node --check index.js && node --check client.js && node test/client.test.mjs
# pnpm run check 等价
```

不用 shim 也行（直接调 DSH 自带的 node）：

```powershell
$node = "C:\Users\33249\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
& $node test\client.test.mjs
& $node --check client.js
```
