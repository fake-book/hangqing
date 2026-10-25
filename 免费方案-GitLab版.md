# 免费方案（改走 GitLab）：地址固定、不用开电脑、一分钱不花

**为什么不用 GitHub 了**：我在这台电脑上实测了 GitHub 五个官方 IP，全部 6 秒超时。是国内这条线路把 GitHub 整个挡住了，不是你的操作问题。GitLab 实测 **0.47 秒**能开，所以换它。

## 一、先说清楚三条路

| 方案 | 花钱 | 地址固定 | 电脑能关机 | 国内好不好操作 | 大概要多久 |
|---|---|---|---|---|---|
| **A. 云服务器** | 99 元/年 | ✅ | ✅ | ✅ 最顺 | 30 分钟 |
| **B. GitLab + Cloudflare Pages** | 0 | ✅ | ✅ | ✅ 能开 | 25 分钟 |
| **C. 就用现在这个** | 0 | ❌ IP 会变 | ❌ | ✅ 已经好了 | 0 |

- **要免费又要不依赖电脑 → 只能选 B。**
- **不想再折腾 → 选 C，现在就能用**（电脑开着、手机连同一个 WiFi，打开 `http://192.168.1.7:7788`）。
- **愿意花 99 块 → 选 A 最省心**，以后什么都不用管。

下面写 B。

## 二、B 方案要注册什么

只要一个：**GitLab**（https://gitlab.com ，实测 0.47 秒能开，比 GitHub 快十倍）。

不需要绑卡，不需要买域名。

## 三、五步走完

### 第 1 步：GitLab 建项目

1. 打开 https://gitlab.com ，注册（邮箱 + 密码，收邮件验证）
2. 登录后点 **New project** → **Create blank project**
3. Project name 填 `hangqing`
4. **Visibility Level 选 Public**
5. **不要**勾 "Initialize repository with a README"
6. 点 **Create project**

### 第 2 步：传文件

项目页面上会有一段命令行提示。找 **Upload file** 或直接用网页的 **+** → **Upload file**：

- 把 `_解压后拖这个` 文件夹里的东西全选拖进去
- ⚠️ `.gitlab-ci.yml` 这个文件也要传（点开头的文件网页拖拽可能不认，那就用 **+** → **New file**，文件名填 `.gitlab-ci.yml`，把内容粘进去）

传完点 **Commit changes**。

### 第 3 步：做一个 Token（让机器人能提交）

1. 项目左边 **Settings** → **Access Tokens**
2. **Add new token**：
   - Token name: `hangqing-bot`
   - Expiration date: 往后拉一年
   - Role: **Maintainer**
   - Scopes: **只勾 `write_repository`**
3. 点 **Create project access token**
4. **复制那串 token**（只显示一次，丢了只能重建）

### 第 4 步：把 Token 存进项目变量

1. **Settings** → **CI/CD** → 找到 **Variables** → **Add variable**
2. Key 填：`GL_TOKEN`
3. Value 粘贴刚才那串 token
4. **Masked 勾上**，**Protected 不要勾**
5. 保存

### 第 5 步：设成每天自动跑

1. 左边 **Build** → **Pipeline schedules** → **New schedule**
2. Description: `每天8点半`
3. Interval pattern: `30 0 * * *`（UTC 0:30 = 北京时间 8:30）
4. Target branch: `main`
5. 保存

想立刻试一次：**Build** → **Pipelines** → 右上 **Run pipeline** → 选 main → 跑。

## 四、接 Cloudflare Pages

1. 打开 https://dash.cloudflare.com/?to=/:account/pages/new
2. 选 **Connect to Git** → 授权 **GitLab**（不是 GitHub）
3. 选 `hangqing` 项目
4. **Framework preset**: None
5. **Build command**: 留空
6. **Build output directory**: 留空
7. **Save and Deploy**

等一分钟，给你 `https://hangqing-xxx.pages.dev`。

**这个地址永远不变。**

## 五、怎么判断它真的在跑

- GitLab 项目页 → **Build → Pipelines**：每天北京时间 8:30 会多一条绿色的
- 点进去能看到 `完成：2368 条，较上次变动 N 条`
- Cloudflare Pages 那边会跟着自动重新部署
- 手机上打开那个 pages.dev 地址，页面第二行有「本页生成于 …」，日期是今天的就对了

## 六、可能卡住的地方

**Q：GitLab 注册要验证手机号？**
有的账号会。实在不行就用邮箱注册、换个时间段再试。

**Q：Pipeline 报红色，日志里是 `could not read Username`**
Token 没配对。回去检查第 3、4 步：Scopes 必须勾 `write_repository`，Role 必须是 Maintainer，变量名必须是 `GL_TOKEN`。

**Q：Pipeline 报 `抓取失败`**
GitLab 的服务器在境外，抓国内药材网站偶尔会慢或被挡。看日志里是哪一步挂的；如果只是偶尔一次，第二天会自己好。

**Q：`pages.dev` 哪天打不开了**
有可能，Cloudflare 在国内本来就不稳。真到那天，只能走 A 方案（99 元云服务器）。

## 七、跟 A 方案的账

| | B（GitLab 免费） | A（云服务器 99 元/年） |
|---|---|---|
| 花钱 | 0 | 99 元 |
| 要注册几个账号 | 2 个（GitLab + Cloudflare） | 1 个 |
| 要配几处 | 5 处 | 2 处 |
| 国内速度 | 0.5–2 秒，看 Cloudflare 脸色 | 更快更稳 |
| 出问题谁管 | 自己看日志 | 自己看日志 |

**一句话：愿意花 99 块省这 25 分钟，选 A；愿意花 25 分钟省这 99 块，选 B。**
