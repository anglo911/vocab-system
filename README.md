# Vocab Learning System

一个可持续迭代的英语单词学习系统。

当前技术栈：
- Web：Next.js
- API：Fastify + Prisma
- DB：PostgreSQL（推荐 Neon）
- Cache：Redis（当前不是 P4 阻塞项）

当前交付策略：**Neon-first**。优先使用托管 PostgreSQL 完成 migration / seed / smoke test，不依赖本地 Docker。

---

## 目录结构

- `apps/web`：Next.js 前端
- `apps/server`：Fastify + Prisma API
- `docker-compose.yml`：历史本地 Postgres / Redis 方案（可选，不是当前默认路径）

---

## 推荐环境（方案 A）

### 数据库
推荐使用 **Neon Postgres**：
- 新建项目：`vocab-system-dev`
- 数据库：默认库即可
- schema：`public`
- 复制连接串到 `DATABASE_URL`

### 环境变量

复制模板：

```bash
cp .env.example .env
```

推荐配置：

```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require&schema=public"
REDIS_URL="redis://localhost:6379"
API_PORT=4000
WEB_PORT=3000
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
JWT_SECRET="replace-me"
```

> 说明：
> - `DATABASE_URL` 建议直接使用 Neon 提供的 Prisma / pooled 连接串。
> - Redis 目前不是 P4 的必需依赖，没有可先保留占位。

---

## 启动步骤（Neon-first）

```bash
cd vocab-system
cp .env.example .env
# 编辑 .env，填入真实 DATABASE_URL
pnpm install
pnpm --filter @vocab/server db:generate
pnpm --filter @vocab/server db:migrate
pnpm db:seed
pnpm dev
```

启动后访问：
- Web: <http://localhost:3000>
- API Health: <http://localhost:4000/health>

---

## 登录方式（Demo JWT）

1. 打开 `/login`
2. 输入以下账号之一：
   - `demo-user` → 普通用户
   - `admin-demo` → 管理员
3. 登录后 token 会保存在浏览器 `localStorage`

受保护页面：
- `/learn`
- `/wrongbook`
- `/admin`（仅 ADMIN 可访问，前后端双重限制）

---

## 当前主要功能

### 学习系统
- `/learn` 学习页
- Again / Hard / Good / Easy 四档评分
- 键盘快捷键 `1/2/3/4`
- 基于学习计划返回学习队列
- 今日学习进度展示

### 词库系统
- `/words` 词库页
- 搜索 + level 筛选
- URL 参数回填

### 错词本
- `/wrongbook`
- 后端持久化
- 评分失败自动加入错词本
- 支持移除

### 打卡
- 今日打卡
- 连续天数 / 累计打卡次数

### 学习计划
- `dailyTarget`
- `newWordsPerDay`
- `reviewWordsPerDay`

### 管理后台（P4）
- 单词新增（ADMIN）
- CSV 批量导入（ADMIN）
- 导入任务日志（ImportJob）
- Dashboard 统计卡片
- 近 7 日学习趋势柱状图
- 管理员权限分级（USER / ADMIN）

---

## API 概览

### 公共接口
- `GET /api/words?level=A1&search=...&limit=...`
- `POST /api/auth/login`

### 需要 ADMIN 的接口
- `POST /api/admin/words`
- `POST /api/admin/words/import-csv`
- `GET /api/admin/dashboard`
- `GET /api/admin/import-jobs`

### 需要 Bearer Token 的接口
- `GET /api/learn/due`
- `POST /api/learn/check`
- `GET /api/stats/overview`
- `GET /api/wrong-words`
- `POST /api/wrong-words/add`
- `POST /api/wrong-words/remove`
- `GET /api/checkin/status`
- `POST /api/checkin/today`
- `GET /api/plan`
- `POST /api/plan`

错误响应结构统一为：

```json
{ "message": "..." }
```

---

## CSV 导入规则

支持表头：

```csv
text,phonetic,meaningZh,example,level,tags
habit,/ˈhæbɪt/,习惯A1,Reading daily is a good habit.,A1,daily|study
habit,/ˈhæbɪt/,习惯A2,Building a habit takes time.,A2,study|growth
context,/ˈkɒntekst/,语境,Learn words in context.,A2,study|method
```

导入规则：
- 唯一依据：`text + level`
- 已存在：更新
- 不存在：创建
- 会写入 ImportJob 日志

---

## 当前 P4 状态

P4 已完成，并已在真实 Neon PostgreSQL 上完成验证：
1. Prisma migration 已成功执行
2. seed 已成功执行
3. smoke test 已通过
4. 已修复一个鉴权范围过大的 bug（避免误拦 `/health` 和 `/api/auth/login`）

---

## P5 部署（推荐方案）

### 后端：Railway

仓库已包含 `railway.json`，推荐直接从 GitHub 导入部署。

#### Railway 配置
1. 登录 Railway
2. 选择 **New Project** → **Deploy from GitHub repo**
3. 选择仓库：`anglo911/vocab-system`
4. Root Directory 设为：`/`
5. 环境变量设置：

```env
DATABASE_URL=<你的 Neon 连接串>
JWT_SECRET=<生产环境随机字符串>
CORS_ORIGIN=<你的 Vercel 前端域名>
PORT=4000
```

#### Railway 说明
- 构建命令由 `railway.json` 提供
- 启动命令会运行 `apps/server` 的生产服务
- 健康检查路径：`/health`

### 前端：Vercel

仓库已包含 `vercel.json`。

#### Vercel 配置
1. 登录 Vercel
2. 选择 **Add New Project**
3. 导入仓库：`anglo911/vocab-system`
4. 在项目设置中将 **Root Directory** 设为：`apps/web`
5. 环境变量设置：

```env
NEXT_PUBLIC_API_BASE_URL=<你的 Railway 后端域名>
```

#### Vercel 说明
- Framework 选择 Next.js
- 其余默认即可

### 部署顺序
1. 先部署 Railway 后端
2. 拿到后端域名
3. 再部署 Vercel 前端
4. 把 Vercel 域名回填到 Railway 的 `CORS_ORIGIN`
5. 重新部署 Railway

---

## 版本基线

- 历史稳定标签：`v0.3.0`
- 当前状态：P4 已闭环（Neon + smoke test 完成）
- 下一阶段：P5 部署上线（Railway + Vercel）
