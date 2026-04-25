// edge-functions/api/b2.js
// 访问方式: https://你的域名/api/b2?file=图片名.jpg

// 配置说明：
// 1. 在 EdgeOne Pages 控制台配置环境变量：
//    - B2_KEY_ID: 你的 Backblaze Key ID
//    - B2_APP_KEY: 你的 Backblaze Application Key
//    - B2_BUCKET_NAME: 你的桶名（如 "my-bucket"）
//    - B2_BUCKET_ID: 你的桶ID（在桶设置页面可以找到）
// 2. 桶保持私有模式（private），不需要付那$1美元
// 3. 首次访问会从B2取文件，后续走EdgeOne边缘节点缓存

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // ========== 1. 获取请求的文件名 ==========
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

    // 安全检查：防止路径遍历攻击（如 ?file=../../config）
    if (fileKey.includes('..') || fileKey.includes('\\')) {
        return new Response('非法文件名', { status: 400 });
    }

    // ========== 2. 获取环境变量 ==========
    const keyId = env.B2_KEY_ID;
    const appKey = env.B2_APP_KEY;
    const bucketName = env.B2_BUCKET_NAME;
    const bucketId = env.B2_BUCKET_ID;

    if (!keyId || !appKey || !bucketName || !bucketId) {
        console.error('缺少环境变量配置');
        return new Response('服务配置错误', { status: 500 });
    }

    try {
        // ========== 3. 调用 Backblaze B2 API 获取下载授权 ==========
        // 第一步：获取 B2 API 的基础 URL
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

        // 第二步：获取文件信息（可选，用于获取文件大小、类型等）
        const fileInfoUrl = `${apiUrl}/b2api/v2/b2_get_file_info`;
        const fileQueryUrl = `${apiUrl}/b2api/v2/b2_list_file_names`;
        
        // 先列出文件找到对应的 fileId（如果知道 fileId 可以直接用）
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

        // 第三步：生成带授权的下载 URL
        // 私有桶的下载格式：https://{downloadUrl}/file/{bucketName}/{fileName}
        const fileUrl = `${downloadUrl}/file/${bucketName}/${encodeURIComponent(fileKey)}`;

        // 第四步：代理请求文件
        const fileResponse = await fetch(fileUrl, {
            headers: {
                'Authorization': authorizationToken
            }
        });

        if (!fileResponse.ok) {
            return new Response('文件获取失败', { status: 502 });
        }

        // 第五步：返回文件内容，带上缓存头（重要！让边缘节点缓存）
        return new Response(fileResponse.body, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Cache-Control': 'public, max-age=86400',  // 缓存24小时
                'CDN-Cache-Control': 'public, max-age=604800', // 边缘节点缓存7天
                'Access-Control-Allow-Origin': '*',       // 允许跨域（按需开启）
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
            }
        });

    } catch (error) {
        console.error('边缘函数错误:', error);
        return new Response('内部服务错误', { status: 500 });
    }
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

// ========== 处理 OPTIONS 预检请求（CORS） ==========
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}