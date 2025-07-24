// Cloudflare Worker for handling Gemini API requests
export default {
  async fetch(request, env, ctx) {
    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // 只允許 POST 請求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { question, options } = await request.json();
      
      if (!question) {
        return new Response(JSON.stringify({ error: 'Question is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 檢查是否需要雙重 API 調用
      if (options?.dualMode) {
        const response = await handleDualGeminiAPI(question, env, options);
        return createResponse(response);
      } else {
        // 單一 API 調用
        const withSearch = options?.withSearch !== false; // 默認啟用搜索
        const response = await callGeminiAPI(question, env, withSearch);
        return createResponse(response);
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }), {
        status: 500,
        headers: getCORSHeaders()
      });
    }
  }
};

// 處理雙重 Gemini API 調用
async function handleDualGeminiAPI(question, env, options) {
  try {
    // 同時發送兩個請求：一個有 Google Search，一個沒有
    const [searchResponse, reasoningResponse] = await Promise.allSettled([
      callGeminiAPI(question, env, true),   // 有搜尋：提供主要內容和引用
      callGeminiAPI(question, env, false)   // 無搜尋：提供推理流程
    ]);

    // 處理搜尋回應
    let searchResult = null;
    if (searchResponse.status === 'fulfilled') {
      searchResult = searchResponse.value;
    } else {
      console.error('Search request failed:', searchResponse.reason);
    }

    // 處理推理回應
    let reasoningResult = null;
    if (reasoningResponse.status === 'fulfilled') {
      reasoningResult = reasoningResponse.value;
    } else {
      console.error('Reasoning request failed:', reasoningResponse.reason);
    }

    // 合併結果
    if (searchResult && reasoningResult) {
      // 將推理內容添加到搜尋結果中
      if (searchResult.candidates && searchResult.candidates[0] && 
          reasoningResult.candidates && reasoningResult.candidates[0]) {
        
        const searchCandidate = searchResult.candidates[0];
        const reasoningCandidate = reasoningResult.candidates[0];
        
        // 提取推理流程的思考內容
        let thinkingContent = '';
        if (reasoningCandidate.content && reasoningCandidate.content.parts) {
          reasoningCandidate.content.parts.forEach(part => {
            if (part.thought === true && part.text) {
              thinkingContent += part.text + '\n';
            }
          });
        }
        
        // 將思考內容添加到搜尋結果中
        if (thinkingContent) {
          searchCandidate.enhancedThinkingContent = thinkingContent.trim();
        }
      }
      
      return searchResult;
    } else if (searchResult) {
      return searchResult;
    } else if (reasoningResult) {
      return reasoningResult;
    } else {
      throw new Error('Both API calls failed');
    }

  } catch (error) {
    console.error('Dual API call error:', error);
    throw error;
  }
}

// 調用 Gemini API
async function callGeminiAPI(question, env, withSearch = true) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // 構建請求體
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: question
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      stopSequences: []
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  // 如果啟用搜索，添加 Google Search 工具
  if (withSearch) {
    requestBody.tools = [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.7
          }
        }
      }
    ];
  }

  // 如果不啟用搜索，啟用思考模式
  if (!withSearch) {
    requestBody.systemInstruction = {
      parts: [
        {
          text: `你是一個專業的法律顧問 AI 助手。請按照以下格式回答用戶的法律問題：

<thinking>
在這裡進行詳細的思考和分析過程：
1. 理解問題的核心法律議題
2. 分析相關的法律條文和原則
3. 考慮可能的例外情況和複雜因素
4. 思考實務上的處理方式
5. 評估不同觀點和可能的結果
</thinking>

然後提供正式的回答內容...`
        }
      ]
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// 創建回應
function createResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: getCORSHeaders()
  });
}

// 處理 CORS
function handleCORS() {
  return new Response(null, {
    status: 200,
    headers: getCORSHeaders()
  });
}

// 獲取 CORS 標頭
function getCORSHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // 在生產環境中，請將此設置為您的 GitHub Pages 域名
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
