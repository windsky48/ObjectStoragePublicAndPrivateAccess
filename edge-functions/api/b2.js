// edge-functions/api/b2.js
// 访问方式: https://你的域名/api/b2?file=图片名.jpg

// 配置说明：
// 1. 在 EdgeOne Pages 控制台配置环境变量：
//    - B2_KEY_ID: 你的 Backblaze Key ID
//    - B2_APP_KEY: 你的 Backblaze Application Key
//    - B2_BUCKET_NAME: 你的桶名
//    - B2_BUCKET_ID: 你的桶ID
//    - API_SECRET_TOKEN: API密钥（客户端请求时必须携带）
//    - API_SECRET_SALT: 签名盐值（用于生成签名，与客户端保持一致）
// 2. 桶保持私有模式（private），不需要付那$1美元
// 3. 客户端需要携带：X-API-Token、X-Timestamp、X-Signature 三个请求头

// ========== 处理 GET 和 HEAD 请求（核心功能）==========
export async function onRequestGet(context) {
    return handleRequest(context);
}

export async function onRequestHead(context) {
    return handleRequest(context);
}

// ========== 处理 OPTIONS 预检请求（CORS）==========
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'X-API-Token, X-Timestamp, X-Signature, Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ========== 核心业务逻辑（复用于GET和HEAD）==========
async function handleRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 1. 获取请求的文件名
    const fileKey = url.searchParams.get('file');
    if (!fileKey) {
        return new Response(JSON.stringify({
            error: '缺少 file 参数',
            usage: '/api/b2?file=你的文件名.jpg'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 安全检查：防止路径遍历攻击
    if (fileKey.includes('..') || fileKey.includes('\\') || fileKey.includes('\0')) {
        return new Response('非法文件名', { status: 400 });
    }

    // 2. 验证请求头（三重验证）
    const validationError = await validateRequest(request, env, fileKey);
    if (validationError) {
        return validationError;
    }

    // 3. 获取环境变量
    const keyId = env.B2_KEY_ID;
    const appKey = env.B2_APP_KEY;
    const bucketName = env.B2_BUCKET_NAME;
    const bucketId = env.B2_BUCKET_ID;

    if (!keyId || !appKey || !bucketName || !bucketId) {
        console.error('缺少环境变量配置');
        return new Response('服务配置错误', { status: 500 });
    }

    try {
        // 4. 调用 Backblaze B2 API 获取下载授权
        const authUrl = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';
        const authResponse = await fetch(authUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${keyId}:${appKey}`)
            }
        });

        if (!authResponse.ok) {
            console.error('B2认证失败:', authResponse.status);
            return new Response('存储服务认证失败', { status: 502 });
        }

        const authData = await authResponse.json();
        const apiUrl = authData.apiUrl;
        const downloadUrl = authData.downloadUrl;
        const authorizationToken = authData.authorizationToken;

        // 5. 查询文件信息
        const fileQueryUrl = `${apiUrl}/b2api/v2/b2_list_file_names`;
        const listResponse = await fetch(fileQueryUrl, {
            method: 'POST',
            headers: {
                'Authorization': authorizationToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucketId: bucketId,
                prefix: fileKey,
                maxFileCount: 1
            })
        });

        if (!listResponse.ok) {
            return new Response('查询文件失败', { status: 502 });
        }

        const listData = await listResponse.json();
        const files = listData.files;

        if (!files || files.length === 0) {
            return new Response('文件不存在', { status: 404 });
        }

        const fileInfo = files[0];
        const contentType = fileInfo.contentType || getContentType(fileKey);
        const fileSize = fileInfo.size;

        // 6. 获取文件
        const fileUrl = `${downloadUrl}/file/${bucketName}/${encodeURIComponent(fileKey)}`;
        const fileResponse = await fetch(fileUrl, {
            headers: {
                'Authorization': authorizationToken
            }
        });

        if (!fileResponse.ok) {
            return new Response('文件获取失败', { status: 502 });
        }

        // 7. 返回文件内容
        return new Response(fileResponse.body, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Cache-Control': 'public, max-age=86400',
                'CDN-Cache-Control': 'public, max-age=604800',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
            }
        });

    } catch (error) {
        console.error('边缘函数错误:', error);
        return new Response('内部服务错误', { status: 500 });
    }
}

// ========== 请求验证函数（三重验证）==========
async function validateRequest(request, env, fileKey) {
    // 1. 验证 Token
    const expectedToken = env.API_SECRET_TOKEN;
    const receivedToken = request.headers.get('X-API-Token');

    if (!expectedToken) {
        console.error('API_SECRET_TOKEN 未配置');
        return new Response('服务配置错误: 缺少 API 密钥配置', { status: 500 });
    }

    if (!receivedToken || receivedToken !== expectedToken) {
        return new Response('Unauthorized: Invalid or missing API token', {
            status: 401,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    // 2. 验证时间戳（防重放攻击）
    const timestamp = request.headers.get('X-Timestamp');
    if (!timestamp) {
        return new Response('Unauthorized: Missing timestamp header', {
            status: 401,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    const requestTime = parseInt(timestamp);
    const now = Date.now();
    const timeDiff = Math.abs(now - requestTime);

    if (isNaN(requestTime) || timeDiff > 300000) {
        return new Response('Unauthorized: Request expired or invalid timestamp', {
            status: 401,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    // 3. 验证签名
    const receivedSignature = request.headers.get('X-Signature');
    if (!receivedSignature) {
        return new Response('Unauthorized: Missing signature header', {
            status: 401,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    const salt = env.API_SECRET_SALT;
    if (!salt) {
        console.error('API_SECRET_SALT 未配置');
        return new Response('服务配置错误: 缺少签名盐值配置', { status: 500 });
    }

    const dataToSign = `${expectedToken}|${timestamp}|${fileKey}`;
    const expectedSignature = await sha256(dataToSign + salt);

    if (!timingSafeEqual(expectedSignature, receivedSignature)) {
        return new Response('Unauthorized: Invalid signature', {
            status: 401,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    return null;
}

// ========== SHA-256 哈希函数 ==========
async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== 时序安全比较函数 ==========
function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ========== 辅助函数：根据文件扩展名猜测 Content-Type ==========
function getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'pdf': 'application/pdf',
        'json': 'application/json',
        'css': 'text/css',
        'js': 'application/javascript',
        'html': 'text/html'
    };
    return types[ext] || 'application/octet-stream';
}