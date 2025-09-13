// Cloudflare Worker for handling Gemini API requests and Google Cloud Translation
export default {
  async fetch(request, env, ctx) {
    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 路由處理
    if (path === '/assign' && request.method === 'POST') {
      return handleUserAssignment(request, env);
    } else if (path === '/translate' && request.method === 'POST') {
      return handleTranslateRequest(request, env);
    } else if (path === '/stream-gemini' && request.method === 'POST') {
      return handleStreamingGeminiRequest(request, env);
    } else if (path === '/sample-data' && request.method === 'GET') {
      return handleSampleDataRequest(request, env);
    } else if (path === '/virtual-references' && request.method === 'GET') {
      return handleVirtualReferencesRequest(request, env);
    } else if (path === '/' && request.method === 'POST') {
      return handleGeminiRequest(request, env);
    } else {
      return new Response('Not found', { status: 404 });
    }
  }
};

// 新增：簡化的 Gemini API 調用函數（作為最後的備用）
async function callSimplifiedGeminiAPI(question, env) {
  console.log('🔧 執行簡化 Gemini API 調用...');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [{
        text: `請回答以下問題：${question}`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  console.log('🔧 簡化 API 請求 payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  console.log('🔧 簡化 API 響應狀態:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 簡化 API 錯誤響應:', errorText);
    throw new Error(`簡化 Gemini API 失敗 (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ 簡化 API 成功響應:', JSON.stringify(result, null, 2));

  if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
    return {
      success: true,
      answer: result.candidates[0].content.parts[0].text,
      source: "Gemini (簡化模式)"
    };
  } else {
    throw new Error('簡化 API 響應格式異常');
  }
}

// 使用 Google 搜尋的 Gemini API 調用
async function handleUserAssignment(request, env) {
  try {
    console.log('🎯 收到使用者分配請求');
    
    const requestData = await request.json();
    console.log('📋 請求資料:', JSON.stringify(requestData, null, 2));
    
    // 獲取使用者計數器 (使用 Durable Objects 或 KV 存儲)
    // 這裡使用簡單的時間戳 + 隨機數方法來模擬輪流分配
    const timestamp = Date.now();
    const clientInfo = {
      timestamp: requestData.timestamp || timestamp,
      userAgent: requestData.userAgent || 'unknown',
      referrer: requestData.referrer || 'direct'
    };
    
    // 創建一個基於時間和客戶端資訊的雜湊值（改進版）
    const hashInput = `${clientInfo.timestamp}-${clientInfo.userAgent}-${clientInfo.referrer}`;
    let hash = 0;
    
    // 使用更好的雜湊函數來確保均勻分佈
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉換為32位整數
    }
    
    // 添加額外的混亂因子以改善分佈（MurmurHash3 啟發的 finalizer）
    // 這確保即使輸入有規律性（如連續時間戳），輸出也會均勻分佈
    hash = hash ^ (hash >>> 16);
    hash = Math.imul(hash, 0x85ebca6b);
    hash = hash ^ (hash >>> 13);
    hash = Math.imul(hash, 0xc2b2ae35);
    hash = hash ^ (hash >>> 16);
    
    // 根據雜湊值決定分配（偶數為 Case A，奇數為 Case B）
    const shouldUseCaseA = Math.abs(hash) % 2 === 0;
    
    const assignedCase = shouldUseCaseA ? 'Case A' : 'Case B';
    // 根據雜湊值決定分配的網址
    const redirectUrl = Math.abs(hash) % 4 === 0 ? 'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-c.html' :
               Math.abs(hash) % 4 === 1 ? 'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-d.html' :
               Math.abs(hash) % 4 === 2 ? 'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-e.html' :
                             'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-f.html';
    
    console.log('✅ 使用者分配完成:', {
      assignedCase,
      redirectUrl,
      hash: hash,
      shouldUseCaseA
    });
    
    // 記錄分配結果（可用於後續分析）
    const logEntry = {
      timestamp: new Date().toISOString(),
      assignedCase,
      clientInfo,
      hash,
      redirectUrl
    };
    
    console.log('📊 分配日誌:', JSON.stringify(logEntry, null, 2));
    
    return new Response(JSON.stringify({
      success: true,
      assignedCase,
      redirectUrl,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: getCORSHeaders()
    });
    
  } catch (error) {
    console.error('❌ 使用者分配錯誤:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'User assignment failed',
      details: error.message
    }), {
      status: 500,
      headers: getCORSHeaders()
    });
  }
}

// 處理翻譯請求
async function handleTranslateRequest(request, env) {
  try {
    console.log('🌏 收到翻譯請求，開始解析...');
    console.log('📍 請求方法:', request.method);
    console.log('📍 請求 URL:', request.url);
    console.log('📍 請求頭部:', JSON.stringify([...request.headers.entries()], null, 2));
    
    // 檢查請求體是否可讀
    const requestClone = request.clone();
    const requestText = await requestClone.text();
    console.log('📋 原始請求體:', requestText);
    
    let requestData;
    try {
      requestData = JSON.parse(requestText);
    } catch (parseError) {
      console.error('❌ JSON 解析錯誤:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON format',
        details: parseError.message 
      }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }
    
    console.log('📋 解析後的請求資料:', JSON.stringify(requestData, null, 2));
    
    const { q, target, source } = requestData;
    
    console.log('🔍 參數檢查:', {
      'q 存在': !!q,
      'q 類型': typeof q,
      'q 長度': q ? q.length : 'N/A',
      'target': target,
      'source': source
    });
    
    if (!q) {
      console.error('❌ 缺少 q 參數');
      console.error('❌ 完整請求資料:', JSON.stringify(requestData, null, 2));
      return new Response(JSON.stringify({ error: 'Text (q parameter) is required' }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }

    console.log('🌏 翻譯請求:', {
      textLength: q.length,
      source: source || 'auto',
      target: target || 'zh-TW'
    });

    // 呼叫翻譯 API（Google Cloud 主要，Azure 備用）
    const result = await callTranslationWithFallback(q, target || 'zh-TW', source, env);
    
    return new Response(JSON.stringify(result), {
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
    const { question, enableSearch, showThinking, options, sessionId } = await request.json();
    
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

    // 檢查地理位置限制
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Gemini API 服務不可用',
        details: 'API 金鑰未設定',
        fallback_message: '抱歉，Gemini API 服務目前不可用。這可能是由於地理位置限制或設定問題。請聯繫管理員。'
      }), {
        status: 503,
        headers: getCORSHeaders()
      });
    }

    // 根據前端參數決定調用策略
    if (enableSearch !== false) {
      // 檢查是否來自 Case C 的答案階段
      // Case C：沒有 options 參數且有 showThinking
      // Case A：有 options 參數
      const isCaseC = !options && showThinking === true;
      
      if (isCaseC) {
        // Case C：單一調用，只有 grounding (搜索)，不使用dual mode，使用較小的thinking budget
        try {
          const response = await callGeminiAPI(question, env, true, 12000);  // Case C 使用 12000 thinking budget
          return createResponse(response);
        } catch (searchError) {
          console.error('❌ Case C 搜索調用失敗:', searchError.message);
          throw searchError;
        }
      } else {
        // Case A：雙重調用，有 grounding 和無 grounding
        try {
          const response = await handleDualGeminiAPI(question, env, { enableSearch, showThinking });
          return createResponse(response);
        } catch (dualError) {
          console.error('❌ 雙重 API 調用失敗:', dualError.message);
          
          // 檢查是否為地理位置錯誤
          if (dualError.message.includes('User location is not supported')) {
            return new Response(JSON.stringify({
              error: 'Gemini API 地理位置限制',
              details: 'Gemini API 在您的地理位置不可用',
              fallback_message: '抱歉，Gemini API 服務在您的地理位置不可用。這是 Google 的服務限制。'
            }), {
              status: 503,
              headers: getCORSHeaders()
            });
          }
          
          // 嘗試簡化的單一調用
          try {
            const fallbackResponse = await callSimplifiedGeminiAPI(question, env);
            return createResponse(fallbackResponse);
          } catch (fallbackError) {
            console.error('❌ 簡化調用也失敗:', fallbackError.message);
            
            // 如果也是地理位置問題，返回友好錯誤
            if (fallbackError.message.includes('User location is not supported')) {
              return new Response(JSON.stringify({
                error: 'Gemini API 地理位置限制',
                details: 'Gemini API 在您的地理位置不可用',
                fallback_message: '抱歉，Gemini API 服務在您的地理位置不可用。這是 Google 的服務限制。'
              }), {
                status: 503,
                headers: getCORSHeaders()
              });
            }
            
            throw new Error(`所有 Gemini API 調用都失敗 - 主要: ${dualError.message}, 備用: ${fallbackError.message}`);
          }
        }
      }
    } else {
      // 單純無 grounding 調用
      try {
        const response = await callGeminiAPI(question, env, false);
        return createResponse(response);
      } catch (singleError) {
        if (singleError.message.includes('User location is not supported')) {
          return new Response(JSON.stringify({
            error: 'Gemini API 地理位置限制',
            details: 'Gemini API 在您的地理位置不可用',
            fallback_message: '抱歉，Gemini API 服務在您的地理位置不可用。這是 Google 的服務限制。'
          }), {
            status: 503,
            headers: getCORSHeaders()
          });
        }
        throw singleError;
      }
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

// 處理串流 Gemini API 請求
async function handleStreamingGeminiRequest(request, env) {
  try {
    const { question, enableSearch, showThinking, sessionId } = await request.json();
    
    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }

    console.log('📥 收到串流請求:', {
      question: question.substring(0, 100) + '...',
      enableSearch,
      showThinking,
      sessionId
    });

    // 檢查 API 金鑰
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Gemini API 服務不可用',
        details: 'API 金鑰未設定'
      }), {
        status: 503,
        headers: getCORSHeaders()
      });
    }

    // 創建串流回應
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // 異步處理串流
    (async () => {
      try {
        await processStreamingResponse(question, env, writer, encoder, {
          enableSearch,
          showThinking,
          sessionId
        });
      } catch (error) {
        console.error('串流處理錯誤:', error);
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error.message
        })}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });

  } catch (error) {
    console.error('串流請求錯誤:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: getCORSHeaders()
    });
  }
}

// 處理串流回應的核心函數
async function processStreamingResponse(question, env, writer, encoder, options) {
  const { enableSearch = true, showThinking = true } = options;
  
  try {
    // 調用 Gemini 串流 API
    const response = await callStreamingGeminiAPI(question, env, enableSearch);
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let isThinkingPhase = true;
    let references = [];
    let hasStartedAnswer = false;
    let hasShownThinking = false;
    
    console.log('🎬 開始處理串流回應...');
    
    // 先送一個 keep-alive（可保留）
    await writer.write(encoder.encode(': ping\n\n'));

    // 依照 SSE 規格：事件以空白行分隔；每個事件可有多條 data:
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + (buffer[sep] === '\r' ? 4 : 2));

        // 抽取所有 data: 行，去掉前綴並合併
        const dataLines = rawEvent
          .split(/\r?\n/)
          .filter(l => l.startsWith('data:'))
          .map(l => l.replace(/^data:\s?/, ''));

        if (dataLines.length === 0) {
          // 可能是 ": ping" 註解或其他欄位
          continue;
        }

        const dataStr = dataLines.join('\n');
        if (dataStr === '[DONE]') {
          // 結尾：發出 complete + [DONE] 給前端
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            references
          })}\n\n`));
          await writer.write(encoder.encode('data: [DONE]\n\n'));
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(dataStr);
        } catch (e) {
          console.warn('❌ 解析上游 SSE 事件失敗，原始：', dataStr);
          continue;
        }

        console.log('📥 解析的串流數據:', JSON.stringify(parsed, null, 2));

        // === 以下維持你原本的邏輯：把上游 Gemini 事件轉你自訂事件 ===
        if (parsed.candidates && parsed.candidates[0]) {
          const candidate = parsed.candidates[0];

          // 引用（grounding）一次性吐給前端
          if (candidate.groundingMetadata?.groundingChunks && references.length === 0) {
            references = candidate.groundingMetadata.groundingChunks.map(chunk => ({
              title: chunk.web?.title || '未知來源',
              uri: chunk.web?.uri || '#',
              snippet: chunk.content || ''
            }));
            console.log('🔗 找到引用來源:', references);
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'grounding',
              references
            })}\n\n`));
          }

          // 內容（思考/答案）
          const partsFromDelta = candidate.delta?.parts ?? [];
          const partsFromContent = candidate.content?.parts ?? [];
          const parts = partsFromDelta.length ? partsFromDelta : partsFromContent;

          console.log('📝 處理內容部分，parts 數量:', parts.length);

          for (const part of parts) {
            const text = part?.text || '';
            if (!text) continue;

            console.log('📄 處理 part:', { thought: part.thought, hasText: !!part.text, textLength: text.length });

            if (part.thought === true && showThinking) {
              if (!hasShownThinking) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`));
                hasShownThinking = true;
                console.log('💭 開始思考階段');
              }
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_chunk', content: text })}\n\n`));
              console.log('💭 發送思考內容，長度:', text.length);
            } else {
              if (isThinkingPhase) {
                isThinkingPhase = false;
                console.log('🔄 切換到答案階段');
                if (hasShownThinking) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_end' })}\n\n`));
                }
                if (!hasStartedAnswer) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'answer_start' })}\n\n`));
                  hasStartedAnswer = true;
                }
              }
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'answer_chunk', content: text })}\n\n`));
              console.log('💬 發送答案內容，長度:', text.length);
            }
          }
        }
      }
    }

    // 流結束但沒收到 [DONE]，也給一個 complete + [DONE]
    
    // 發送完成訊號
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'complete',
      references: references
    })}\n\n`));
    
    await writer.write(encoder.encode('data: [DONE]\n\n'));
    
  } catch (error) {
    console.error('❌ processStreamingResponse 錯誤:', error);
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: error.message || '串流處理失敗'
    })}\n\n`));
  }
}

// 調用 Gemini 串流 API
async function callStreamingGeminiAPI(question, env, withSearch = true) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log(`=== 開始 Gemini 串流 API 調用 (withSearch: ${withSearch}) ===`);

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
      temperature: 0,
      maxOutputTokens: 65536,
      responseMimeType: "text/plain",
      thinking_config: {
        thinking_budget: 24576,
        include_thoughts: true
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

  // 根據 withSearch 決定是否添加 Google Search 工具
  if (withSearch) {
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
  } else {
    requestBody.systemInstruction = {
      parts: [
        {
          text: "您是一個回答法律問題的人工智慧，請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請進行純粹的邏輯推理分析：1. 專注於深度分析和邏輯推理，詳細展示您的思考過程、分析步驟和推理邏輯 2. 從第一性原理出發，逐步建構論證 3. 提供最深層的理論思考與概念探討，回答請先講結論，接著從民法、刑法、行政法等三大面向進行分析，若有詮釋其他面向的需求，可以多加說明。"
        }
      ]
    };
  }

  console.log('📋 請求體:', JSON.stringify(requestBody, null, 2));

  // 使用串流 API 端點，加上 alt=sse 參數
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  
  console.log('🌐 請求 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`📨 串流回應狀態: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Gemini 串流 API 錯誤:', errorText);
    throw new Error(`Gemini streaming API error: ${response.status} ${response.statusText}`);
  }

  return response;
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
      console.error('🔍 搜索請求錯誤:', dualResponse.searchError);
      console.error('🧠 推理請求錯誤:', dualResponse.reasoningError);
      
      // 提供更詳細的錯誤信息
      const detailedError = `Gemini API 雙重調用失敗 - 搜索: ${dualResponse.searchError || '未知錯誤'}, 推理: ${dualResponse.reasoningError || '未知錯誤'}`;
      throw new Error(detailedError);
    }

    console.log('🎯 回傳雙重回應結構');
    return dualResponse;

  } catch (error) {
    console.error('💥 雙重 API 調用錯誤:', error);
    throw error;
  }
}

