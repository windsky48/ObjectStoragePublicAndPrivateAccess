# 对象存储私有桶代理服务

通过 EdgeOne Pages 边缘函数安全访问私有存储桶（Backblaze B2 / 兼容 S3 的存储服务），无需支付公开访问费用。

[![EdgeOne Pages](https://img.shields.io/badge/EdgeOne-Pages-0052CC?logo=tencentqq)](https://edgeone.ai/)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

## 📋 项目简介

本项目解决了一个常见问题：Backblaze B2 的存储桶若要开启公共访问，需要支付 $1 美元验证费。通过 EdgeOne Pages 边缘函数做中转代理，可以让存储桶保持**私有模式**，同时实现对外访问。

### 核心特性

- ✅ **存储桶保持私有**：无需支付 $1 美元公开访问费用
- ✅ **边缘函数代理**：请求通过 EdgeOne 边缘节点中转，自带全球加速
- ✅ **签名鉴权**：三重验证（Token + 时间戳 + 签名），防止盗用和重放攻击
- ✅ **自动缓存**：边缘节点缓存文件，减少源站请求
- ✅ **跨域支持**：内置 CORS 配置，方便前端直接调用

---

## 🏗️ 项目结构

```text
项目根目录/
├── edge-functions/
│   ├── index.js              # 首页状态页 / API 文档
│   └── api/
│       └── b2.js             # Backblaze B2 代理核心函数
├── edgeone.json              # EdgeOne 配置文件（可选）
├── README.md                 # 项目说明
├── LICENSE                   # CC BY-NC-SA 4.0 许可证
└── package.json              # npm 配置

```

---

## 🚀 快速开始

### 前置要求

1. [EdgeOne Pages](https://edgeone.ai/) 账号
2. [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html) 账号及存储桶
3. Node.js 18+（用于本地调试）

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/yourname/object-storage-proxy.git
cd object-storage-proxy
```

#### 2. 安装 EdgeOne CLI

```bash
npm install -g edgeone
edgeone login
```

#### 3. 配置环境变量
在 EdgeOne Pages 控制台添加以下环境变量：  

| 变量名 | 说明 | 示例 |
|:---|:---|:---|
| B2_KEY_ID | Backblaze Key ID | 0042a3b5c6d7e8f9a0b1 |
| B2_APP_KEY | Backblaze Application Key | K0042a3b5c6d7e8f9a0b1 |
| B2_BUCKET_NAME | 存储桶名称 |	my-private-bucket |
| B2_BUCKET_ID | 存储桶 ID | 2a3b5c6d7e8f9a0b1c2d |
| API_SECRET_TOKEN | API 密钥（客户端携带） | a8f3c2e1b7d4f6a9... |
| API_SECRET_SALT |	签名盐值 | f3a2c1e4b6d8f9a1... |

#### 4. 本地调试

```bash
edgeone pages dev
```

访问 http://localhost:8088 查看首页。  

#### 5. 部署上线

```bash
edgeone pages deploy
```

或推送到 Git 仓库触发自动部署。  

---


## 📡 API 使用说明
请求格式

```text
GET /api/b2?file={文件路径}
```

### 请求头
| 请求头 | 类型 | 必填 | 说明 |
|:---|:---|:---|
| X-API-Token |	string | ✅ | API 密钥，与环境变量 API_SECRET_TOKEN 一致 |
| X-Timestamp |	number | ✅ | 毫秒时间戳，有效期 5 分钟 |
| X-Signature |	string | ✅ | 签名，计算公式见下方 |

### 签名计算方法

```javascript
const dataToSign = `${API_SECRET_TOKEN}|${timestamp}|${fileKey}`;
const signature = await sha256(dataToSign + API_SECRET_SALT);
```

### 示例请求

```bash
curl -H "X-API-Token: your_token" \
     -H "X-Timestamp: 1714123456789" \
     -H "X-Signature: abc123..." \
     "https://your-domain.edgeone.app/api/b2?file=images/photo.jpg"
```

### 🛡️ 安全机制

| 验证项 |	作用 | 防护攻击 |
|:---|:---|:---|
| Token 验证 | 验证客户端身份 | 未授权访问 |
| 时间戳验证 | 限制请求有效期（5分钟） | 重放攻击 |
| SHA-256 签名 | 防止请求内容被篡改 | 中间人攻击 |
| Timing-safe 比较 | 防止通过响应时间推断签名 | 时序攻击 |

### 🔧 扩展指南
#### 添加其他存储服务（如阿里云 OSS）
1. 在 `edge-functions/api/` 下创建 `oss.js`  

2. 参考 `b2.js` 的结构实现 `onRequestGet` 和 `onRequestHead`

3. 在 `edge-functions/index.js` 中添加对应的 API 说明区块

#### 修改缓存策略
在 `b2.js` 中调整 `Cache-Control` 头：

```javascript
'Cache-Control': 'public, max-age=86400',  // 24小时
'CDN-Cache-Control': 'public, max-age=604800', // 7天
```

---

## 📋 环境变量完整列表

| 变量名 |	必填 | 说明 |
|:---|:---|:---|
| B2_KEY_ID | ✅ | Backblaze 密钥 ID |
| B2_APP_KEY | ✅ | Backblaze 应用密钥 |
| B2_BUCKET_NAME | ✅ | 存储桶名称 |
| B2_BUCKET_ID | ✅ | 存储桶 ID |
| API_SECRET_TOKEN | ✅ | API 认证 Token |
| API_SECRET_SALT	| ✅ | 签名盐值 |

---

## ❓ 常见问题
### Q: 为什么返回 401？
A: 请检查 `X-API-Token` 是否正确，或环境变量 `API_SECRET_TOKEN` 是否已配置。

### Q: 为什么返回 404？
A: 可能原因：

- 存储桶中文件不存在

- 边缘函数路由未正确绑定（检查部署日志）

- 函数未正确导出 onRequestGet

### Q: 如何更新 Token/Salt？
A: 在 EdgeOne 控制台修改环境变量，重新部署即可。

---

## 📄 许可证

Copyright (c) 2026 [Windsky48]

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可证。

您可以：

- 共享 — 在任何媒介以任何形式复制、发行本作品

- 改编 — 修改、转换本作品

但须遵守以下条件：

- 署名 — 注明出处

- 非商业性使用 — 不得用于商业目的

- 相同方式共享 — 修改后的作品必须采用相同许可证

---

## 🤝 贡献
欢迎提交 Issue 和 Pull Request。

1. Fork 本项目

2. 创建您的特性分支 (git checkout -b feature/AmazingFeature)

3. 提交更改 (git commit -m 'Add some AmazingFeature')

4. 推送到分支 (git push origin feature/AmazingFeature)

5. 打开 Pull Request

## 📧 联系方式
如有问题，请通过 Issue 联系。

---

Built with ❤️ using EdgeOne Pages