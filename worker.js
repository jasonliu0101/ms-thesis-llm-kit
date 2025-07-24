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
      const { question, enableSearch, showThinking, options } = await request.json();
      
      if (!question) {
        return new Response(JSON.stringify({ error: 'Question is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('📥 收到請求:', {
        question: question.substring(0, 100) + '...',
        enableSearch,
        showThinking,
        options
      });

      // 根據前端參數決定調用策略
      if (enableSearch !== false) {
        // 雙重調用：有 grounding 和無 grounding
        const response = await handleDualGeminiAPI(question, env, { enableSearch, showThinking });
        return createResponse(response);
      } else {
        // 單純無 grounding 調用
        const response = await callGeminiAPI(question, env, false);
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
  console.log('🚀 開始雙重 Gemini API 調用');
  console.log('📝 問題:', question);
  console.log('⚙️ 選項:', JSON.stringify(options, null, 2));

  try {
    // 明確進行兩個不同的調用：
    // 1. 有 grounding 的搜索調用
    // 2. 沒有 grounding 的推理調用
    console.log('📡 發送兩個並行請求...');
    
    const [searchResponse, reasoningResponse] = await Promise.allSettled([
      callGeminiAPI(question, env, true),   // 有 grounding
      callGeminiAPI(question, env, false)   // 無 grounding
    ]);

    console.log('📨 兩個請求完成');
    console.log('🔍 搜索請求狀態:', searchResponse.status);
    console.log('🧠 推理請求狀態:', reasoningResponse.status);

    // 準備雙重回應結構
    const dualResponse = {
      searchResponse: null,
      reasoningResponse: null,
      isDualMode: true
    };

    // 處理搜尋回應
    if (searchResponse.status === 'fulfilled') {
      dualResponse.searchResponse = searchResponse.value;
      console.log('✅ 搜索請求成功');
      if (searchResponse.value.candidates?.[0]?.groundingMetadata) {
        console.log('  - 含有 groundingMetadata');
      } else {
        console.log('  - ⚠️ 搜索請求成功但沒有 groundingMetadata');
      }
    } else {
      console.error('❌ 搜索請求失敗:', searchResponse.reason);
      dualResponse.searchError = searchResponse.reason?.message || '搜索請求失敗';
    }

    // 處理推理回應
    if (reasoningResponse.status === 'fulfilled') {
      dualResponse.reasoningResponse = reasoningResponse.value;
      console.log('✅ 推理請求成功');
      if (reasoningResponse.value.candidates?.[0]?.groundingMetadata) {
        console.log('  - ⚠️ 推理請求意外含有 groundingMetadata');
      } else {
        console.log('  - 正確：無 groundingMetadata');
      }
    } else {
      console.error('❌ 推理請求失敗:', reasoningResponse.reason);
      dualResponse.reasoningError = reasoningResponse.reason?.message || '推理請求失敗';
    }

    // 檢查是否至少有一個成功
    if (!dualResponse.searchResponse && !dualResponse.reasoningResponse) {
      console.error('💥 兩個請求都失敗');
      throw new Error('Both API calls failed');
    }

    console.log('🎯 回傳雙重回應結構');
    return dualResponse;

  } catch (error) {
    console.error('💥 雙重 API 調用錯誤:', error);
    throw error;
  }
}

// 調用 Gemini API
async function callGeminiAPI(question, env, withSearch = true) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log(`=== 開始 Gemini API 調用 (withSearch: ${withSearch}) ===`);

  // 構建請求體 - 統一的配置
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
      temperature: 0,                    // 確定性回答
      maxOutputTokens: 65536,           // 最大輸出 token 數
      responseMimeType: "text/plain",   // 回應格式
      thinking_config: {
        thinking_budget: 24576,        // 思考流程 token 預算
        include_thoughts: true         // 包含思考過程
      }
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

  // 根據 withSearch 決定是否添加 Google Search 工具和系統指令
  if (withSearch) {
    // 有 grounding 的請求
    requestBody.tools = [
      {
        googleSearch: {}
      }
    ];
    
    requestBody.systemInstruction = {
      parts: [
        {
          text: "您是一個回答法律問題的人工智慧，請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請結合網路搜尋資料與深度邏輯推理：1. 基於搜尋到的最新資料提供準確答案，並確實引用相關來源 2. 同時進行深度分析和邏輯推理，展示您的思考過程、分析步驟和推理邏輯 3. 將網路資料與第一性原理結合，逐步建構完整論證 4. 既要有實證依據（網路資料），也要有理論基礎（邏輯推理），回答請先講結論，接著從民法、刑法、行政法等三大面向進行分析，若有詮釋其他面向的需求，可以多加說明。請積極上網找資料補充，追求補充資料的充足，資料來源未必要是官方法律資料，可以是網路文章、部落格、經驗分享、新聞等。"
        }
      ]
    };
    
    console.log('🔍 配置：啟用 Google Search (有 grounding)');
  } else {
    // 沒有 grounding 的請求
    requestBody.systemInstruction = {
      parts: [
        {
          text: "您是一個回答法律問題的人工智慧，請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請進行純粹的邏輯推理分析：1. 專注於深度分析和邏輯推理，詳細展示您的思考過程、分析步驟和推理邏輯 2. 從第一性原理出發，逐步建構論證 3. 提供最深層的理論思考與概念探討，回答請先講結論，接著從民法、刑法、行政法等三大面向進行分析，若有詮釋其他面向的需求，可以多加說明。"
        }
      ]
    };
    
    console.log('🧠 配置：純推理模式 (無 grounding)');
  }

  // 記錄完整請求體
  console.log('📋 請求體:', JSON.stringify(requestBody, null, 2));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  console.log('🌐 請求 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`📨 回應狀態: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API 錯誤:', errorText);
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const responseData = await response.json();
  
  // 記錄完整回應結構
  console.log('📋 完整回應結構:', JSON.stringify(responseData, null, 2));
  
  // 記錄關鍵信息
  if (responseData.candidates && responseData.candidates[0]) {
    const candidate = responseData.candidates[0];
    console.log('✅ 回應摘要:');
    console.log('  - 有 groundingMetadata:', !!candidate.groundingMetadata);
    console.log('  - Content parts 數量:', candidate.content?.parts?.length || 0);
    
    if (candidate.groundingMetadata) {
      console.log('  - Search queries:', candidate.groundingMetadata.webSearchQueries?.length || 0);
      console.log('  - Grounding chunks:', candidate.groundingMetadata.groundingChunks?.length || 0);
      console.log('  - Grounding supports:', candidate.groundingMetadata.groundingSupports?.length || 0);
    }
    
    if (candidate.content && candidate.content.parts) {
      candidate.content.parts.forEach((part, index) => {
        console.log(`  - Part ${index}: length=${part.text?.length || 0}, thought=${part.thought}`);
      });
    }
  }

  console.log(`=== 完成 Gemini API 調用 (withSearch: ${withSearch}) ===`);
  
  return responseData;
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
