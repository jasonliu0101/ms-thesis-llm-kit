// Cloudflare Worker for handling Gemini API requests and Azure Translation
export default {
  async fetch(request, env, ctx) {
    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 路由處理
    if (path === '/translate' && request.method === 'POST') {
      return handleTranslateRequest(request, env);
    } else if (path === '/' && request.method === 'POST') {
      return handleGeminiRequest(request, env);
    } else {
      return new Response('Not found', { status: 404 });
    }
  }
};

// 處理翻譯請求
async function handleTranslateRequest(request, env) {
  try {
    const { text, from, to } = await request.json();
    
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }

    console.log('🌏 翻譯請求:', {
      textLength: text.length,
      from: from || 'auto',
      to: to || 'zh-Hant'
    });

    // 呼叫 Azure Translator API
    const translatedText = await callAzureTranslator(text, from || 'en', to || 'zh-Hant', env);
    
    return new Response(JSON.stringify({ 
      translatedText: translatedText,
      originalText: text 
    }), {
      status: 200,
      headers: getCORSHeaders()
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Translation failed',
      details: error.message 
    }), {
      status: 500,
      headers: getCORSHeaders()
    });
  }
}

// 處理 Gemini API 請求
async function handleGeminiRequest(request, env) {
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

// 調用 Azure Translator API
async function callAzureTranslator(text, from, to, env) {
  const apiKey = env.AZURE_TRANSLATOR_KEY;
  const region = env.AZURE_TRANSLATOR_REGION || 'eastasia';
  
  if (!apiKey) {
    throw new Error('AZURE_TRANSLATOR_KEY not configured');
  }

  const endpoint = 'https://api.cognitive.microsofttranslator.com';
  const path = '/translate';
  const constructed_url = endpoint + path;

  const params = new URLSearchParams({
    'api-version': '3.0',
    'from': from,
    'to': to
  });

  const headers = {
    'Ocp-Apim-Subscription-Key': apiKey,
    'Ocp-Apim-Subscription-Region': region,
    'Content-type': 'application/json',
    'X-ClientTraceId': crypto.randomUUID()
  };

  const body = [{
    'text': text
  }];

  console.log('🌏 調用 Azure Translator:', {
    from,
    to,
    textLength: text.length,
    endpoint: constructed_url
  });

  const response = await fetch(`${constructed_url}?${params}`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Azure Translator API error:', response.status, errorText);
    throw new Error(`Azure Translator API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  if (result && result.length > 0 && result[0].translations && result[0].translations.length > 0) {
    const translatedText = result[0].translations[0].text;
    console.log('✅ 翻譯成功，原文長度:', text.length, '譯文長度:', translatedText.length);
    return translatedText;
  } else {
    console.error('Unexpected Azure Translator response format:', result);
    throw new Error('Unexpected response format from Azure Translator');
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
          text: "請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請結合網路搜尋資料與深度邏輯推理：1. 基於搜尋到的最新資料提供準確答案，並確實引用相關來源 2. 同時進行深度分析和邏輯推理，展示您的思考過程、分析步驟和推理邏輯 3. 將網路資料與第一性原理結合，逐步建構完整論證 4. 既要有實證依據（網路資料），也要有理論基礎（邏輯推理）"
        }
      ]
    };
    
    console.log('🔍 配置：啟用 Google Search (有 grounding)');
  } else {
    // 沒有 grounding 的請求
    requestBody.systemInstruction = {
      parts: [
        {
          text: "請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請進行純粹的邏輯推理分析：1. 專注於深度分析和邏輯推理，詳細展示您的思考過程、分析步驟和推理邏輯 2. 從第一性原理出發，逐步建構論證 3. 提供最深層的理論思考與概念探討"
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

  // 處理重複內容：如果是 grounding 請求且有多個非思考的 text parts，只保留最後一個
  if (withSearch && responseData.candidates && responseData.candidates[0]) {
    const candidate = responseData.candidates[0];
    if (candidate.content && candidate.content.parts) {
      const parts = candidate.content.parts;
      const nonThoughtParts = parts.filter(part => part.thought !== true && part.text);
      
      if (nonThoughtParts.length >= 2) {
        console.log(`⚠️ Worker端發現 ${nonThoughtParts.length} 個非思考內容 parts，進行去重處理`);
        nonThoughtParts.forEach((part, index) => {
          console.log(`  NonThought Part ${index}: length=${part.text?.length || 0}`);
        });
        
        // 保留思考內容和最後一個非思考內容
        const thoughtParts = parts.filter(part => part.thought === true);
        const lastNonThoughtPart = nonThoughtParts[nonThoughtParts.length - 1];
        
        // 重構 parts 數組
        candidate.content.parts = [...thoughtParts, lastNonThoughtPart];
        
        console.log(`✅ Worker端去重完成，保留最後一個非思考內容，長度: ${lastNonThoughtPart.text?.length || 0}`);
        console.log(`📋 最終 parts 數量: ${candidate.content.parts.length} (${thoughtParts.length} 思考 + 1 回答)`);
      }
    }
  }

  // Worker端文本清理 - 移除參考資料和註腳
  if (responseData.candidates && responseData.candidates[0]) {
    const candidate = responseData.candidates[0];
    if (candidate.content && candidate.content.parts) {
      candidate.content.parts.forEach((part, index) => {
        if (part.text && part.thought !== true) {
          console.log(`🧹 清理 Part ${index} 文本內容...`);
          console.log(`   - 清理前長度: ${part.text.length}`);
          
          let cleanedText = part.text;
          
          // 1. 移除「參考資料：」及其後的所有內容
          cleanedText = cleanedText.replace(/參考資料[：:][\s\S]*$/m, '').trim();
          
          // 2. 移除「引用資料：」及其後的所有內容
          cleanedText = cleanedText.replace(/引用資料[：:][\s\S]*$/m, '').trim();
          
          // 3. 移除「引用來源：」及其後的所有內容
          cleanedText = cleanedText.replace(/引用來源[：:][\s\S]*$/m, '').trim();
          
          // 4. 移除「參考來源：」及其後的所有內容
          cleanedText = cleanedText.replace(/參考來源[：:][\s\S]*$/m, '').trim();
          
          // 5. 移除「**參考資料：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*參考資料[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 6. 移除「**引用資料：**」及其後的所有內容  
          cleanedText = cleanedText.replace(/\*\*引用資料[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 7. 移除「**引用來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*引用來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 8. 移除「**參考來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*參考來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 9. 移除從「---」開始的參考資料部分
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?參考資料[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?引用資料[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?引用來源[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?參考來源[：:][\s\S]*$/m, '').trim();
          
          // 10. 移除所有註腳編號 [1], [2], [3] 等，包括連續註腳 [1][2]
          cleanedText = cleanedText.replace(/\[\d+\](\[\d+\])*/g, '');
          
          // 11. 清理多餘的空白和換行
          cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
          
          // 更新文本內容
          if (cleanedText !== part.text) {
            console.log(`   ✅ 文本已清理，長度: ${part.text.length} -> ${cleanedText.length}`);
            part.text = cleanedText;
          } else {
            console.log(`   ⚪ 文本無需清理`);
          }
        }
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
