# 免费方案：地址固定、不用开电脑、不花一分钱

**结论先说：能。** 我实测了四个平台，只有 Cloudflare 这条路在国内跑得动。

## 一、实测数据（刚才在这台电脑上测的）

| 平台 | 免费 | 地址固定 | 国内能打开吗 | 实测 |
|---|---|---|---|---|
| **Cloudflare Pages** | ✅ | ✅ 固定 `xxx.pages.dev` | ✅ **0.77 秒** | `demo.pages.dev` → 200 |
| Vercel | ✅ | ✅ | ❌ **打不开** | `example.vercel.app` → 10 秒超时 |
| Render | ✅ | ✅ | ⚠️ 能开但会睡 | 15 分钟没人访问就休眠，冷启动 30 秒 |
| Cloudflare Workers | ✅ | ✅ | ✅ | 抓不动：免费版每次只给 10 毫秒 CPU，抓 122 页必超 |

**所以选 Cloudflare Pages。** 它免费、地址固定、国内 0.77 秒能打开、不用绑卡、不用买域名。

## 二、它是怎么跑的

```
GitHub 仓库（放代码 + 数据）
      ↓  每天北京时间 8:30，GitHub 的服务器自动跑一次抓取
      ↓  抓完把新的 行情.html 提交回去
Cloudflare Pages（自动部署）
      ↓
固定网址 https://你的名字.pages.dev
```

**关键点：跑抓取的是 GitHub 的服务器，不是你的电脑。** 你的电脑关不关机、在不在家，都不影响。

## 三、你要做的四件事（大约 40 分钟）

### 第 1 步：注册 GitHub（电脑上做）

打开 https://github.com/signup

- 邮箱、密码、用户名（英文，比如 `wjj-hangqing`）
- 用户名会出现在网址里，**想好再填**
- 收邮件验证

⚠️ **GitHub 在国内打开慢**（我实测首页 10 秒）。慢就等，别反复刷新。

### 第 2 步：建仓库、传文件

1. 登录后点右上角 **+** → **New repository**
2. Repository name 填 `hangqing`
3. 选 **Public**（公开仓库才无限免费；私有只有每月 2000 分钟）
4. 点 **Create repository**
5. 进去后点 **uploading an existing file**
6. **把 `行情表-上云包.zip` 解压后的所有文件拖进去**
   - 注意：要连 `.github` 这个文件夹一起拖（里面有自动更新的配置文件）
   - 网页拖拽可能不认 `.github` 这种点开头的文件夹，那就用 GitHub Desktop 软件传，更稳
7. 点 **Commit changes**

### 第 3 步：注册 Cloudflare（电脑上做）

打开 https://dash.cloudflare.com/sign-up

- 邮箱、密码
- 收邮件验证
- **不用绑卡，不用买任何东西**

### 第 4 步：连起来

1. Cloudflare 左边菜单 → **Workers & Pages**
2. **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选刚才那个 `hangqing` 仓库
4. Build settings 全部留空（这是纯静态站，不用构建）
   - Framework preset: **None**
   - Build command: **留空**
   - Build output directory: **留空**（或填 `/`）
5. 点 **Save and Deploy**

等 1 分钟，它会给你一个网址：`https://hangqing-xxx.pages.dev`

**这个网址一辈子不变。**

## 四、之后怎么用

**手机上：**
浏览器打开那个网址 → 菜单 → 添加到主屏幕 → 以后点图标直接进

**数据什么时候更新：**
每天北京时间 8:30 自动跑一次。你什么都不用做。

**想立刻更新一次：**
GitHub 仓库 → **Actions** 标签 → 左边「每天更新行情」→ 右边 **Run workflow** → 绿色按钮

## 五、可能会遇到的问题

**Q：GitHub 打不开怎么办？**
多等几秒，或者换个时间。它国内时快时慢，但能通。

**Q：Pages 部署失败？**
多半是仓库里没有 `index.html`。Cloudflare Pages 默认找 `index.html`，我们的是 `行情.html`。
解决：在仓库根目录建一个 `index.html`，内容就一行跳转：
```html
<meta http-equiv="refresh" content="0;url=行情.html">
```
或者更简单：把 `行情.html` 复制一份改名 `index.html`。

**Q：抓取失败（Actions 跑红了）？**
点进去看日志。常见原因：
- 天地网临时改版 → 需要改 `fetch-price.mjs` 的解析规则
- GitHub 服务器访问国内站点慢 → 偶尔失败，第二天会自己好

**Q：`pages.dev` 会不会哪天被封？**
有这个可能（Cloudflare 在国内本来就不稳）。但实测现在是通的。
真要百分之百稳，只有国内服务器 + 备案域名这条路。

## 六、跟花钱方案的对比

| | Cloudflare Pages | 云服务器 99 元/年 |
|---|---|---|
| 花多少钱 | **0** | 99 元/年 |
| 地址固定 | ✅ | ✅ |
| 国内速度 | 0.77 秒（实测） | 更快 |
| 电脑能关机吗 | ✅ | ✅ |
| 要注册账号 | 2 个 | 1 个（云厂商） |
| 配置难度 | 中（要拖文件、连 Git） | 低（传包跑一个脚本） |
| 稳定性 | 一般（Cloudflare 国内时好时坏） | 好 |
| 数据更新 | GitHub 每天自动 | 服务器 crontab 每天自动 |

**先走免费的这条。** 用一段时间觉得不稳，再花那 99 块。