// 翻譯服務備援邏輯：優先使用 Google Cloud Translation，失敗時使用 Azure Translator
async function callTranslationWithFallback(text, target, source, env) {
  console.log('🔄 開始翻譯服務備援流程');
  
  try {
    // 首先嘗試 Google Cloud Translation
    console.log('🌏 嘗試 Google Cloud Translation API...');
    const googleResult = await callGoogleTranslator(text, target, source, env);
    console.log('✅ Google Cloud Translation 成功');
    return googleResult;
    
  } catch (googleError) {
    console.warn('⚠️ Google Cloud Translation 失敗:', googleError.message);
    console.log('🔄 切換到 Azure Translator 備用方案...');
    
    try {
      // 備用方案：使用 Azure Translator
      const azureResult = await callAzureTranslator(text, target, source, env);
      console.log('✅ Azure Translator 備用方案成功');
      return azureResult;
      
    } catch (azureError) {
      console.error('❌ Azure Translator 備用方案也失敗:', azureError.message);
      
      // 兩個服務都失敗，拋出綜合錯誤
      throw new Error(`翻譯服務不可用 - Google: ${googleError.message}, Azure: ${azureError.message}`);
    }
  }
}

// 調用 Azure Translator API (備用方案)
async function callAzureTranslator(text, target, source, env) {
  const apiKey = env.AZURE_TRANSLATOR_KEY;
  const region = env.AZURE_TRANSLATOR_REGION || 'eastasia';
  
  if (!apiKey) {
    throw new Error('AZURE_TRANSLATOR_KEY not configured');
  }

  // Azure Translator API 端點
  const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
  
  // 構建查詢參數
  const params = new URLSearchParams({
    'api-version': '3.0',
    'to': target === 'zh-TW' ? 'zh-Hant' : target // Azure 使用 zh-Hant 表示繁體中文
  });
  
  if (source && source !== 'auto') {
    params.append('from', source);
  }
  
  // Azure 請求體格式
  const requestBody = [
    {
      'text': text
    }
  ];

  console.log('🌏 調用 Azure Translator:', {
    target: target === 'zh-TW' ? 'zh-Hant' : target,
    source: source || 'auto-detect',
    textLength: text.length,
    endpoint: `${endpoint}?${params.toString()}`
  });

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Azure Translator API error:', response.status, errorText);
    throw new Error(`Azure Translator API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('📋 Azure Translator 完整回應:', JSON.stringify(result, null, 2));
  
  if (result && result.length > 0 && result[0].translations && result[0].translations.length > 0) {
    const translation = result[0].translations[0];
    console.log('✅ Azure 翻譯成功，原文長度:', text.length, '譯文長度:', translation.text.length);
    
    // 返回符合 Google Cloud Translation API 格式的回應（保持一致性）
    return {
      data: {
        translations: [{
          translatedText: translation.text,
          detectedSourceLanguage: result[0].detectedLanguage?.language || source
        }]
      }
    };
  } else {
    console.error('Unexpected Azure Translator response format:', result);
    throw new Error('Unexpected response format from Azure Translator');
  }
}

// 調用 Google Cloud Translation API
async function callGoogleTranslator(text, target, source, env) {
  const apiKey = env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  // 使用 POST 方式，API Key 在 URL 中
  const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  
  // 根據官方文檔，POST 請求的格式
  const requestBody = {
    q: text,
    target: target,
    format: 'text'  // 添加 format 參數
  };
  
  // 如果指定來源語言，加入 source 參數
  if (source && source !== 'auto') {
    requestBody.source = source;
  }

  console.log('🌏 調用 Google Cloud Translation:', {
    target,
    source: source || 'auto-detect',
    textLength: text.length,
    endpoint: endpoint.replace(apiKey, 'API_KEY_HIDDEN'),
    requestBody: JSON.stringify(requestBody, null, 2)
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Cloud Translation API error:', response.status, errorText);
    console.error('Request body was:', JSON.stringify(requestBody, null, 2));
    console.error('Request URL was:', endpoint.replace(apiKey, 'API_KEY_HIDDEN'));
    throw new Error(`Google Cloud Translation API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('📋 Google Cloud Translation 完整回應:', JSON.stringify(result, null, 2));
  
  if (result && result.data && result.data.translations && result.data.translations.length > 0) {
    const translation = result.data.translations[0];
    console.log('✅ 翻譯成功，原文長度:', text.length, '譯文長度:', translation.translatedText.length);
    
    // 返回符合 Google Cloud Translation API 格式的回應
    return {
      data: {
        translations: [{
          translatedText: translation.translatedText,
          detectedSourceLanguage: translation.detectedSourceLanguage || source
        }]
      }
    };
  } else {
    console.error('Unexpected Google Cloud Translation response format:', result);
    throw new Error('Unexpected response format from Google Cloud Translation');
  }
}

// 調用 Gemini API
async function callGeminiAPI(question, env, withSearch = true, customThinkingBudget = null) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log(`=== 開始 Gemini API 調用 (withSearch: ${withSearch}) ===`);
  
  // 確定使用的 thinking budget
  const thinkingBudget = customThinkingBudget || 24576;
  console.log(`🧠 Thinking Budget: ${thinkingBudget}${customThinkingBudget ? ' (Case C自定義)' : ' (默認值)'}`);

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
        thinking_budget: thinkingBudget,   // Case C 使用12000，其他使用24576
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
    console.error('❌ Gemini API 錯誤:', errorText);
    console.error('❌ 請求體:', JSON.stringify(requestBody, null, 2));
    console.error('❌ 請求 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    // 提供更詳細的錯誤信息
    let detailedError = `Gemini API error: ${response.status} ${response.statusText}`;
    if (errorText) {
      try {
        const errorObj = JSON.parse(errorText);
        if (errorObj.error && errorObj.error.message) {
          detailedError = `Gemini API error: ${errorObj.error.message}`;
        }
      } catch (parseError) {
        detailedError += ` - ${errorText}`;
      }
    }
    
    throw new Error(detailedError);
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
          
          // 4.5. 移除「參考資料來源：」及其後的所有內容
          cleanedText = cleanedText.replace(/參考資料來源[：:][\s\S]*$/m, '').trim();
          
          // 4.6. 移除「資料來源：」及其後的所有內容
          cleanedText = cleanedText.replace(/資料來源[：:][\s\S]*$/m, '').trim();
          
          // 5. 移除「**參考資料：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*參考資料[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 6. 移除「**引用資料：**」及其後的所有內容  
          cleanedText = cleanedText.replace(/\*\*引用資料[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 7. 移除「**引用來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*引用來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 8. 移除「**參考來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*參考來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 8.5. 移除「**參考資料來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*參考資料來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 8.6. 移除「**資料來源：**」及其後的所有內容
          cleanedText = cleanedText.replace(/\*\*資料來源[：:]\*\*[\s\S]*$/m, '').trim();
          
          // 9. 移除從「---」開始的參考資料部分
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?參考資料[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?引用資料[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?引用來源[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?參考來源[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?參考資料來源[：:][\s\S]*$/m, '').trim();
          cleanedText = cleanedText.replace(/---\s*\n?\s*\*\*?資料來源[：:][\s\S]*$/m, '').trim();
          
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
  // 記錄完整的答案區 response API 數據
  console.log('📤 完整答案區 Response API 數據:', JSON.stringify(data, null, 2));
  
  return new Response(JSON.stringify(data), {
    headers: getCORSHeaders()
  });
}

// 處理範例數據請求
async function handleSampleDataRequest(request, env) {
  console.log('📊 處理範例數據請求...');

  try {
    const url = new URL(request.url);
    const example = url.searchParams.get('example');
    
    if (!example || !['1', '2', '3'].includes(example)) {
      return new Response(JSON.stringify({ error: '無效的範例編號' }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }

    // 範例數據（從 sample 文件中提取的結構）
    const sampleData = {
      '1': {
        question: "銀行是否有權片面要求調高房貸利率？",
        groundingMetadata: [
          {
            web: {
              uri: "https://www.fsc.gov.tw/ch/home.jsp?id=96&parentpath=0,2&mcustomize=multimessage_view.jsp&dataserno=201904290001&aplistdn=ou=news,ou=multisite,ou=chinese,ou=ap_root,o=fsc,c=tw&toolsflag=Y",
              title: "金融監督管理委員會 - 金融消費者保護法相關規定"
            }
          },
          {
            web: {
              uri: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0380098",
              title: "金融消費者保護法"
            }
          },
          {
            web: {
              uri: "https://www.banking.gov.tw/ch/home.jsp?id=60&parentpath=0,4&mcustomize=news_view.jsp&dataserno=202012300001",
              title: "中央銀行 - 房貸利率調整相關規定"
            }
          },
          {
            web: {
              uri: "https://www.judicial.gov.tw/tw/cp-1047-89123-2a3e9-1.html",
              title: "司法院 - 房貸契約相關判例"
            }
          },
          {
            web: {
              uri: "https://www.cpami.gov.tw/index.php?option=com_content&view=article&id=10001",
              title: "內政部不動產資訊平台 - 購屋貸款須知"
            }
          }
        ]
      },
      '2': {
        question: "住戶不滿管委會決議，可以透過什麼方式表達意見或申訴？",
        groundingMetadata: [
          {
            web: {
              uri: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070118",
              title: "公寓大廈管理條例"
            }
          },
          {
            web: {
              uri: "https://www.cpami.gov.tw/index.php?option=com_content&view=article&id=10002",
              title: "內政部營建署 - 公寓大廈管理相關規定"
            }
          },
          {
            web: {
              uri: "https://www.judicial.gov.tw/tw/cp-1888-204567-2a3e9-1.html",
              title: "司法院 - 管委會決議相關判例"
            }
          },
          {
            web: {
              uri: "https://www.tcg.gov.tw/ch/home.jsp?id=5&parentpath=0,1&mcustomize=multimessage_view.jsp&dataserno=201808200001",
              title: "臺中市政府 - 公寓大廈爭議處理"
            }
          }
        ]
      },
      '3': {
        question: "公司可以要求員工加班但不給加班費嗎？這樣是否違法？",
        groundingMetadata: [
          {
            web: {
              uri: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001",
              title: "勞動基準法"
            }
          },
          {
            web: {
              uri: "https://www.mol.gov.tw/1607/2458/2478/2479/",
              title: "勞動部 - 工時及加班費相關規定"
            }
          },
          {
            web: {
              uri: "https://www.judicial.gov.tw/tw/cp-1737-182456-2a3e9-1.html",
              title: "司法院 - 加班費相關判例"
            }
          },
          {
            web: {
              uri: "https://www.cla.gov.tw/1950/1952/1955/10734/",
              title: "勞動檢查處 - 勞動條件檢查"
            }
          },
          {
            web: {
              uri: "https://www.bli.gov.tw/0003570.html",
              title: "勞保局 - 勞工權益保障"
            }
          },
          {
            web: {
              uri: "https://www.ntpc.gov.tw/ch/home.jsp?id=28&parentpath=0,6,27",
              title: "新北市政府勞工局 - 勞資爭議處理"
            }
          }
        ]
      }
    };

    const selectedExample = sampleData[example];
    if (!selectedExample) {
      return new Response(JSON.stringify({ error: '找不到對應的範例數據' }), {
        status: 404,
        headers: getCORSHeaders()
      });
    }

    // 隨機選擇參考資料（20個到最大可用數量之間）
    const availableReferences = selectedExample.groundingMetadata;
    const minReferences = Math.min(20, availableReferences.length);
    const maxReferences = availableReferences.length;
    const numReferences = Math.floor(Math.random() * (maxReferences - minReferences + 1)) + minReferences;

    // 隨機排序並選擇指定數量的參考資料
    const shuffledReferences = [...availableReferences].sort(() => Math.random() - 0.5);
    const selectedReferences = shuffledReferences.slice(0, numReferences);

    const response = {
      question: selectedExample.question,
      references: selectedReferences,
      count: selectedReferences.length
    };

    console.log(`📊 返回範例 ${example} 的數據，包含 ${selectedReferences.length} 個參考資料`);

    return new Response(JSON.stringify(response), {
      headers: getCORSHeaders()
    });
  } catch (error) {
    console.error('❌ 處理範例數據請求時發生錯誤:', error);
    return new Response(JSON.stringify({ error: '服務器內部錯誤' }), {
      status: 500,
      headers: getCORSHeaders()
    });
  }
}

// 處理虛擬引用數據請求
async function handleVirtualReferencesRequest(request, env) {
  console.log('📊 處理虛擬引用數據請求...');

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    
    if (!category) {
      return new Response(JSON.stringify({ error: '缺少類別參數' }), {
        status: 400,
        headers: getCORSHeaders()
      });
    }

    // 虛擬引用數據
    const virtualReferences = {
  "車輛竊取": [
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGU_uIrTW2WVzSVuyzr__aqoQ0L2iZ-l9fM8o7jdbR08EGPGOW4bXd7i_KOU1e61Suq26KdruR1ziH9-oUV9dIWxaH3IyEn3b9gZGK6bqTQh_xBubLRvAdReOUfad9Awxsd8UKEvo3om9W5o9xGYFYaDQ==",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGm7mBgjgQ8qfw_f6eUX8eCbFYbEVUsCw8hFZ1dxgeBUDLLThOQZ0TThGbOkCoUvxNlWhQl4y5wRd9EO2gdmWXmUfgHhJZZkG9ThhO2zEF_gSZUk6fulf1EOFiecRTCeydKDxOt3yJ_10_nOT-UPBKsuYEpkSTWj07tZDQfuAURWJkmLaz09EvrtXhrwo2ZTVw=",
                            "title": "laws010.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3vfsPY9vVBEDicCU8E2hL4l5_iGDmbr3JafeQpTqxYWheQLiQI6JebrHgR9Cxp8h-jNzJGl2TgIRxfFCZmc0JMcnG7X-mkVfRO60u82oiRLWceuaveD-2g5jGwdCjsR5is1vQ8CpSA5ODqc1Z2Q==",
                            "title": "alicelaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEN2Ou75vMY2AXcS1AxI9iWmTCVmTYoP414Glqi_-eD6IyChDREdx_0qe53YCS-4uIOZ9ijTZF2JfmWvOqu7Oweg_A2W7pztK13lj8_mwLcAU2K4dToFiG1DacVv-trBnAhea26Y9dtzk565OE4L8J11KT9N2znHYwqJ_AwbBf4piXJ2n3y33UVJAYohNThEBzfP8HeI2XEZRQOIiacz-3GdHMuh9JgP2wBRiEemQcTW5qm9ZSPy8S9jPEipeZJfAl6s2yoq4zx3DFvGE8=",
                            "title": "jclaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1IdowoENhQMT9DduPvZAjCr-d7D6CaIDxeOYvLbuXv5MCUF7VGCa7aCE0CSg9P-hvJoOtIFXZNqwBXC_hgTP0cTz4AQduPYFnNGxN2y96Zu_5rO1nKrc2Ii947noit_nItkkiWntLY3sanScnvMoZI14j",
                            "title": "mobile01.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGqEAM2sZSShp7mvlUFk7Rkhlbc_1zFv7XEhbqQjBsMKOw42iKGolR5TyY3bU4yF7wkZJbep7tM0gxsQStlO53AAg937W2_kuOTSCUX62O48ivCYE3VlDM4Y20IumOOWVK7rsAo5HSyj8YaJg==",
                            "title": "lawinhand.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_Mm19Cwp3AFd45yipY1sfKL82x4YdiiaOTanQfhb_6wQTdCXiKh-SgPNiyDWlhCskgC-6b5W9U5Lc5h8GEvctTBP46-NJd7oR0ahxwysWp8cQEqg3_8sbl_KmpFe50eXkyBAVm_Qxj_bs9KkCHuvejlqPgTQt5McKmJmYYnN7fjvMFQ==",
                            "title": "superbox.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpXXm5TdZrwprvmnzdk0LUJ9yba80hT1dqy3GkxBI-5xLZeIfhCk_vzNteiYEHI4UlaRKJdNJWMOQoPz6KSoeqeu_rZTenQMiZ38fr8UmXOc1WgpjLjIxDwA6UrS3PIleFAvONwSMXrjCKV-FV4U4PV_hSJlW3L_yL",
                            "title": "lawbank.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKWQaicasaQjArfrcDiqBnQ8PeOLKbq1HlARxQkHCzDYDr2PW47PE3ZfbVzCMYTJky1kTlWI_Q7XK9y5c0XeO5LrG9i5FgHhdtFyVp9a8lK2KLUugZrOPk1hMRSjWlQscUMo5vYBK9AiQ439k4AoM2_08XkCwm3tbgFPWBjVnk",
                            "title": "lawbank.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7uMSTeGDp3L5-W2NxZXhJW0ovascj7YCz1z5Oib9JPAqldKLaj4dTh268FiaJ4OA3mqQ2SwcBbOAZ8-d4T4tUoXeBOEn6TRyndO6m9IFQaIziBg8PSLBxRZacVoUYnSIwxKYppicnDrl0U3fbdZmIzCx_",
                            "title": "mobile01.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQOZm9xOve9xVyk1pul6LfRUDt6-LnISIdeIthycsSPfWxfuxqfQucUZwnAc-KgqWRSgZ0wVv555D_H6-jl3Txh4XSY7D6xjBTQu17aiu6uM6a7Z-uCCxigm9D3khbKc1rYUXgPcLsJ59thUg=",
                            "title": "justlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQf1UreVUptaozSzC9GXt05xHnr7ngnkW4wqj6ZmrooodE47z16jMYbgG0C5CcaGwYFhrCV7_szu4kPPPdjLWkWC371lPyB_gOMp7lZlo7pdSrvOuFQsnqbRQJB6HzOonxNTKc8IeV5p2hlOFhTmXf8uO1CqEV_aQZ-X5Ogz1oUbsA7vW9vzyxDj1n2lQRO1_ayyg3_TuGoe6kCkpVoVZErE2AW5d9hZcAjxS4_wRRKPZRFrtrDVceUGInmaODQXWR8yXki13jMMmCDPoag8GIZ_E1e7MRSNsgHd5uUWDq3ZMtxkKnSjTr_NS4hr6l6wOEuj6WvPTEfE5JW3SBv43k0kG1hXk=",
                            "title": "jcyattorneys.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYbonzIaafQLUa2n4nhxLpfHd_dcEaWAahwCU7l_BU4QuoZSUvrZ5_4GwRLobxt5qLiRQ2XCYBhfbBactTRRNAtNPDuBDKoytLyj5-4UHIdL_ZsaX8gTRjSEhxIt0=",
                            "title": "lawplayer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4g0a5HZXO5Fd_ci8mBy7f4thDqe7WnIkPrIXxx4M0gyJKsO_VdMg1xs5ItaB4sdTazWtEfYNtxraqrCaxlbFHa3nK9Otm8Tfo9i5IhfcJfzO3ENpaiS_gSsBKMIuTBDC032bcnok23uPc23g=",
                            "title": "justlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7VdP_g3s3McRlmE_3BK4V7GuJIY9i5aoVjTNNP1bWg-stfJ4nGsSF8AstxjpOc7yZEP7yR7t4selYA92BnynNDpoTVnll0x3ZXpyARwmhk6zWiS8_bRHstRD2TxbNtZvBrl6_xg==",
                            "title": "honganlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFczgp-RmTjMgFyUWjMJJozHCqBlZWJRRxTrGazm6KoXxR8ycEc5A73C_iuDGf1pr8fgZKwo-4mcdy-jQij99phLUTOKKYqcjOm_oPwCJTZIikOuk9A5Z_qBh2cDFQ_AwKII3umCE8tbRY8DcbaPDmqG7DPg5k0HVkbjPtf2HNQTzb4cVHE1Ab9TsYIbM27rhzvJ18lTbcc-jrVVfPrOIbLTyrPWXIGrsz1gTugY_KOOMGZti1ZBMozhMFPFKXfDAwvp68HzwBqgtasOZAdOnG3gRfT1ECGVmM2zl2J0TTL3tsv-SOK7ym9kvZPYrPVRAq5L_eEIBdw8qfKDb35ADW0h-5PVI1o1RfORA9mCVB8FKyb1DstqrR6rDd6bFE=",
                            "title": "jcyattorneys.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtjXLSXjoU67-_oOYYmwdUxP1_eWpPrmLflcPS73Ud-OWDwhDKitzaECuY1lDYbDez7TLMSIPAAzfCpfx6NDzuDrnrH7ImkHhWkQGr7xWylbQmiNecoBSlcDSNQdmbWeosdGJqH8vn78AdrQpdHcYT",
                            "title": "motc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHR18x3sFOCotsy8leO-hZjXz2ISx2LRI20lGRoVTWFRPumki9i4izq92KeZc99gcYX0N_D0f9DM00E_BQkedff7oL7G1OxB1pNhUSn1UrkVtY2D8b7JpxlyMTOA6ghoEWqmWw6sFkJL8y5R27X6Zl8l4g9WKM=",
                            "title": "xn--b2r864ev6gb9k.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVYcHnqnYgbGC0ne1SAl0m3_iwPgLUfwmwczWgdaLyvEya-ngoSWB68RLZNArr_2cD0OJv9-N29zrZC2On3NE5BxlYMmTYXx0zGxISI18yGrtQ5eVEce64B8oEhyE-oYNpHQDomk8=",
                            "title": "youtube.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHTcR6zplgTYHNJOh8NX_6w--xUIg87HQ4zO1glGkwZMbTtHkjo6LcTiRny_RHhzWWQngoAucYBN0lr-9cC341zcJEgYvHv1fcxzH1B3QO0Y1UnVb-WHHVs2rt4MhL0uZ3p6FY2MpV70GGHofRYGg4LJRY=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGpiSgx6BsiXq0-aoHJWDSHxEt5bG9ZNSlq0EzozpiWh2NqXvSiOM0sU033kMoGk5FzvK_tJsBRoWF2Mg75MMcxUUMw_43wlNyUUJyxnW-TTtSqmgBWUEKte6nasFDtekIEEPf5Ff7V1pUJod-m1Pa0eHdsOKTPj9G6LJR5J-PRk2XaNfy37ZaJ30p_dKL5ctnLHzQMDPBW6iexi6Dvym-uiLkiw==",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3sn67ktl_hpooOW_ZrX_nClBksbDwaDQEqJts4a-J_Vz1PevowpWJKRYrvl0_hbJBo_0AI8jIacDdqwM9NtoZhl7Ipueyyk2qE2cjGO_ADjoZyBpGex8Q-jkDiR1VXEJ-Zg==",
                            "title": "lawchain.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8s55JnMqcFQ15bOU1GakHhNst9xz0f5IAXgXFCSbMMXsWK-prjeo9SXHQE1QMfLFL-7KqqFq8sI7M48IRFrGfJ4KzpjjRqGoE7Un65kltqdhGaA9rue6vCWsX4ViZH-HtJn4l-Pn-0YZe1gL3Gica8w==",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfFzZUYXyv_mhzL3Z8-HnU2SwZrErgnyv0B8Qo7qmvN2WPhZu2khJGNf8ddSHqdEm5phvny2qMkfdnJu9rO6LJ6LBDX-cA2JZL3RwRPfumpzho1qdiwGZyY1WYt8LgffAPDjOmum1F8Pa76csRUza3636OD3MA2oFV1jTFFc7PWKDz_lP0CEdWEqKPL0BqRBM=",
                            "title": "laws010.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEG_DFIFJ8RVaM_iTSVwqyvtTGP7NYh6KeYlRzB6XTUVGrTeVWuW5o3Zn9aRWhGQQI1mDvXWfNI_hWEAwe8Jhhgs25BWWQC6mBxuUWTFAMOd3bxY84Xi3wklfbuWcmeGfhldUE4BxsZ_7SNw==",
                            "title": "lawinhand.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFbViZjksHVGJvPcL3T3i0WccmRl3SUH3QYlLcXRsv07GS2WykEO0CO3hb_hfDaeJbmk4hlJgorumzy5py0nyjrbON34pGhr69ufVyZoT0ZB79GvfiH5kVGtptNGCp1a42rPz8dOAEldAj_P5AtFg==",
                            "title": "alicelaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG50fS-YdWmQPiYtH3xXxjYiKWoDtGffPHH3fWLiy50_B5P03ohtrUX-iB_qLusKWoLr-QKr3j3g11UoXmGZMDGt-mgP7YLKOCyPI-exlrd_V-VLNaYxGrZTJsuOu_z-LQzjQ6lMjBfU9PEzigF6TAy9gmkc4NL5TwlI5T--L4Yw6j80eBhYQcM73Jk-_j9NtQ9tj4DBEzkIAm5g9LL7zoH3cNdufKz1KAcX2DrJYfC14vnosrjH-dEFib9TCyBBHH5nD9v3aDM-E6FBh4=",
                            "title": "jclaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGsSyza2EMOL4gbjBHCukL6eCVxYmMsfqX5TXGyNdA9dIyBXwWKy2YvnYJ5d_3XXJPX_2Ftffzx2fHVj4pBocdHsciiWOkEvMqNZmiAC09AZ92JBR9VgGzmhAgAQl2hgdKLLXna0TM15FNt2n2r1-4CSv6-",
                            "title": "mobile01.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMY9to6hdBftNemr4zEZYo8u6RPc4UmQksVYUD3GybYFWqGym_g5Xlj_iyLynHNKrYnq8hO0VlfUf_r8HuaOkVPC-QfGS7voGUZvi0DPc6hZRKkRuZLJEGVgpoa65N1_50RChHphqdmK8D7okjBPZiQVD3",
                            "title": "mobile01.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE_JiiPr2bxRifT-BPS4V7ssbrzYrpxi8RWFkE4PDGOP0pwj1k3Sl1jhceyxz3HwosrDSBrhVnaPfIQGgoK46RamwuDqSfpWOGv0ndvSV8kFZzaBh2hkyNTi0WNJdw98P3mKzftg81x7wpKQ8oiOoBsP43onH8W6-vr",
                            "title": "lawbank.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1v7MPyf7xUWBV1Dit_q4C5GGtpTE0hI8PS6_hw3aSerTBAyxB_KZnTyNmykM_ssltn9PURUya24E8g6fAV2tbE2hRvO4OvCczy0CITdCjsR1vrIONrN12qee3Kz3zGRI8BHtRM5ldoTwUTG_PtRJfMXfGj8qIInUOF7-b7mJK",
                            "title": "lawbank.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCeEqBkBtvWqhGJe4Ec3KaUJgHwTYBTmeREBamjJ1X_TxpgzvnvOF_2ucQehMqo9cywCaGVG-9650hopGI28_dB832aV7Z6XVN7fLpPmPpzXhyB8vZj3h9aCxmkztBLIhlVBhu-vdlodkZPuZ9gx1NZkNddAKQOZ_TTwDMJxWEO2IplQ==",
                            "title": "superbox.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGk9XZiZfIhr06z-cmm6-5Zvwto_9n1yKidwFHl70RN_IieYJU_qx9Iyy9tJsH3xKyfhJITsDab6XZlMoQF55jCyfYiep4geXWO87RrAz9hhOLF9M29WX-_xbcEQwn4oIEuDPxjD9GlbxuDqRI=",
                            "title": "justlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHRO5jniXJ0xz7i3rlDRV7ybZ9fnpuMd9Rst42xSuRT6UzPXO4y_PguoBNByWEJxeLkO_Lhu3lnA5CD2DE4dYNT82uiGvNu8-gfmlkHPg1DX4lu-VVtC81G4QUuBIVBC79eLpixgHe2Viuty1Ixra26KP0j_ef-8P_BebIVQMdj8sD9hy-HlYTMPLT3XuAPc3dFi7FefMl0a1BjK2t6xR6jwjjgGwT_-m6qa8FAJmLmtLD1IYBNiEaEH8X_Ws8eclLTJR1M6iKBThfwhD4x5mQ6E_QehgKqYi8Cy4xKL9gZ_ogkQTkNMb7g6DYeYIgL_-X1BKnHxP3DPVemZxURzKIWdg72c7s=",
                            "title": "jcyattorneys.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGNFyy0zUJWHdm9LRv4KEDDVUc3TBM5xBTLGNWl6ldNZKiMZF8Xejf0Pq312BK2GcmzHfRDQ7AkBcW9Q7KTGPFLiL6oKsDACLAvBQgPbo4x_LK_9B8zR5jWLsIU3z8=",
                            "title": "lawplayer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQElF7FEmPU1D0NyyqmY7nB3IbWxyiP6GjPqyAobexy0cJG5STMWZNBZo4FF06iOYvfthw8dvHo6YE8fFLrm3-t6LnhorUw6tnS8dt0DIjeBpK3wTB5xdO04nSfbfjJC46Iybo8ajUImMP33dh8=",
                            "title": "justlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-S2o1OHddfmDKyq50lNXVn5ha2fIQnmEse-cZgH1JOzw8wCyQWU6JDqMQbyXGIX-p5NcWeoTboZEBh3TKPoR-354i_vd3Iv8jtL3fTTQJi8vCttu8IuCwwL5xjVBh8_X1_DrHBYHJmDwtdb1-viCnTbpd1630006L17uRF341sEs1IcMenBeNu8dMbUX7B-7oqDDuEfFRDrXlqH5uWQ6tJfQkA4pj_yNKCUO7FEQYReF9SN3NtNjG9x0wTEzPnIsQxvNXfwCjhml1wzE690bLJN1vQ81aAoGAhLt3k6xZEres6fWEQIiSte05rUt9X6WA6yTkqxqpejrEEy5533GgMxwgXzw8tqRSlHS8PGaT3CpjPbCMHZWZTVmXjYU=",
                            "title": "jcyattorneys.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGU21gGN_DxgyriXbi_ja6C9E5WQ-aSfPSg9L2hB7n5we2YO2dto4DVYpoazeL8L0zfz264y6bsOsnTYPK2VmSWEJze489rVNXghRTPhO_sf1vp3BYv7jmCntklWHUYyT3G4CXfwTQEyWGgnfIx-Czu",
                            "title": "motc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4s9IvHo-WYjBnQzNTIQFsMopaeUPkQPMteVNfCm1QhP159DLt5KuMB49ucpy9vzt_8W7BprDle1B9XH-RWCuh1D0OsJWlChxlH4FeyQKrWxAWrbAICcfGgxO0Aoio_oNWHCp8BghoLUKE8LgDNvohMQKcaEw=",
                            "title": "xn--b2r864ev6gb9k.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5fdYAoUMu69zoY4f9nivH9nIM63AfNOGZJiHl2jpieV4-i2cwHcgkVb86lGpYCF8jvhJHUeQpxaW0hvKBzniC9FQ7NuYu0NBorIlywp30SjDKXMJGvIBL2ufVxNrITQgl9rJRJrc=",
                            "title": "youtube.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFdlJRB8GE5Rc7jYf2QNlbNinOzAqe4_mmL1_3KWai7A5eRaMluzSF2axij6sv-s9R1orni7J82PHFvFglOSHmHtpGjznC-Ry26VlxQkrzWNOjyTM0fxhYiJqi42FnaPArVQIj-qNFxVP1h2HuIrAqglvI=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0FhSbDcrsL86J5g2uEpYJpQOnhEuICHOoDkG_MrjeLkl7qgO6uGSgNCwZW4VAdUv2Fus5K0fZGGX3bQsfRAJecXhFo8i22bvXqMDVMhYH6XWN9-dbadmcR0OFeff6k99dEPqWFKqj0uZEx8boZcIzMsUfh_2x8LKRBiDZogjUCY8q0_SFtUVmxGnBclfO1_Mf6A2nv-Ls8Fv-HCqiLpZMhOfyRg==",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5gQQqo_xt6ANp6Aswf8DzQjyqDyvMMU12CWtz6XVKnPIF9fQRSjetfN64r-bgl-sBa0ONRoyW04a3mTrsQOcX2oGpeIPzQ0lpkQUQyU1kP-H4euqPY3bnRHXh4c0nNcWYVw==",
                            "title": "lawchain.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1Qg09cTBdJzEz2ilb8HGSL2YQBE1qN26JQ76fqRYqop0RQJ2mzmJGHObNRrNlGy3UwUWlW4fF2rhgThLY8yUqZJxs4NYolyBoFj344PmHB8uTCAeoeosHBfAR_QLO1FBHS38=",
                            "title": "lawplayer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEUSbSFEEVa0kWVEEXOWS9ppnU-k_0zSBsBj2Z2rOcHe8Zf44Dk3VgtYiHrwlDYhpqEOvHBrO6OSFmw45gNSyI1AyICdnxeftrAR8BkAwcWtMht4hEHhbsOF2_VYC5eZWiBlTRIy-c-InoilCtlFl0=",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3p32k0cPLarLoGgvDZbLDaulE-5DB2EMUjFwBEgth3CU5tG9CwCID0pS7oFH2Qr3eNwZd9vlGd_LWwwa24PRPwUrc3gtWkc300ZHI5UBh7ufqRomyDsYi3lNGdOL7nHRpOjo=",
                            "title": "lawplayer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUw4XZZYF119bO3eFLqf1RKsbK0TjIMn-EI7hmOnF1HMfh0FIr-9mv-wREyEOhyplqgD9FEvKyuEEKFe4oFL_A8Ng1v_4IgxuUOPwuzQEcL0saloOyGQfLXBzZM-J2ujX5hy2jkikV8cww1k8vKsj-7r1Rg7guif7dtfH9xY8WOpoG4JRUDI40XXA=",
                            "title": "moj.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEa3Ups5_Yujjtvw38D8ezpXm-2b-n8z_fxWl9zuLMCfT4OjoDQRNAteL84Iq4uoCt3EC71wc7k3nYYp6B_9ZdKq98iXx3kngJqKDE8s15hyh07L71KObYUU_3iDW4=",
                            "title": "honganlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4ICmmXghrvDtxxaCK3eXUTdeaUMbVfXSA1MU__xgN3hu3uOZwDgVp41Zb-FGrTw-xKvJIkiLZZ3bKXJb9jMvAo8HDi7uHtETuByoSPAD0XsKOFcT4nbCW6d6xiH4rAuETGHUkGXjexrHEZl_dbbc7yg75GM3g",
                            "title": "wecareweadvise.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHyUPo6FPt9wAvpWCR9Fr-a6e5nHhci-nlgv9ROeNEG8B8KOlox1Ct3iltHE7eZeUyNHhIYw7GTAK7TH6CM5iVtpcklJc7hvR7RFQPjOFPFRgTaisubXTjirvm20FUQ-z3_CaroI11A6PyBW3pi-NtkTMZTU0YGcDYuy-BTwusu2zz16XKwu-15NrLFWH6lA==",
                            "title": "laws010.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHoAfA1-SvAZTo9Hk5lK39qbZ196gy24LG7nhNH-Tql0r-2_MzSeAW3NTNXXNF3TffxbHgDy24MCaqQzwCi924UYgB6-RrwA9UONJdG-Rfjbs-JYl8fmLMjwvD6ilNXdw09LsPe1GN1kExYQeiM2RByYsqombPpAg_n8iSiZcNkwoy5Y4YEsJCKeifkG04yW2FPezbgW95eTTQuScSD19Sr98qn6r0Pp6VJeCmHz6FO8KHwCVdsz-oWukvDLF7JTctYD44EIfd9-rtl87pj44ukzI58BUuZrojJfPfFrikua5nsFZeWybq0bqHOfJs=",
                            "title": "nanchang-wu.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEP5px-ehrBzgWreXFdZ3Z65zXuIt0ZPGpgfyIKtjcXKI_CLCIVZF6HR3NRJ4GdEsb-krNQBa4wehrlWkPGQcJtz_W6350AZg7EvND7spcPyP8jbVK5Wcf26gHHdP4Rk46tiiX7YE2zy1HQ",
                            "title": "lawinhand.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfmKYzHlUsjckCg-fHUMxsTS4t_ozvI087V3fr83PkQAJapkiJ7_u25BmhlQiFhUaHpIf1gm57_KnTn_FgENn1-xJnPHUcbTWvFHibErEIP5dhE0yHdBrYveS-0ZziHIrInUIG",
                            "title": "honganlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGJdRBNvwkGB0pIj113rf_gnFLt1Te-ywPWldHrI6O6edqd5TcogjdSzt2LIT3mAHkU7yxdOIP17gHAppKjR6ndIxYkTkEQISZ5MIXagzeH0_h2mLKXC37bqjdpG2sT_txZJ8Gw",
                            "title": "vac.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEz0FyAi4Bw3YBTMgyXKlJ01VPeBPYMrTUkC1bCxGTO7PZkuywIs-klPUPI0v0q-W-p1ai2lXbAvUcwjsCEyeXLqI8lpOwFjAhbp_JHeV_KogmvMQJJBMRP7FU26D9z_y7lR6UuJe07lyRdjZ7K5nctIuhn",
                            "title": "sf-personalinjurylawyer.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHajM3GtDqDUiZJwJ7mAjr8TAn04ciaN5VLAPfRbS047ElgQt2RF5cYYmGZR5DFVlHNKYkDTUe8Nx7mpy5CD3-qnZ1eaRGNomqLt2eKfNhEjJy5emFdYJ8LBqJnj1CFWDRlewI89vC6Vq1BIQO_",
                            "title": "public.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGo8dr6eGhdEejbGHBRqj8G2C8AHxVbrdoSNF2m0B4ZjCne-61PogdsNP9s_tiSuA96-myPRzrkt_BazDOTz_9pKHo2qsLBWVqvgPQx_H9apdnx5MSeFkmYumld1kJPUMoZzD6QCSDi-_AshdycNOCJO45Qbg==",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0yxkorvKKNIg4MPKenAgk22ooc8adM3h6zJ14CCAKu1rLNB-dLQ8pYK4fCncBkbNnNR7VDVWNug-VZt6zLx3ihUYcXnbw9yHjigq1DH6G3uVjpIDt5ZJA9fI8bYGU9e23ASrHjji2yHV0hV_6IhgNXiuXzB886LN2-ROPl5qj-d8w_0A4wqVuoYhrFMHw_TcP-gsJyOAdE_rZ3LFPgHRF9rm-ODMHZyKHYkmoDqr-aNdwmppR8JzfAKOSbvqCjeSeT3YyB7H9FIGP3XL4kqp6jBBHe-gM",
                            "title": "gj-law.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAw29A--18JLHmDl1zO7Z3LA-2n4yfEUQENJu3dnqKQggsBXtF8n9IRFClHprFKNqxbS6DFCaCOr0t-H-9nJQMbD7_sKvn9o7r7qMdNYCbMbt8bECGetHls9Dr3VoEozjBDsKB7OsqD_aRmw==",
                            "title": "zhelu.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHXvZCe4NgtwjytCYNwOZ-ZYd990o0UoWiWC1Xt3S0I6C6G09ba8nGwm8wmIsL9BM27tEFP9Sreqgj4D0YLi2Qa9HSinZMPhvjtmXIhDSCbFj0VP2AWr0IhLJuMm5usWkKf8QNnjBgI2nuLqdPN8xbvy7oebVxg4Q099Y=",
                            "title": "sme.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEKzmKy4miK68HESfHX_VfuD2GjJbCZwMSxu6KqWR5Q9wzUxyEvsqMYrIreqxltlt3jfqBCvwJ2ztBKmc9NrgJIL4aagrKgWPnWyJEerrxYa1g4tnGA6aL0HowupjFhNTUYSzVw679th1UTeHt6jZ8=",
                            "title": "motc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEH0d9w6zBTUTgkQIv14PoNMq2AdaDNY-Y8fhQC7A96A2e-Uz5XMCk6zACQeXDg4qJZTIBA-GxpNcyFvZWx6MwneIdbLyBXlsY1Rpr8A6aXoCYFVi2E675YmEh_m4bGFEl8nOc0ZnADe0xM1-gY3b3_qXY6Q==",
                            "title": "xn--b2r864ev6gb9k.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0kooUPA02K4JmbrECV1z94WFi4xUyu6YXtcdR_GdMJWmb1HhIC28H18-JpkdMbfxv5kJHVqWHrKJV0zwRyyf_6fW-2D94lYAfAp94mTEAG0YbglgZ1aExORLIBDqqsUycDfM4rg==",
                            "title": "youtube.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIINTk2tCyz1F59fert02hTpYQrWVFyUjcBoPSNdcOEEu_ijxnolGfr825YoX6YDIOooQR4BGMtMD4BSKiT10kxtBJPREfJ13IlzscaXmoBnbL3BK8X6S2byBxyvH-U5yKhvZTtruOkEvo6sIokCtICVmJBfn6BTC9myiYcWXzZrMp9LViGjlgSxLsM8iJ6zBOFA==",
                            "title": "taichung.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEw1IpRJSVgsBQxj-oMGKT1f8xyNReDihlqjUvHrGzjjHJH8VtbFxElm_KbXFUEuZDTo52hj0huliJg0MCzxCT0jjbO-0Zz3_KbUirYXpgxC1lt221nbFYer0RWWM2jrBR0BM0Ccu_T6Ikq41-UDgglUj-1GCqVAcquwnOgqvjEdebwpNOmM6qbSJy6VAQ8ziAbaCCeWU-JPMSXRna5TzuZ3Ep6",
                            "title": "gov.taipei"
                        }
                    }
                ],
  "噪音干擾": [

                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHuR7OIDnk64FHU0GgzG4jvIhpXJBh-dGGT9MQ_JMKbXTjii1iFtzhP41q1yNHq0bVeOjQ6bzbP8NDcFp6V5kQUQIC2V8a0W8bZI7fsvQOt-5h5MEyEoOTLz9tOJAyz8ok3i5uM6bN3p2kl_Vg0zSzduhfcE2ym-ygw4rWKHBD5lqksly0i-yoGl85YAGo=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3berhw5HeabKN7PDLv5izkGZYiDcKimPcmR5XiDx-ie4HmanUW0IYBu1c9YQN5XKHmsNibNyRn2QPZtlHi6WnCJYQiFxtCawnoFWgFiRj93i2q2XlpHPlHDfaHVwWvLYfLa7LL4irUSRNZroI",
                            "title": "miaoli.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZMFSMC-wgDkSf1Hpnc__CJT-uKa2MYb2e7yV3UztXWvgw51GQAnns7IFCpLcYNHl1wKYRTjgFmISnY2_uX8bs6L4wjYaekC502BlwokTuCMi-NxdvdTF1ohnTBRSyJf8edDBweWNNeQ9MhIjZNmnw-A==",
                            "title": "ykal.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHiMa-1CrIEiG-xwxdef-4FoQxOaiYrev0iJHJcY-QfZZu5upMEf5-SnZ3TTN1PAbj0xvOzi0I9TTPlPHvFTN5KHhctV2w5HG8dFA1C03eHBMgwSLyxqTfP4_U1zZ6Isi7BalOc8Pvl",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8quOT5mCBcnXwzp0PKYx4xl12U5O6G8a3f0KDv_zkL_NzmS64unoPDJU7JiFYTcNIyCOLrwJGyBx8cVEv5zBJmRQBryUKOBNG0km9lQV1OTGRxW-wPMb8QIaV-YQSxs-hCY9AJxnYATewxkz7tnd1FWB5ILKvw_vaRH6D9YRPA31HCW2CMDr-Lhsx",
                            "title": "taichung.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDlEFRNItbt7QwrPZhBTVlDh_LNy201HaJcJn8BBvUlT4GdlEqRG9IWUhNJkHF2x1AUHZDuCSvpYXWYPauYuBPb4pdyGvFknPdQV7945an0tna5SeKwebod2mAk3xR7p0aN2-Rk6jGHXekkV_vuFp9qA==",
                            "title": "forever-wind.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEQXo_BIHWDg0y0RjemLs-Rg1h_EIWjnDZ8CnpkKKRiVlEFidpQO1Ew0ugaL6YYEPRJ-jIsEGOS9kVN7-8Dvy-o0bizsdp9kPFnzVKs9qMQhYQS3P5jwsDNzOPzWnN4HsUuTld7vG4Dtb7tCBlzUw==",
                            "title": "forever-wind.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEnTeT5A4S9aV6OrGFQ_hpUivM6vmDkDnWaWDBrc-yichN0ErPaN2WDwexNHUnq7RC1vF9-ug1ZmEDOXxyzl_8bvEZhEB6NJhwpXqGLYVhqXTVM9pIHcaGLKapp79Sn5xHv5t50nMhTOVsC_zCUYqT1F12FZhPkzA==",
                            "title": "ilepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGzD_b-2g3-fo-SZ2vA58FaKdXqXWElTGRBlxnKZq5xJXW3ImRwMfCYVJqcTpJb9yJpd8Sp_JON11-hP5LJ-w3qt5A8gHDpnIvmHJi9iMHTIJfui_NQbVF-sv5zmkugJl-JQA==",
                            "title": "udn.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5rO-bh1oy6LoBbDTEv8vmD-LQ_V6MMaebWHTJ2Xz_pfB5nuWh6gOmAXlqxJtcpbiAKynE-Yczrfk7RTWbrVnBn4ey3CruZbaCbKu8vzHK9zoXdZaRcBYe1Sk9tfRqlViwPuiV_bwuzU5YciBpk1VUbbuMIjDRtBYn7z8yaAX5",
                            "title": "ntepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcWzcSJn4RuohEGvaGVm_oUFLMRrNLhaNvYkGa9L22qBmZkMqLXvlADC4aIKKQOOD0Lev6CVtXSlNmDixg9qACW4xXx3z8g0iVuyZqrRvF0rRf24zXjgiBCGwzJ8TekIZgP53NxpiW4eFna8hlIAk=",
                            "title": "ltn.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcgJOHzrg7I7vG8gHEeSwEXWgGFm_Kbq-PGkbOQ0731mYoG1brX4_PNLeByzV3nuBXJ0rIBbwwkp5bUcXzryP_XgkJ-IyliDFZtC6Srpk3TXQFoC2AZCg-S0mw_eF8sw==",
                            "title": "follaw.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRRY8NN7hL5IYy1N551IKw6Y3DwztnmhWMbTFWUc4k9R1_ubE6vYua0Dtgk0vt3GNiiX_UnODYBfT5AHjS_DVTsg9wpYsZaHlmcO5WrpeEa4lpf1YYAr2Oe1FU__IsHsaD72W4kjUtDBcm1N0=",
                            "title": "vocus.cc"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUr6aAamOGhmKEeT_uKddT0LWQZaeE24QF9WprN-p8xChpGEEnia4ug_nSJE5ioUmHZL3_uzwCZN6rz9bGroP5wJAUF4xvEAUWW2lPKDrhVRGqA6Ljt3u0REjo2QzFpnYFJb5UeYGv9RhJkdRoEWHjrxTMjw_b4EagO-sb_gRL2n__S-vvcamZVFISs2j9l4hW7pb9uCOyzOTuecERzszBoRyR-0M1r22fae7r3W-lQXSqLLV48FevRazAPLIAbIsY0ywZ_z2QXWGK1KMk55QcMAh142SRSLHjTaxeTKr3X0u6IxOGpjMcd11xALcqAT9CobE-jGN59Fo=",
                            "title": "wordpress.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEUTRO8SI-Pq7kRnt_duK0eyApzQfgGRYcyUFkfZ3NC4XN9LJS_BoEGa1V6yqp7LwbM7n8mwKQ80pEvI4RTXRzMuU2YmMrZF9w06SsQXAP8Dt1AeQeXnqVZWg6Umb0sCVvn1olhwT4TMa1efeka",
                            "title": "cna.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEQTa3bEWMsugoHNisUZIARZ3Ytqm3hLdVYnHc5IlwTqmmtRFAbt1QNsT5REki0bH1ybxkW5UQW3SU0ZJgy5F_zQf-AZxBrned_i3bHujTce12vyJYgi4PsExqMKXa63vWAH3NsrTE=",
                            "title": "line.me"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEyXtVSmVJgXLtcI9CwtdIzwurA4FhS2bUhMvFki0iOm9D1ym2DH20cGJ_uTEdP6peB6KVfEmrpL6YGBiGxenO_-mBD1mjxb5eqHncy3oBELHMy6MUvTTqMIma1OtkPQjyrrz3TDR5AL7PcBuuoIWmDTLwvacVmVk38falCJdON3O_VFrsdl-04tjUUSb4=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGiNWMhIgLyXjM97ihhY8mn8NOTezFiQ_CbcLDqqa18Na82wgYa1fPnQWEo2ZcutkyTETGaSuPr6oGqSDVTDiUrUpoVAmoZvCaDv1Im_GsG0lfLRx438v_YRniTDDHr_OscgxMd82Fh0eFDtBHw",
                            "title": "miaoli.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFz8uQWQKh9sQRCOBnPUtQf511eCb5uEQmxis7VuHHt-97O1xnpaFa24BFRgCOQtPZ735AXPWJLV6S9iT9hpeKT4MvbknT9-SaCDua0Khy18Cv4xI99B9wb55K5zRcMyyFh_IfU80cXu7YtmuLgfpXWqg==",
                            "title": "ykal.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHeoFLArFVyq-JYuZD7savOGye_S2OPVFrS0xKD5001ArxkmDgXH_m7p-oZmVXoYJKDDFvWX9Zce7z6vgQMpTtXZwS2464QrVXhmAU5SbVEH6kCWfsl_j19zkWIQEcOYyZuufsAuAwvsmotnLCZXpfTx7_zVlodbTSGdsIc3-CvnTO-2dGhv-oqE2Fqm7BSz8sXuD4RNkYjdGotiMc1hqs=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuRFmGaBZgDo4yaxL4-cMcdn88ZQW3wOHX7roYRo-9YImG3DkapGr9Ex-BSWjAnZZfMJmMFG_Nh1HJ7Kz_ks-ljw-00gq4kgFvSZ1MoOxPB96yG1kV8gYQZrjou2lZUi7-Mwfa",
                            "title": "ezlawyer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNrCRKAL6w0vFYcOA-QutTrfWRKrYE2QG4HYKo9w94wgpZaio8mASIwcIoOALt_mrZzS5sd1gBiXYGbReVRjsoHaW6hYMzZTZ1OoB9x38TqI3OWMmI2kTWF43_1Grr-E7tTckwANw4FkfPhANAhyD45g==",
                            "title": "forever-wind.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDOoCLSqD2QrZzHYbEFeHO2P0Ei1vSh1MjIfCPe4h_LIUF23bzDU2MSMSxKs6t6H18028HvZpBEmoJ3RbeYFSu3SRXAgzJlS_e2P0SAfLgUBgvLYDqcqx4HOkaobkUvQLwGg==",
                            "title": "udn.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGn2Pd01_iiRkKGl1MQDgKBI71qNa5KFIDWQSqtj_rOMy8tZBWIhBJbCAZjSMtQSYArrzUNwddDuFP7HYN32L04d8IeDZipMaUcmjyf21opBeBVrn7CJQs-_S29J13-F9NdGUkUrDKV4JthIEIsgpub-W4c3rc6Og==",
                            "title": "ilepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnY_4wakkPFgfNc9GUL4FMtJBr29jB9eT3e5y_wRzrFh-DL8KnpNT-X4mHv7oclqGCDo-pYdNCaWXha2_-OjViy5aBO0JuNwuEDPAoZf4FKMjYFndnU9z7OnnXP_Zl7Nnjx13TyS1zKMNPdETyy5QLouk=",
                            "title": "merit-times.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHr6hpBai41PzWTGqrWIPkBRCbYiv-YOiWoPi53J8riq53yOIQx29JG8ILDC2BA50TCuE3A_1viDNxE1D_x8nsMze0ycAQEnhsg-gZzLOA6nLMtMQI_sGTmAfaEUjIb2mIObWUvCYUNts4s",
                            "title": "taichung.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHBu5AFI-SH8TBbXiuC68Us3nbDvxJteoYKn2EyUj6fJy3XOZycCbakZL__kBkdGBDo9JUTYepDN70Z0M5r0oqDY85K6YZC-kjb1N_O27UeY1GnNGokznjt3zKQ3ENjx5T1VHVhWxq1C4Dc_mb3OuFuvvjYHq2hBRuhkAgeJCFYXjdAVjqpDzYkiIaN7LkGmuEa7GmXC5CEeYJkClksxHUP",
                            "title": "ntepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEO8GulIobw3Kvlc9ASvnQN7S5AQcS3WFdtmG8pLGIaVk4HtnNgGeOSBT51iKlm1IPhD9BF6dHGTgsTKQ96d6Yh1YndBbplteSKpGP9658GDcpzo8EnK-CoPdERtB4KUApYosYwgLIu8IIPsQR40UCovT-3M7mCJAtAHKe09EuOa5XyRauA4uSQ45Dt-vP74pV07IAFcZJE851S84h8f3q7",
                            "title": "ntepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHBjSjclzkLL_Tn_kVQYcHRwcQjRwMxyFJ9Qsa-1b71mMiUBHjRebiBWxHzfWiRTY16Dpy9aAF-xPL3jhfSBJlJ7ostxGTtkjOxg-59xn8RCZThY1YtUjO1huIOLTapS8qppNvodLUrACov8kYrR5i9madzD15LJ6VstWoAe2SdsjLLTB2PZh8y8k1xIOVNww==",
                            "title": "moea.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbOnCWQx7ewVEcsVS4D7KP5u6DLLrv-Hv62mPRBpvTNbKz2SPk7gSl0BK-y560M3djyNwFzd-LCE3hD2NdCY-85LrVgAWq4mQsaD7uNsTgjwqIv1aCbKsQz05LsWQTqYGWFquUVMC7BadRE6fvQexDEJBShkY=",
                            "title": "moenv.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFb6WOQlo1c7ECZbOEPRgDTDIT7e7logcPMnP_etJFZblP_LXi_Pim1j_ytnodpLDUD9fampW3oEp5fOZWRS5fo7Z3ab_PmwONiudfGUlPsgRb0hl3PD5i_p_QVSuja9fghJxsnGw-Y",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAPXd907cDelYgJrAZ8MvUsMNywkACM8s8jex0VIA61Wl9EcZUdXyiozIt_6qLULZ1e6wcU3SU2DTSkskKkGlxZmYYajn0F8baoz0s3z5MvwY0gQUt0oUcC7fjsfMcovGfjAd5KWhrmLhCQrv5F6FsgfGkFGjqA144KK0N",
                            "title": "law119.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPQ4F-AHYeveCcuAonNv4LamlBLOVFdwYGDCPkVQawoKR23_Ic4knyRdCLWZCoM5wmDa1V-nGaS5JTPVwUrdTg0sBpgoMino94v36v13mMbYJYZNjqGuIRBquZtJWCsgXZvYw9jm3F3cuaxaBQ_9vPy89QPs3EAx270K0WcBVlC7X1_HSGjmWVzHnYbVo78w==",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAd0dOWE08Xc_aw19kQP8ZwC6ZVm_949RYg9f5R3RFPMnseDAcnBaptpXnGKZDprJgtJC3sORFHCUJPIb8Dnu-YyXTSmzmJQaKH7ZjXyxZplYJlsBWgPBXRhjg",
                            "title": "edh.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhJY8Ui9n0-jiwf17LCwWFYmFKM1p9anz3t4HxKmk8lWQx4XbgZcNdgV_aAI_cTnFEmVbFhqpMIxq4bs772jo70LCcLoHdhzPCajXr1oLqJ1XZi6T085a8APDI6cD7-n2nRF4FLgtkxueISUjmjN5x-gKDcdM=",
                            "title": "ntpc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHQt6-fTccK0xZJuFQsj4I7-aenJKVWWablvRHCYjn8cl8y3_9cBDyBb-WcTUxnyWT5qpf8Z_Q9wudhrvO00BkKC5JpTN2szVLPw8w8sHCGv14OrPsbwTe-pR0hcZdzucFsdUYjwwLSka2cZmE=",
                            "title": "moenv.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGc4frDH3CNP0bXX6kFGMqKNDFPJnS8Ly0S3D_ia7H29heD79dhSiKns766mma3lfLmzi7EcFbd5pMTgL1gU0-yLHaKuWMgmPPpSdjx-VfE1Gv8KT2MBowBiSCF_qLBOphnoT_odV0b7Ek4i3carJeYRBwCFvkOSrkGxzkCsxKABHpiqS4KS0szwwhw2tobQOSW9_wHQFsDSHLfh_bXFvimrR6iooBfBzns9VY1bsVe0wBBXxpGJ27rGvEzJoHM-ZoH-5mVH7nm0J04Nhzj3-sfeCzihl2Z-7pIZI0d49BXfGHeB5wmAmbuW72gXdt2htgNwMh_wijIp6o=",
                            "title": "wordpress.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAQsA9PLYT8pdDN3TOhVcq_LenW0C9PCO5kecrOjOjLcp01h7Q0ABt6O7reaV58ixzgx3bmksvsTBeKp8Clvg6rWMgdV1SyeXhe-U73XCpGXCMSzRik3FxsiadzScW1YZemhInQPP-U6F1vmTpqL7l3KnBWg-EyApXsr-2HCXEOLyh8LAcYV-e9NWZKSF6dZ3oBDAX0g_B9ypQelk4m7uFG467QEqmYfpgHZgn7Q==",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvLWpiqFXprbVLpdmr-TiZ-Jm0T4qrixS6wuNbTf74v5NYicoTlrA7H07lKK7rwLfruktDI2r_M6VVCFC3us71xJDOLDYUwnu-_UB1-S6qCf2nt5UMwXSJLCiJ5e7iGGnNuKwGA-wK3m-rw4O4QQ5qGeAzVqqUscjIRZyQ5Q==",
                            "title": "superbox.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF70PaI5hB6C-DIN_yWCdlMsB2LHAtu3ieCjBzbnJZ_fE7nSbLRJ-Ow1PrZldgj-RyUgScR9RL8nYhcyWGcwnQP4fE3S4y-YFxOzaZDC88a15GoyJe0a7Fw93aS3WdMf7qQzs9sfDcAWV9ti1x7-G6JCeOLyno00dkm",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEXUEXfw8u0L5skFqA604ccjktphk36SLU6x-v4OKJx35ZJwxl2C1KUvt1j9qTDua9er6h0KID52mCJOdPHAohl0hriTrpVmtE8JGxyV5oUTHiXQkfZdV9x5ayalZgtN6KyLbXalfaJC95AnQg=",
                            "title": "vocus.cc"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGT8I4NasG8LmAAXiOgfVv9XRCERIzlo1RICudykiwxAC6vvr_D5S3_4UUWFNd1RBo6o8zUGDykCbIKyoi7vCR4Q-OJ85GbBPrSD31EdJrL7f12nDAH0EoJ_l_DeNIc-g==",
                            "title": "follaw.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGXLUUaVTxQpucjY43vChJjSQDJpSTB236AAkv_5fvmcp6d-fNwOAJq9XczL2J2hrQTRRwTkzYHSw1CBcz3sBkuhYBOaevQR6LbI6RXv88XXm-9uAN2fXs8rJ9PiciNSUokFk3SsASEKtSVC5o8POo=",
                            "title": "ltn.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUJr42_yEJhdFR8hN9sn2otxNq_10hXvonF3FAfuWLKZp-c8LKxB-S2THCNw8CLqXnMPlWFrlH60DCg7SrmWnkWef1xfd1lKU0OMCkuhSiifa_j7FuZreSquhFTbj80VxmsGPs",
                            "title": "jl-law.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfqw9a_sNvz9t2INELVDpo1tVJij_oM6kM1KDdBcJts1RScN8RausdK7ZjRCDNveGT9uRbO1NJfCueF1nipkw4gVFSKqWui2QhCs7mhApbSK3rI34yAvk_-sbGZrAhSpy4261BrRn2lhUs6d4qdogOP9sh2NGCN7cOwjiDS518pG9EcOR049EO4r32BdiLhodcCd0ukBBJpUNVejXUNPqFuwN3dWQLzGGPCNiiBaaDHa093IRbaDU387rLs_FB7UnkC6ApOnjAsaab",
                            "title": "lawyereason.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5J3A5tI5bO8GMQpApT0m_Cs98b2IKgkNg-e8vb-IrvyRrD1FitksaS19KB80obF7HMGi1y9jWSKY7P-vdk3TvuUelRB4KyJBWFEbAuOTsEuwiccrBFawvQ0OptOC0S2dZSOsPs7MG8NruxYxcA_duzgwXOdJk",
                            "title": "housefun.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFOH6yTZ4O8DA8wOrLvZnfNG5IzbhICtQwQaiZDUPywxpca338ot1X8ZK-MV8uxmV0DWYFeON2NO_c0lNldR3QNMZXz13ErcyFkG7fSr55bjiJNmh6u2cxnS_EnTW7odUXNBrhOpBhQslR_Xlxp",
                            "title": "cna.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3w_UWqdVMUazsAmHvkcdgtsSVlj_zm7P_SWehT0a4rktcIa2hUkQOxKkDs-eyFJZKwQmL3-VqbFJXvnvhnPEZJIym77N8hhVy4-dInOM5CRmA9UPmczDnZhGPbERfbHB0CjvhbAHMSkz82uh09CQXRd31Xp8kWCmUJE9dbEaaRC_EasIgWkDbemS4JrKhUE_wW8Jgr8n6WIiRbmZQ_Z5YjlchFALf2gSZkvZAHOauk51cUUgj3J1qrPBEJm6dQOLoUsA5k6G6rFM3N53r_p4DELe9IGnNACyxcS8RFQ-NXh5pJsc1",
                            "title": "yahoo.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGQzlpbZay-ImxZUF1aVvXUQjQKqXdbnSe6ZXVDBFivUIW4Hzemk8Vdjl-6hCsagB6fLAZfuLrCyJEA9HXVOzC3N_4XZheChDW5aGzGww-39wqlRMF9KI0PzqFWWX-C6Z0TFEGXxVD17_vV1Q=",
                            "title": "ettoday.net"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGb5ojQMcuC2BrUQAe7VlbFiTdv0knrZTqpX2G4lN92K2CT0WbX8cg-OCqKQ76qdzUKSptOmkVaF3A2fABdOWHLMt9R_cfTgCPzhRGRpsqLpd4ooyqXNHN4BxzQg8mnDwuz",
                            "title": "ettoday.net"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG27etKulT_fQBjropW6Dg6-jnN7dqU0KLS7ssWIza0eh15qBYFxfcgexFrJWMvrtxT0EBsSwKLsmMhKRXRcJXp_NXsiBCLsUCVu21aekZQeN8yoSFfroj8eD5dQELLZ_iUnYT9bVE=",
                            "title": "youtube.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGI4M44IJKMR_QgMZQSof9NY8U-mTdiVJYxSVWRZhTUXp2Ch0PDyQ3hRhBop4QNVn5F2jeK9sSXg-Sj0xWUozF1_c6z60CzNI5DNax76_9fsypCSnpUlkt0InlOyhzCap3o",
                            "title": "hs-cctv.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGN-cxkjgTow4xEBWNrTJyDCTTqfpmSILEviqDr4GaUNP41OOyd1O5fOh4JJzI21DOzPEhmPsqMr15iZ3KpxCQgG_zVDtqOdkQhhasO4W-JiVDBVOIhZWfxxGBLtGjuS4wZXaqergwN41G2eQVNYk6Lum2EfMyQAXsorHzOrQ==",
                            "title": "superbox.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZHPpflrf-rWIyXrS1yRL3jNXwv-7rSMvhSosWoJvKHxqNGo5ocxqhxDdzWi5IlRSS45zi6cHz09J2nk-mqPlOD84OfJJ-0EEyEWnw0nYTLR4_jNg3yBpHsYyzYabOwzT0NZalPXYWPX1xfRv6fNEMhKMaohUEKLdc",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEufDH7Vh0UwzHbtWrISU3GkL-SnzTKzaQCOwRGsDlgPa7HpzYRKezHZ78UVMHrAua4W3Hjy_ZhwtNs8aAYUbMGReRJ90jC7OagRew155IDl_SgmVeaLtKIXWJXv0ZON49CbFew1_p-uAkc1Mf3po=",
                            "title": "ltn.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbzT9bW0qU9CTEJe-bPWGRSeP-jBg7kYKZgy0ZQ4e8dVrMM6-m5LslymBEPae54nowTSu0SnEIN6RxcrrzH1OPV8bdR6K0kOUt7q8dyc_3u-ek_-7wK1189iiesSDEVd1iHnuH44wTJuufR9w3amQBSAQQtD0=",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFIkPSTnPZeB8sfghsLpjeh8TPloPkn1mT3N5HGmCQA5v0EdfWlF6_Dzs3Rw8qZFEQf3TnSbnn2YsWMdI3cbMjIN--k_Tj8Rrn8EowE9TXWnpRUJUyH0vAx8TNAamUQc12n8sfEIrmHjSVrX1CN2MhsTxWlRzxm",
                            "title": "lawbank.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEUKLmNppJy_naxWXQ9QJU-c5Sh1GC452DGRiMdeTIJX2rFa1YSeh30hmlm3QlZknsPSL2JKgIx6PfOCi-T21sZCLNgAwBHQ2AJ85lhbTM7ks7VFJd7dQWh8Dr18EHkDZNYlFUCjNDm",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKxYtRCLMDFONFtvVwGN4JWNSECKe7JQprnmTlduUyYo6_2nesjDLjAWNrarbkvzCaatCay-phI0d3c_6SYkTEtBSfmAJ5E8OoMMJxGY-jwGypnrB3hjQBPUKaL5C0s-mkHWCn8Py_Al_njjg=",
                            "title": "sinlulawfirm.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-8SjjayE9mbLbEiF_fk-6ywEFbmZ2rgZyeMh2S3K357sEoZpC0ZV_91O2ba35IZT1wRW_UmIDCYy_NLeFjKuRvM2jdiDANQ6A_Ev7BFuWlOJn6Q03D9bWbVEwt74bz1nC0cSedvUFFOd3DVQe-GAlf3G6",
                            "title": "lawinhand.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHsVQW5uvLQT00rfBZrMZzqSfrWn-E8CPawNo9NP7EaOytG5H5K-MEVxZn42fDGyo_BPRohuM1q989ugEsvUoExzx7olJ96UYFnaSn_VjjTyDcKwHWny8Z1yc_0etj_9ebxiAAY8scrG7gxRFYrgE3D",
                            "title": "wingteamlaw.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGYV14KaL8foKfzhLNX2hZQNYXqKR3ey4xUnfaoCfCSP8O0w8kPUdnB2sH11_Q1-2_7XBPWp-KciFr6I-wKqjbaEHN7LJE6bIYrjf2GH17oS3LuCy3uYKVxIasdOhRzLuDWNRDsZwxw1v2TS3M=",
                            "title": "vocus.cc"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEs-xIbS8f8dm5SfL5STQLBRSCxz9ZuBLpzwfInBOuY2FwVurRpG-CdOTLN7pNicjkNdrM4mrkgiyhNUnOXGmtwprtwsTk03Beo22lKwX74li73O5FJCQU0MYGskaGvIyfMh_ocrEIZA==",
                            "title": "chaohsin.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEOnPYk7vCVq34ZO4jb3C2hxkYnfNF-7QgvKIBSwrKeOojhcQr5TdJ5OVDFX8nC5D5FMA-_THLSrJFFzq1fPw6MO78_UhhlfssDbg6iPMfid3PrTR4w-iIMxc1xn8TrWSiWDrrMT4c3r7xg8wQlnPYkZkYLVA17VI597iUZwqvTFvhj3ZHpSbq0DpzL4jrv9uMTzmtk567xWKlzNhYo0j8nKRHU8jIkfCc6PPUkV7sDYxo3NsQz-EMwKoNs99RcUBG_hiTfBsuw1IhPiIlg6raW6vMY7k6wBym2suRzCnw2KPfR8RepXy7xquUr6hTuAuhTw08UHlcBKss=",
                            "title": "wordpress.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEfaye98TBQf01TbW5rVECakU_nbc8paxCY6Il8BBMq8p7PLN6Kue4KCtOx8aUmNgmkcN3fwo8FyxCtUKQVVjbFLgEhk65K-qmeFaag732HQGOxbDGtTEtrJ2G1YRNNVg==",
                            "title": "nownews.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFi2-GUYQnoCnDdOImu2x4F-5EzYdKTeR7OEo8yDsEmWrqSkwnTdhfYe4XO6Nk5pnba7sp5_q1QIO_vic1pzWXoOlUcOupoBAdDLi5COFukD1PHBPiCPHXGqVViWt-O6fJPi3Tj-ZUr",
                            "title": "udn.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFCT5YWzgEDsiqh4RDtnYQAb2wByfnVuJe_JRnByzc9q97lEnuKFeaWiZyTcEvezkI_3XKMWTw86MHd0Lby1dUJNHGc7TYEKH2nUZIrZ8Wj-1TB0W3DhIcYhVdRp-PaAPyjFuwlLwAz5Y1G2M3MRBl9dg==",
                            "title": "ykal.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1KWZ6WmfwEtwogS658TvegZEW-2LEtE8kijdfqb-cuRCEAxBcNQMvd7cMHc5_dARev2UHHMzm2wPi49NmBzxIvsZ9Xca2IZxYsQjpYYCawNULH22H95HFq870PaLLo80sX8je9Q661MqAJECzlgiMuimmggs0uKpt9BajDcqoETdIeFis6X2jvOL0",
                            "title": "taichung.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKi-ZUhcr6CdS36UQjFD66lKZhJmwdKnPBtu5wEvXtsqkDu_u_nDCghIoGnrg1pZQr_dvEMdc43qymLo3zEiITxLsDzQrAjlCLE5dW0bmcBrWCNtdBt7XelUQZbj9gkPVFcB80Pjm2tkgBEpKl",
                            "title": "miaoli.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGR2cLDOje7cXXdF-LgdpJWpNcsRLH8vPxcbgSiW0ID2Dp3jeOjSNWcIsQhjydaBe_ZpQUOm3bSg-N4t1mfuCX8t7ckg-2ngr7HCXjwRLjkGokSXq4tLFna0xeXvgiHfTqOPlDBtidXreN9q2QUjJYrC7ln4_EiAg==",
                            "title": "ilepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5pGglcPrUQ6NmPsnshl2Yv1Oh6SHhrG8zf1jU8vseEU5V0ZARwIMc6FlyjmiaM8e05oyZBZWFyYjuHJvAsglk7tRfLSR1eXH9I_q1J2LxRuXKKWheclKbr1ramb1Tk2blVCC1V8jLEC2tqNXTeo1iXC_diB2ezGQ6KDoguPNEaXwz0W-1NIiEGSTVOfk=",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFzsF-nobhtjN59ZfCdCXMAd021B3ipnIdcgZkwW9fFdi0r6SNxAh-oDAygC5Pr4c1zBwh-EKQPPACpOyKoG3JaRMhg9QYOIYBomW_E6oDGCYq66pIvSq7jnlv6QChpp5gI_c2jj5lLz-kETlAJHRwvCXU=",
                            "title": "merit-times.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPwR-gWu9GcLWk2SkpZffbx6HgIC6Fl5TWSlR05TO8GwHGA9ASr2bKscDYA6L7tJBOYEZGL5ogtL_zhoVuzrNtd_YTR4geHq6Bd2OeHr7p_g9OHE5eZbptfANjjhrkLoy8BzaabQ==",
                            "title": "apatw.org"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEwqI9Aumr5CVasQ3h3MCuLa6JtHzxOFSg9KSulv3UTaWagF6kBNsd4tKB_cea5pzzi63jzoSOkVUZfoyTxr1BcACN3NNe6-hiYzkyMOCQh4aQGClXEmJQ9NZFtzwPmLj-P1OZVsnydnnlvbNRmqopWEG6E8bA=",
                            "title": "ntpc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1E8Q6ty8t-g0sOwVh7RGNVFqVmyGRwrMUVsVT4w9IeTYBqP3UPkDzQJUstDZx4D7l67GA0XyQnyw4bbCd-ppZeP3_KrtW_emsX2MyMJ3uP7ANwW7357BawSeTh18rnMXsjyb3dOgP0PQ6bdb-av6maPN_8XB2gSD8nuvLkvWYAqjZ_u2ZTFNHN155IF2zG_c1hqeCvWDoiE7raCHajf4zieM2cZ6dA-60Ozq-8pFkdvvZ317Qbjd9xv64GADSTX3eAaQ0MHC8IwZPC1H_OQYYKMXZ",
                            "title": "5seccontent.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpSxByFKbcdVIY5H__DJjZmq8pJePs1KRg6hThhfCKa_x5RN5I3TOLcgrl4estplutDO6f7WgQocdiktQBplNC6hynSA8QSaecCuwkXYK1RlAxc4rNjmtRhcor995hBFHPYMGgo1gZMI5J-nQh_OaiHnocZGmU0Izz-g7kTvvn",
                            "title": "ntepb.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRwHo3JsWnF6iRRPD1KlERxnuq4EMaq39NRYwfzgjNlrXGj3xqbzcORdUhxndnr9NUuRX4utCrwlWrQY166GnllwqnIg9vPuV_CVjzhe_hAG7umzJ0n-J_YKUUNV1qS4u6w6kLU5HdaHoYuhJ-DAIQhfIGlBYtqTv7w0lBUHcb9s8itesAVWAoD5wW",
                            "title": "taichung.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGnxgVm2zKzjlQGCL0v7-4yJ84qLCQ17EjcTtO33qVEzuLxusnNgwUZplFVu8cFQExxpwWTQmbq_qjHB2hoMWFAKnNA3NWufiJo8p3dDeJIam6j2D5sNTSLQ8zV1qYLBKE1YDmExWEiTwyFmMs648ejOe2pIMNMunrX9Yuivb1UdJw=",
                            "title": "anwaltchienhua.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvpic9OGvnY6FjrlY6j-zPn7KnDuET3qjjUtTLwALf8LcJW_0jbisBth-NuULBRaUS85ho8X6yNkEqY-tA7yyjlqmMnUbVPAsRW1fp89y6vfGz6I5IFDZH_SfF1PlmzDOB26AcUCwvjlsqD9eK3w==",
                            "title": "forever-wind.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHsBoXFZTYSofHobFzPzMXaLsSEkWsnaM_w3yibD1hXmT5aw1daOzNgPq6kxZcs4_kwZOtv1VQugf3sKuh6VITChKJ86kO9mAcJ_qSHYzEEXkI11E3Jtkgf1GY-E9kHwAL3zRLfhebIG1GR2BfhUGg=",
                            "title": "wwf.or.jp"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGQHrCWBi2fixkN4vL5Wox7NFm-SThnuluOLnqlzoCdAS4qVfdNshL2KdC52HZYOF92tlnAgc0e3oYlfaSWqRWsXmzMn1aChnezSys1FvvYalbOIbca8MXvkf8gZj07iv6LNcVnJPaAGA==",
                            "title": "e-gov.go.jp"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG00gDo8oTKuq4IivTE6XWrrmdkze84URjE9rQVZ8cK04wYtqItlmzM18_6koQNWPg4jszUX_T3XDaflvgPRX5tMqyIro_K3boNtFwnjHaksUTXI188yqmADP4-uf2l4StABNOhc8eQd39WqgnAS4FDYTrAJTaGtLljfzLMR4IjPL43qJpoKJ6-fDqr6--nLCIBIS_U4yrQfxPUAFQLHCfmna3ge3Rq5JRkabHZFyY=",
                            "title": "familyclic.hk"
                        }
                    }
                ],
  "消費糾紛": [
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzuDECtAZxOytZ8u05rADRSpRKjSprTaCdj41b4qHLHXDYCS9CWrwnZ6UwPRsLQHVLXYN9PUMmqZGnZs8tPooRuGz8yUmpxf40AmUzcozXaUcQMmnH-5mn68HR1EWYPDDI7khWr5TPcwKlVIL8s7-C_CbjvjK2RQuijXtk",
                            "title": "sme.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuBxvulEMjltlR7aKg1xWHH3qit7WhetZWcns-iWu9c3Wj65d4ReWw2-qMyQCVi2MMbAXSwgIyzvL2s9PxcRMWF7Dq3wYMZMcakgK9PPb3gLQPwdIhqtZAV3xyB0SKrkF-9BwXjAjl_e5UwpqMrX_PBRixh20nw7k0akF5",
                            "title": "sme.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELQDZ0H95MMlCfoS4BJSxkEnyfds1OZ-19p-rj_32IVOqVNTmGLyi23YUrVFbllU2poYjq9gInSDU1mCb_EoJi2zcGxiM3fPgc5sMe-iZ9iX00r943RZi5mKYk5r-kd0HqpAbHLb51",
                            "title": "jiade-law.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYTOci6DMNwy7IiVIjYSK-nkTrLch6m6UjjiuCXrwjv0kKmgGgIE4JZsEi0sLbRkXfyxsuh99M77SoLa5pJN9FcntAFlfHO1112vZA-90K9i7HSX_jquIestLdOsLrsQiQDT0N7j50LRAT-geCM1qUlPqHg_h-28sZA_vl",
                            "title": "moj.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcK-f3mtZCetYZXyVTKX8_sXAQB6H-zQ6S_Gk8XZpI75mIlijPloXRo8gpyrZ4Pw_Vgv4gGvl-JPBGaPFvcLZLMTe6krHzzCx_C_KLgAdwi-C5-RxQb6tU4Z7CDRde2gl6dLn0L960-6Xn0i34zUIepJPn-Hj74Gsw",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMwVMOSiTQyFz17BoGZRQRLC1rA072Kf_ajaXSIlNTUOA33BgSgbWEejDqpobHsj4W5Rr0nigrZXAgKDF36wAgqNYfMfgCDEg8fMHzSR0VumZYmvDw_eiPpC9LS-YHS64-7wg4plhZ_A==",
                            "title": "honganlaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKOm3h1fknkv3HG9rlD6OZ65DIEz80j6dtrMTin7qlrxFPPk1v65_ae5iyOCtcmouoMQhcwb-pdrEMTOqHulnhwu9iQTWcwH8kzciUR4a8dnsv4b__TSqG5F3mHn67iUc=",
                            "title": "gvm.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQENsokeQdlmXNixPTGenizE_ikLGM3toB1guUD5AtEmnUKlFW9NvgHRupZI7b-lQGFOORACqMtLNtaep9paht_SrDbmmJf41H1zA0rHVRzR-NBzOHiJpuEENqcXyXlXilZG0LsM06CWYg==",
                            "title": "squaresun.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHS9gz4Zo9QL08ljywg63P1SrbGagQVV3IwthQEWaVc95CBv8-0gyAa9GcEOiG6w7EP1NHlLs54x5cCxKvdS64dEwIRlJDNExhgRX5BjOA32ckK4a1Ft9CrJ0KQeQuiKYhRJH754SvpqgzoYbzRlZZZbpm9dZFl90guP32d",
                            "title": "sme.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGrgUD94yEXPEbu_cta9dERzBxUHvkjaa_fX5S8U0wVkig6UD0kOtdKC2C0agL1zcJgTHc9BJwixQeQmRtLtSUAU3eTY4TxjhZ9CxKTgGgdBm5sEEnRqvRKl3skeyaxK5Ijojz2JNt5ip7DsRI217ytbjw=",
                            "title": "chaoyulaw.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhvbOdPTLVY3OLbUIVKdwZ1pIEoXr5ep8InoGWOZSIcMLmdiKABV2uSyPbNIglP-dQDxdHIa4uep4xGambDt9pl-uGsvxwScrYdESCLNHSoN2B0sGBLhBkN3MvOTPMOW8vPr4rPpXpDcRFtgQ=",
                            "title": "vocus.cc"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEea-fYfs6sG-AL1DpgMXdGBA-l5PZiOsmw5s9yWLThGphBq26oS36CxWZygMBibM2m2CfU1aj1lS1SPgbdoePXjwTz3Lo1lqbP0SXxyLB5cZnUBq4vWfgEpc0DW9eQnDTm9uh5Jxw=",
                            "title": "line.me"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEuk0ddet1synK-ZlitJ1qXcXsExcuQ-uuAHwjkKNht-_UnR-o5pBiYDtact4KFlY3IrNHiyqcCZdg98_xr-Sh6222TPqN0j9K59JlurRinLMwCm2Y8-6bHt7tWbMHnozyx-5goVKOtMuSgot90Mg==",
                            "title": "ezlawyer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFX671if08TmIpvFiKByXEpjNoLFjxOmY-zF7GND0RQ0X38Kfaf1s-vbgeETlZf06y6Z86fbxPap8qMRYHsD2ozzIU8CgSNULW5exk1y_CdwRMgIPl04m-_6mzWuMrBm76nkX1-n_NzrOAtVzpSabCBh3rz",
                            "title": "consumers.org.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBFeyAdWGnccWC1XMOBX1Hc_iRDJFQV-K_Gn8i02LsQpMwxx5bOM3A3BkNLQoqeWCya5ckIO5QKs2usqjaIGpafPSrGtk2HVIUz9dnLThAdUfblvLSD8eZusk0VbKAl-57tsE4FCLolit9XVZwnvll3APnMMBL",
                            "title": "ezlawyer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEWINMng8oo7-Qqpx1CGzwocMOfijNJV1zmCzX7BnFUS6fAWXuRiHKx9Vau18wN77LsQpYEiVhTOFcw-EfbJMShaJP7g2BiqKxi7CAOFP1lcWH9eeZLJ9imLrMmDZ5VyJFGWBqjszBGMXyKcWpGfnIEn4WsWhDabsawsFYIht5l",
                            "title": "legis-pedia.com"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEiZLanWsY4XLs5KOXaWs0VMtJs38R9bto_ve4CuxIragPqKE4BYmWulwQ-aUTz2hYEtttx4o0EP0OrcqNmqdhel5Avbb-S6DGGJzLKePRUi8zGtUwQ7J59XoGTQNxnrNzPHCtZbTmu3kq8CQDhcV-RvNWr6Rc=",
                            "title": "taie.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGNvmCo2fzCASxT6laN3kZFjJ_pOvpXJKiBveZatKjDI74lRZFk28G57xPQaRxai3gpe98d5B9foH3HdDATXaFhTfGO0p4NgR-LFosXNZahO3BB9GP-9RrB_zUJiTfiLQnjxlmRWJtRGZijNIMCl2GbbV0II6zoLw==",
                            "title": "taiwanlawyer.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFmOqCW9Wfkr7YUGmgXk8M57up-RecupvYnUeZm1lsOTWK96ocKDaCuqcdTzv1SVtowh4CwAWeedV4i7MHupcIris2zl-PLKt5Dlua9ytDK5ESro_TmtYHll8b8vCs-8KpM61vivmfewG4dK_kILPOXFoLYDovu3AOhOPnzHhFkJV7SdXTaboVzSKRjQzM=",
                            "title": "wpto.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF47_0eGtQMlWP9ypSJQnomKJwoBlOZb-v-Jz_0BvQwljPaLg_5a4k48lDBuVfjtvuRbae0siQfJRLzsSPBzR1praICxzx2J3Ux_erDfKXPdF1gbUT--UyaV8Qq-yl6SbppITrWZEVdtJpyNWMmaADT8Rw=",
                            "title": "legalpro-criminal.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHyrP6aWO_c7YplHKhmNUiinXDy8StqsHfpiJp2XkyzUFYAss-jpJw6zJBexUWfC7dusl2zOCJGnlQG5uIQhhRK0gWt6zOiBAfgt5VCIXEzAhaO8TMGE4PZMmcseXvtuQoxaQrorvEotL47SDaNzDUmWlSMwo5aSkLmNLuGiifKNtZMWZsKIUQvATKUv9zVSts2lTpX5JKR",
                            "title": "olaw.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFmwbWNqDiOEil8vqLuBqeKDr-zurD99C-bOlp5LnhsCUs0d7OMXtXfGJ8iOXzzbCArRmHSI9VcYoccLHVbdD2D6zxlJxDFu9jMJsUHX9c1eGyeGEkIOMMR9twq4hiGQNeqkO2Of-jktO15Z3FEQwRQtkbWHnGWtDVHG3ibva94l7x4Qa4Js68T72a73uAR8te90wf00Jcnyy7yjT4aE1DxrcH-MUiGOOlk4rQ9s-OY207sD0cGRY6byCOOOLo5NQQO6Z6G4K7X5Iqffoo9ZQRrvhKqnyAf4bhjArlANWfabpuRmVdwypsHKvzjJh0zyl8VP0s4LpNqltcBXz72r-r-RIzbegx0",
                            "title": "shopee.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG79Vsl3xDQ7U-MgmrsLWik-6qZ-wFl-wBLfjUQpQWdj7w-1iODDs-uMQErjFBAJvNTqOO35KCjiXpzADKx_LFgJP8sZHQKsWwfHXkmooffXK-Ro7fMkAT-zHD6KXgzlHR76Bpbh-7UVW-AkYpsl3x0eaeOhPqx3ZKnOx4rIHbYjU-5DnY-t1pLfjMISsZt8F9RdhpsmZS--_cBu-dy4Aq8JNFJGN6kJYtjoiPLlLww0urRzCLZcM9YkKihUL8mhnErDK9EA3dt0ftKh7UOCSzR1bJ0Y2k8SejgnNY56ZUzSFnDmhg8amo3Jt2i0l3lNnM09ocOYUFF_H7uRSCzlZXHfKb91RznDtbtfmkB1EqmREzzVmLcmjcsY1-LUPgewX7pfS4S3wi6updFlUS90TF9lNoyFeCThDoiF_t9JfOWjN4qcTyMAcOn0i_t2_w_r5V73Fg93t67DpvuQDGqERR6dAV5vy7aY9wX8-q4ka-JAsDwQEgcGAJmGyL5",
                            "title": "shopee.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKDIDPnD9vm0DRjBTByLjk3-hUL4LzFuD-I1E41p0srpJ4GJpvUam-SUMozwOlF5mEH3SSeOZgpQLLjeQGJ_wEl_YgYPAphpB11SWI2zDD4xH7lwI7XmV3HwwEYkDcYRNthz61lBLEgqVNbXc=",
                            "title": "vocus.cc"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1IxHG6GFQt9bSWXuJtu8ksKSRITNomNUNjNCGSQbQCK-jS42qFjV19VqCjvgjBZrhSaTSJdqVS_rV3FBMJbcA_vbLAxG1HPXZGVgldJiRqr9rFMbWIN1X",
                            "title": "ey.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEeAjw9cVuK7yYcBahBTA0BqwSAYCiGmVeH9uD93DAgwKJ6oFU8Djnwge93I1hbphGMyxtn72xpQv6lhQoinOzppRHkspSno9ilmnhNN7vEwU6l4JWPqy6JkkpS2sZgkNbHMIIGmT5kJCKSnDM6Ug==",
                            "title": "gov.taipei"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMUnrkZDDxy1NCGaI2mybX12oFfEf0IiWYCfV0jXPaHPOK4sgHJ41JWZSmFKuSPEXWPc3KZwbxHtw8uNUUs_UQygxmk8oxhPkDDC1hiRxl5EJwVIQDEjvwA4ndNt31nmICTpM-g8F7o6G-F_P6odprnV8-pTLzV0uUUHWgCVSVUmLlgMB5bg==",
                            "title": "miaoli.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFbbaijxYD0YAeRY_Pi3BG3NHKR-FLi-lJAU3wnBULL_tGLKWx23-VW6Y55BDi8nZEM3SCxjlI-8HbWUS5nZ_Zv0voYgqBHiVLCjFMMjEGiVrbjSp1hgFFs75hnr90K8c-e74Tcbe4=",
                            "title": "ey.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4iG6K1ie5bNjp6OsZxmfzc4YtTOFprUqaLJN0yeNaCBp1Wq4Nl8m0-X_WAno-QodqwdF3VvGnOh8nn_CO31sZPGq8A42tus-5iTE7_uy3BqYa2sxfXpTZ68A2Z4SXY-SzhmHeA_8aTu7UozDNM0Ha0maa",
                            "title": "consumers.org.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEngt1p4gp29HyMHLY-VCWvJf0-ezmkN0jWMqS-R0DPHrcpVKnzyI0Y7mqfdOXyGsKXYe5RqyITiM_O1JGXWyvAyUnId9w7RpezTgDd1iqFwZYZxyH01OyLJAnOFODmvAg2GrNYN4jSjgc=",
                            "title": "cpat.org.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_38cVtuyJG6Cor_Mq45_Rwedquwho0KU0OKOvuxBWSmWiQhCzrpMFB1DCrflDM74WQW9C0CtaxtPAxfD4r3lXMHp9aE3NtGSAukKhEXqoRTLBqLIwsoissldvihc8jDa7hQo=",
                            "title": "aoc.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcckTnXbXlumFlAiITSZebEkvvsiwADE9cUBMVGOo9pJFn9RB3l0kgol6FEKng4sB98coXem57jh9WSb8eu5iTw2zuAEfF3R25jNBLkP-eRKyqPAkuEgloASroVcWdRr21ZZihUuenqXU=",
                            "title": "ezlawyer.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGW1DcXQ8PXBBX9bJNMxKi-dmVLylalV0lCvJuogPhiamaEiiZin5YgI57cdvQ4Z0N9UpLMg99vIRM0NGrLsY894LRiiJvDWTPVFiEYFlkDnLHDo_t-Rw0lD0op_aTPhz14ozGIyCPnOgixxZtG6w==",
                            "title": "moj.gov.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqIvEbBMOKTlZx2sbvfgmXEGBtqUSijoF3lhb9Tlu-0xP8w7YsoYVK07D-kPHtC8RMPEzddKA__CZ30ulfYAS8hRlWs9RQjV5SXC29BxeYgTXSxHTSX5S-G245QqnB5Tw=",
                            "title": "sinsiang.com.tw"
                        }
                    },
                    {
                        "web": {
                            "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEFtWbLEdu-lVcri5eNycygCg-uJAPEWQF-riTNQyjpR9TA8busj8Z74aaNiJRLVbLS1PMkFFuH7bPOFsGSAXyxi2F0z9RdiF-WMlt5trNq2Cp5NshBRnEFsnQb-H7itFdPFvLSSGZukAVy1EwIlPdH4-II",
                            "title": "consumers.org.tw"
                        }
                    },  
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFWkyOa00TWJYoTQ_q9jVBA_srYImQTBCUv8uXcqN1-YZCkIFE90mKxvqEl4jIyLfyO13cJb-2ty_ppMUGL48Qe9uFVnvjBQuvrXzrC3_cHqncBIAS90LcMO1VbGI=",
                                "title": "oipt.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDBuKTmDzmNtcB2XZ7X73AB9_Eb5ndCSEZJgjl0oI65-NBDwie_uTZLIhEEOYhqffeor0c09yFoPcV80Dl6inUKxhYo_mFFQWS4YNZ07s2wRDtzJsPJa8MtJ95CVTuoN9-x_U7FuXwz_IFRrgEbw==",
                                "title": "lawbank.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjjt2s9FWmbfQbiaPPm8951q5Vv1eX--WKCo8SPH11_RbKIYl6V-OEW--ONaob_TC9hqsIX-RDRNKOCVcMqCM31gcpmrxW-Cq4_MJ_Z8eTL47LRQHM-Z4CSfSDOslQNU4c67MNhT10Nn-Y5dHpkm8ydXuzuM8Sy3yS",
                                "title": "legis-pedia.com"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGRJ2P1GQ2J9k1GBJoHx3UTjfSQLghtze_4ExSVuthuYpWh1RFzPFr72es7CBG8DhXigaNscYZV851V3hWgWCm9xX62NSkmrdTf2exBOVf1zuAt0bo87ebRj1zK3jyUHAwgwkOWMlyXTAqEdJU=",
                                "title": "vocus.cc"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9cTjlILf2n5FlVSA8eGaWoHhOJiBJTMjVq3DLF6a-qlz9gVj01CcIkyqnT0WJ85aQj0rFhAxNkyjkgK3yR1p9vaJQT_uEhItdvi8mhpLX9AVj2wm84NAWenXyOW0YDcMMf734Ad9Rzw==",
                                "title": "honganlaw.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMk9JpLJWsw1tXmqhbhAo8UlUiiLB6Zlsq2iZA3IRmYCNCG8rpGZVArVFS4z27dm8NyCnUQh-OtRAiGRilH1g5LGwvErlzcqy5QSTVDQ_rttj-Q_TDvQ9ysH5qGyM0o6MGzpkCw7DdgC2sbEqQIPuibej9hzDo3rHZ4Ge7",
                                "title": "moj.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFCUH9L1SFPaHz6HcqYeqS6QsQoptGyZNbW7AVE0BGcl4_DR8Ci6t6G0j377-KFfYjklljlJalMfs-GNcHM_q69bLAxTEZorNuxXT_C66y6x7Iw93m4unR2SXYJ_nVlZ5t6rhTHM5CGnw==",
                                "title": "squaresun.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmeNdcrRELibBO4qQZt7DFXERdum42u6j-7Lr-M881uVs249tt-_xBtGBtfeE9zPG4Ex7dYQOKE4m9RpBh5if3ULZftyV-N-xUKKSGrZDsyRTia9yAzo5ddB0VSXS4JhOsORrXIahuOwxuu2sCqz86afKUxQFbREoNGTny",
                                "title": "sme.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE_piFeqXrtvtKLKSIv7yz0y-7fNUu-vZXMUkmR98k9WXjVBTnDt8U3jZp1vDOl-eFIloEvOSy2kJ7HDlmF23OzaCxNzwoapL6sWEMXem_Q0ssJWrAf_zHuLsOMhdL1",
                                "title": "honganlaw.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFO29npMK1CVGoXgEIl3l7At8sFSqlf_1uHSFdwKBSgEbGUszOd0aU0CyBW1d0ptqg3BQZxQXQ4ckBPSkB3Z5WvX6HCatfStJ1uYkTC1nvFuWzdJh9HVu-G81dbHQpBFs8=",
                                "title": "sinsiang.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoJnLb0_7FqXxDQnbafDjCixceC4Ie8vizKldd3nA-IRpqH4WZyrT2zG1F_hh_sRB9meG0E3ep85L_ctQRJu4-UuKZk2aBwzqZvIV5yz-GsUG-HH53YiSEDrhZ3ATQ7mFtBWN6Pqs=",
                                "title": "fiftyplus.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGS4lXVs1Qc-iOxxEv0HK39yDRZcYxkvHJ3tKldxBW4iyKmmkknVC6sp70IgQwDyHzSWUfIo44jdLw8FsiIqEjmyo8Urv22xVNDVnd2eU0rsvOfibaE0bxpG2WqLD72xtgNOhc2gR42VtA=",
                                "title": "ezlawyer.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhpRMLZjGmnMPP1nXc8TOwbJ0rey23gYuO38cGwDfP2ogipDRgAy63XSX_BdkfQ17BC8kmxS8adz9dNYvVyXpGmqd_LtRT-MyACGCjYcIWvrQHiln2sPlTlFIDRXdK8ZwsDyGfQU76bifehp4=",
                                "title": "vocus.cc"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExYjDSCaVkOdSqu2qG-Ym5cTjO_RYKVvPqzxnOzerZQy7OI0BSlwprIMd9yE7hjWfAoLNUnKQ2n9QCWyyY6hvor5SvNy-S_REDT_jPqI9AaAd_CdYQiz3FoUbOrlhfMAZw1Y0p",
                                "title": "pinjie-law.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcZ89X3YWYEAwVC97FVzy86uHTx7KCCF93kvK0F9U8f5u7pEi0KZ-nje4jcDpngiJj4-WDj9mQfzrwALvQlcDiA8AV-_ar2B_0IdBzbX9pUEIJkNs8wPc2CTZgvbylkpHx5oTvHtFvxRiDVdk=",
                                "title": "vocus.cc"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGvQ2T63DMOWNP85Zv7nE4CIgczKTdBRsNLqssDasUwDpt8aNUMPOMT-ciq5pM11W5HVAYOc6XH1sffOuYQm-dcmNm1ZWBD6tWGpUwAUcbj93J6OlU6Y8VOlxrg3Fhuz04=",
                                "title": "gvm.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjkbYx3ub7hberVVOxgj77Lj_MeLCWGY4o65JT6uK9c6IOXIS9oDXjfbHBJMevmlr8oOxrJ63U1ImkTxREmq6uN9-eV5aNwS05i7CijRdz",
                                "title": "mll.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzVqtQN676H_QT8tP14s2FauPBsR0GPgcAVAgs-8bXzaB8CHiulk2DFvJR2oWe985zuy3893BXIWIERXsTxaqkGQMHvQ0F00U5Fsv7dodZmU_46BzH-Z-Iokqftdl5_Au3iK3qCR0Xpmz9-jCpTm9B3a_4pkv4MQ==",
                                "title": "taiwanlawyer.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWrrUwu5dL8gpwmuqTTFEG8UPy71qW_GWehifmFYQZbPgcwYeyq_PWFMAbTBBjckigmhqa8sok_O5fFgSNbzYxlbMKbsciywtSO6l8EQSq5Dv0P0AF4nhukqNZSimxDlgxZrWiW212Qsdt0ccGn-8S3DLLo3AhlYEr",
                                "title": "easy-law.net"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG75QUWATivU4ZKcnlXPIFtEcCV7DShLrD414PsNTPQ0McIxVy73KsvoklZCA0zOP9A3N0KdXlxrwYHwody4fFWKFJQHj7otf0O2zeueBJ-uUkFSloC_RTHpKMpOXSFFzO6Dpe0lVWn-KfAjP4xaPOBjnKnsvuIxsd_jfdu",
                                "title": "sme.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEoL0UM83ZfJiz-X9At7FZzzkSYpJqcg7AJKZu8YEpbW0FI0KV9Zvxt665XcK6jj4YUklToYMbXH7-He4s4Ev_m9X2nD58PvUoHfDWoWUhLXv5Ems9RPoJ_52WUXtNNdPqMVkPNmAEMpm543oI=",
                                "title": "vocus.cc"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7ojoYPNr2rWyk-M9ANdd68ZccPb2M2I80h1z819w3ftriBCbbbOQ_mANgBv2mv0ZWzENunTIeKyRFW4tzoJXSwPLgNv0f7u2mKXNXLO5EiJgtU_bwfZnwggIgzwsMa2FEWoib_htZL4VJ2eB_B247AbbvwCpytLS_QThcLAG2HOnbu1u95cdyJZDqV8I=",
                                "title": "wpto.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYUNM8i3uChisyK0cyuAARRzA4YPcgLFej3JSs39GHQl5EuNrQYjEI3sVjEHUlWWZ2DbLE-mSibZXWx-bABhKeGIvrdn2lHgU2ZQZDW6LYXGU49kC7jbSEK2eo3-DyE6drr0WBYwJQh4qeQBA-vDE1Thc=",
                                "title": "moj.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHrmMSSmknI3G0RpDzHtytO2_FMinGu4hPWk6gRNaE_SGtSzuEPtq_6XRo2bv-w_k9uLOMwDBF7oOgfYZVSrZmw8HY91hKSEC2Td9ojPbU0dC6LAgeNtBp07L8yYFbKI3b3LW0nuXxBKm9FhfyP5GF1uUY=",
                                "title": "ezlawyer.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEXOUP0KTc0lBxIL8SqmrFeXdTTJh9HW1HNRJiEGOKCSJaUYH4EoI9yjkd6QUjrkrer9dm6VCbd8fl0arhkdexbLEL4KWhVxMKrA3CpFvRVWaB_Yn22i0qE8U9hLxKE8sxBa82aDss=",
                                "title": "ey.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE6u0pPy7aNg9eJh49m2Be2R5Vvo0_HqYx2lH5AgVjodqBlu-_kcOs2M2sa9qGqFn9NMNO6aKuM8CkNTLYDoIvhNcKZkj5VJu3MR6v5D-QuJv20ayinAc8f-bh9NaG5U-wtXP9V5s4sC5fv",
                                "title": "taichung.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkxeb19lcPkHTHVDDYXvqnsSyI8SGBKugrPAlGB6jVGdp5cTy6M1G2Kh6gq8SGDzpbYWVz74BwMRIypTShwtmq8CPoaxKHEn2hxC3EKphEClNusXfityJBiiZATZ_a7kM_DIQ1B_h-ywRXej8A-aLyWw==",
                                "title": "ey.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGV2bqnf1etDlKBeIdwvlut0fLBGhul3FmtHzrIeNuEurHQ63T4iv8P8IVG-PTu_MGEickrzHcPlr2GZIbZNT3qpAD_zc8UNtqfTzRLeLczWPFJ87j0lipt9Yi9mLAR7_4yHvZ7dOI5Av8=",
                                "title": "cpat.org.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDNZcqam2EN3JQ968hkRQ_ZXp7fvthiVlqv3_TpMtFVz629ZARugxA7OvYKBRsje7gLq5jVq4yuGnmk1nINu4ki5lCOblyAkmDmB5CBesebOhbWULOCIR0hurImTnq1mkHRFoaRJ8lsShNEahsfhvqXdl_",
                                "title": "consumers.org.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMUrvTt5lo_Hh_z2oL4D_iXlnCvVDxRC_GUpENAEhb9OzJI3wuvIdA6UMXVx3lm9TJAD05I0KtMS2gsTEWeun3wUbkYwpuEEbqRaEp_7S7bu8c5OaHcOb2sESZ37UY4w==",
                                "title": "ithome.com.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFtk6Z75h9B_DChH_YASjISpKWDtvW6iYQSRvCPziXP4TR-S57CHe2GwIBFfO1wsBvbjDx2U7lEoRJwrj5m_VOKWQfwX0Q8zvcksRfMpl0L4yaBP9NF1QJdMv5u2odtmVvJkEK3aqQbwXGYtCq3TAG94F-fhWvI6MBTmGplQ0feFnpKm0QoFgOWv6aXZNh6OKYEoLdc1RYWa9JN6BTcCHSZkxrREQ==",
                                "title": "mof.gov.tw"
                            }
                        },
                        {
                            "web": {
                                "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkWaR3ez7lLkQWLWFWVxjHKCQn-k0_1ORTcRlnqkcxCb3-1WqBUiJoOKNsQDPFreH0URQNFqjHRX8IA7D6cl76uKIXCcp_UgCZD1lbxqYRFnQu-lByWbJA_yjNx4EZ2kgmtZc=",
                                "title": "aoc.gov.tw"
                            }
                        }                
  ]
};

    const references = virtualReferences[category];
    if (!references) {
      return new Response(JSON.stringify({ error: '找不到對應類別的虛擬引用數據' }), {
        status: 404,
        headers: getCORSHeaders()
      });
    }

    // 隨機選擇 25-40 個引用
    const minCount = 25;
    const maxCount = Math.min(40, references.length);
    const selectedCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    
    // 隨機打亂並選擇指定數量
    const shuffledReferences = [...references].sort(() => Math.random() - 0.5);
    const selectedReferences = shuffledReferences.slice(0, selectedCount);
    
    // 為每個引用生成隨機的識別碼末二位
    const enhancedReferences = selectedReferences.map((ref, index) => {
      // 生成隨機的末二位數字 (01-99)
      const randomSuffix = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
      
      return {
        ...ref,
        // 在 URI 中添加識別碼參數，或者修改現有的識別碼
        web: {
          ...ref.web,
          uri: ref.web.uri.includes('?') 
            ? `${ref.web.uri}&ref_id=${randomSuffix}` 
            : `${ref.web.uri}?ref_id=${randomSuffix}`
        },
        // 添加識別碼字段以便前端使用
        referenceId: `VR${category.substring(0, 2)}${randomSuffix}`
      };
    });

    const response = {
      category: category,
      references: enhancedReferences,
      count: enhancedReferences.length
    };

    console.log(`📊 返回 ${category} 的虛擬引用數據，從 ${references.length} 個中隨機選擇了 ${enhancedReferences.length} 個參考資料`);

    return new Response(JSON.stringify(response), {
      headers: getCORSHeaders()
    });
  } catch (error) {
    console.error('❌ 處理虛擬引用數據請求時發生錯誤:', error);
    return new Response(JSON.stringify({ error: '服務器內部錯誤' }), {
      status: 500,
      headers: getCORSHeaders()
    });
  }
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}
