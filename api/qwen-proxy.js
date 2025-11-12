// api/qwen-proxy.js
export default async function handler(req, res) {
  // 👇 1. 处理 OPTIONS 预检请求（CORS Preflight）
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
    return;
  }

  // 👇 2. 只允许 POST（但先放行 OPTIONS）
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  const API_KEY = process.env.DASHSCOPE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'DASHSCOPE_API_KEY is missing' });
  }

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: {
          messages: [
            {
              role: 'system',
              content: `
你是一个招商引资平台的操作助手。请根据用户输入，返回一个 **纯 JSON 对象**，不要任何解释、Markdown 或额外文本。

支持的操作：
- 显示全部公司 → {"action": "show_all"}
- 按员工人数筛选（大于等于）→ {"action": "filter", "field": "staff_gte", "value": 1000}
- 按标签筛选 → {"action": "filter", "field": "tag", "value": "新能源"}

标签必须是以下之一（严格匹配）：
AI, 大数据, 光伏, 储能, 装备, 制造, 物流, 仓储, 基因, 医药, 新能源, 智能驾驶, 健康, 食品, 材料, 科技, 政务, 智慧城市, 环保, 工程, 量子, 通信, 农业, 航天, 卫星, 医疗, 教育, 海洋, 芯片, 半导体, 建筑

规则：
1. 只返回合法 JSON
2. 提取员工人数时取整数（如“一千”→1000）
3. 无法理解时返回 {"action": "unknown"}
`
            },
            { role: 'user', content: prompt }
          ]
        },
        parameters: { result_format: 'message' }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Qwen API Error:', data);
      return res.status(500).json({ error: 'Qwen API error' });
    }

    const content = data?.output?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { action: 'unknown' };
    }

    // 👇 3. 在最终响应中也加上 CORS 头
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .json(parsed);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json({ error: 'Internal error' });
  }
}