// edge-functions/index.js
// 访问 https://你的域名/ 时触发

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // 获取当前时间（北京时间）
    const now = new Date();
    const beijingTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    // 返回一个简单的状态页 / API 文档
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>对象存储代理服务</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 700px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        h1 .badge {
            background: #10b981;
            color: white;
            font-size: 12px;
            padding: 2px 10px;
            border-radius: 20px;
        }
        .status {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 12px 16px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .status.success {
            color: #166534;
        }
        .api-section {
            margin: 24px 0;
        }
        .api-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #333;
            border-left: 3px solid #667eea;
            padding-left: 12px;
        }
        .endpoint {
            background: #1e1e2e;
            color: #cdd6f4;
            padding: 16px;
            border-radius: 12px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            margin: 12px 0;
            overflow-x: auto;
        }
        .endpoint code {
            word-break: break-all;
        }
        .endpoint-desc {
            font-size: 13px;
            color: #888;
            margin-top: 8px;
        }
        .example {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 12px;
            margin: 16px 0;
        }
        .example p {
            color: #666;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .example code {
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
        }
        .preview-area {
            margin-top: 12px;
        }
        .preview-area img {
            max-width: 100%;
            border-radius: 12px;
            margin-top: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 12px;
        }
        button:hover {
            background: #5a67d8;
        }
        .footer {
            margin-top: 32px;
            font-size: 12px;
            color: #999;
            text-align: center;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
        .env-status {
            font-size: 13px;
            margin-top: 16px;
            padding: 10px 14px;
            background: #fef3c7;
            border-radius: 8px;
            color: #92400e;
        }
        .env-status.ok {
            background: #d1fae5;
            color: #065f46;
        }
        hr {
            margin: 20px 0;
            border: none;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>
            📦 对象存储代理服务
            <span class="badge">运行中</span>
        </h1>
        <p style="color: #666;">通过 EdgeOne 边缘函数安全访问私有存储桶（Backblaze B2 / 其他兼容 S3 的存储）</p>
        
        <div class="status success">
            ✅ 服务正常 | 当前时间: ${beijingTime}
        </div>
        
        <!-- Backblaze B2 API 说明 -->
        <div class="api-section">
            <div class="api-title">🔗 Backblaze B2 API</div>
            <div class="endpoint">
                <code>GET /api/b2?file=&lt;存储桶中的文件路径&gt;</code>
            </div>
            <div class="endpoint-desc">
                需要携带请求头：<code>X-API-Token</code>、<code>X-Timestamp</code>、<code>X-Signature</code>
            </div>
        </div>
        
        <!-- 示例区域（可复用） -->
        <div class="example">
            <p><strong>📷 示例</strong>（如果桶内有 test.jpg 文件）</p>
            <code>/api/b2?file=test.jpg</code>
            <div id="preview"></div>
            <button onclick="loadPreview()">🖼️ 加载预览</button>
        </div>
        
        <!-- 占位：未来可继续添加更多存储服务 -->
        <!--
        <div class="api-section">
            <div class="api-title">🗄️ 阿里云 OSS API（规划中）</div>
            <div class="endpoint">
                <code>GET /api/oss?file=&lt;文件路径&gt;</code>
            </div>
        </div>
        
        <div class="api-section">
            <div class="api-title">☁️ 腾讯云 COS API（规划中）</div>
            <div class="endpoint">
                <code>GET /api/cos?file=&lt;文件路径&gt;</code>
            </div>
        </div>
        -->
        
        <div id="envCheck" class="env-status">
            🔍 检查环境变量...
        </div>
        
        <div class="footer">
            Powered by EdgeOne Pages + Backblaze B2<br>
            存储桶保持私有模式 · 请求需携带签名头
        </div>
    </div>
    
    <script>
        async function loadPreview() {
            const previewDiv = document.getElementById('preview');
            const testFile = prompt('输入文件名（如 test.jpg）:', 'test.jpg');
            if (!testFile) return;
            
            previewDiv.innerHTML = '<p style="color:#666; margin-top:12px;">⏳ 加载中...</p>';
            
            try {
                const imgUrl = '/api/b2?file=' + encodeURIComponent(testFile);
                const response = await fetch(imgUrl, { method: 'HEAD' });
                
                if (response.ok) {
                    previewDiv.innerHTML = \`
                        <div class="preview-area">
                            <img src="\${imgUrl}" alt="预览" 
                                 onerror="this.onerror=null; this.parentElement.innerHTML='<p style=\\\\'color:red\\\\'>❌ 图片加载失败，文件可能不存在</p>'">
                        </div>
                    \`;
                } else if (response.status === 401) {
                    previewDiv.innerHTML = '<p style="color:#dc2626; margin-top:12px;">❌ 未授权：请检查 API Token 配置</p>';
                } else if (response.status === 404) {
                    previewDiv.innerHTML = '<p style="color:#dc2626; margin-top:12px;">❌ 文件不存在，请检查文件名和路径</p>';
                } else {
                    previewDiv.innerHTML = '<p style="color:#dc2626; margin-top:12px;">❌ 加载失败: ' + response.status + '</p>';
                }
            } catch (e) {
                previewDiv.innerHTML = '<p style="color:#dc2626; margin-top:12px;">❌ 请求失败: ' + e.message + '</p>';
            }
        }
        
        async function checkEnv() {
            try {
                const res = await fetch('/api/b2?file=__health_check__');
                const envDiv = document.getElementById('envCheck');
                if (res.status === 500) {
                    envDiv.className = 'env-status';
                    envDiv.innerHTML = '⚠️ 环境变量未配置，请在控制台设置 B2_KEY_ID、B2_APP_KEY、B2_BUCKET_NAME、B2_BUCKET_ID、API_SECRET_TOKEN、API_SECRET_SALT';
                } else if (res.status === 401) {
                    envDiv.className = 'env-status';
                    envDiv.innerHTML = '⚠️ API 密钥未配置或配置错误，请检查 API_SECRET_TOKEN 和 API_SECRET_SALT';
                } else if (res.status === 404) {
                    envDiv.className = 'env-status ok';
                    envDiv.innerHTML = '✅ 服务配置正常（测试文件不存在是预期的）';
                } else {
                    envDiv.className = 'env-status ok';
                    envDiv.innerHTML = '✅ 服务运行正常';
                }
            } catch (e) {
                document.getElementById('envCheck').innerHTML = '❌ 无法连接服务: ' + e.message;
            }
        }
        
        checkEnv();
    </script>
</body>
</html>`;
    
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        }
    });
}