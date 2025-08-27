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
    
    // 創建一個基於時間和客戶端資訊的雜湊值
    const hashInput = `${clientInfo.timestamp}-${clientInfo.userAgent}-${clientInfo.referrer}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉換為32位整數
    }
    
    // 根據雜湊值決定分配（偶數為 Case A，奇數為 Case B）
    const shouldUseCaseA = Math.abs(hash) % 2 === 0;
    
    const assignedCase = shouldUseCaseA ? 'Case A' : 'Case B';
    const redirectUrl = shouldUseCaseA 
      ? 'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-a.html'
      : 'https://jasonliu0101.github.io/ms-thesis-llm-kit/case-b.html';
    
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
      // 雙重調用：有 grounding 和無 grounding
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}
