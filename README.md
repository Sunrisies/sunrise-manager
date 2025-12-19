# MongoDB Manager - Tauri 应用

一个基于 Tauri v2、React 和 Tailwind CSS 的 MongoDB 数据库管理工具。

## 功能特性

- ✅ **连接管理**: 支持创建、保存和管理多个 MongoDB 连接
- ✅ **数据库浏览器**: 浏览所有数据库和集合
- ✅ **查询执行**: 支持 find、findOne 和 count 操作
- ✅ **现代化 UI**: 使用 shadcn/ui 组件和 Tailwind CSS
- ✅ **跨平台**: 支持 Windows、macOS 和 Linux

## 技术栈

### 前端
- **React 19**: 现代化的 UI 框架
- **TypeScript**: 类型安全的开发
- **Tailwind CSS**: 实用优先的 CSS 框架
- **shadcn/ui**: 美美的组件库
- **Tauri v2**: 桌面应用框架

### 后端
- **Rust**: 高性能系统语言
- **MongoDB Rust Driver**: 官方 MongoDB 驱动
- **Tokio**: 异步运行时

## 安装和运行

### 前置要求

1. **Node.js** (v18+)
2. **Rust** (最新稳定版)
3. **pnpm** (推荐) 或 npm
4. **MongoDB** 服务器 (本地或远程)

### 开发环境设置

```bash
# 1. 克隆项目
git clone <repository-url>
cd tauri-mongodb-manager

# 2. 安装前端依赖
pnpm install

# 3. 安装 Rust 工具链 (如果尚未安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 4. 构建并运行
pnpm tauri dev
```

### 构建生产版本

```bash
# 构建安装包
pnpm tauri build

# 或者只构建前端
pnpm build
```

## 使用指南

### 1. 创建连接

1. 点击"新建连接"按钮
2. 填写连接信息：
   - **连接名称**: 自定义标识
   - **主机地址**: 默认为 localhost
   - **端口**: 默认为 27017
   - **用户名/密码**: 可选的认证信息
   - **默认数据库**: 可选的默认数据库
3. 点击"创建连接"

### 2. 连接到数据库

在连接列表中点击要连接的连接卡片即可连接。

### 3. 浏览数据库

连接成功后，左侧会显示所有数据库和集合。点击数据库可以展开/收起集合列表。

### 4. 执行查询

在查询编辑器中输入 JSON 格式的查询：

```json
{
  "collection": "users",
  "operation": "find",
  "filter": { "age": { "$gt": 18 } }
}
```

支持的操作：
- `find`: 查询多个文档
- `findOne`: 查询单个文档
- `count`: 计数文档

### 5. 快捷键

- **Ctrl/Cmd + Enter**: 执行查询

## 项目结构

```
src/
├── components/
│   ├── ui/              # 基础 UI 组件
│   ├── connections/     # 连接管理组件
│   ├── database/        # 数据库浏览器组件
│   └── query/           # 查询编辑器组件
├── lib/
│   └── utils.ts         # 工具函数
├── App.tsx              # 主应用组件
├── main.tsx             # 应用入口
└── index.css            # 全局样式

src-tauri/
├── src/
│   └── lib.rs           # Tauri 后端命令
├── Cargo.toml           # Rust 依赖
└── tauri.conf.json      # Tauri 配置
```

## 开发说明

### 添加新组件

1. 在 `src/components/ui/` 创建基础组件
2. 导入到 `src/lib/utils.ts` 的 cn 函数
3. 在需要的地方使用

### 添加新的后端命令

1. 在 `src-tauri/src/lib.rs` 中定义命令
2. 在 `tauri.conf.json` 中添加权限
3. 在前端通过 `invoke()` 调用

### 样式定制

项目使用 Tailwind CSS，可以在 `tailwind.config.js` 中配置主题。

## 常见问题

### 连接失败

- 确保 MongoDB 服务器正在运行
- 检查主机地址和端口是否正确
- 如果使用认证，确保用户名密码正确

### 查询错误

- 确保查询格式是有效的 JSON
- 检查集合名称是否正确
- 确保已选择正确的数据库

## 许可证

MIT License

## 贡献

欢迎提交 Issues 和 Pull Requests！
