class StreamingChatApp {
    constructor() {
        // 生成會話 ID
        this.sessionId = this.generateSessionId();
        
        // 跟蹤是否已顯示過識別碼
        this.hasShownSessionId = false;
        
        // 檢查是否需要顯示歡迎頁面
        this.showWelcomeModal();
        
        // 設定 Worker URL - 部署後請更新此 URL
        this.workerUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev';
        
        // 串流狀態追蹤
        this.isStreaming = false;
        this.currentStreamController = null;
        
        // 調試信息
        console.log('=== StreamingChatApp 初始化 ===');
        console.log('設定的 Worker URL:', this.workerUrl);
        console.log('當前頁面位置:', window.location.href);
        console.log('會話 ID:', this.sessionId);
        
        this.initializeElements();
        this.bindEvents();
        this.loadSavedSettings();
        this.autoResizeTextarea();
    }

    generateSessionId() {
        // 生成時間戳和隨機字符串組合的會話 ID
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `stream-session-${timestamp}-${randomStr}`;
    }

    generateSessionCode(data) {
        // 第一位：判斷是否來自例題
        let digit1 = '0'; // 預設不是例題
        const currentQuestion = data.originalQuestion || '';
        
        if (currentQuestion && this.selectedExampleQuestion) {
            if (currentQuestion === this.selectedExampleQuestion) {
                const exampleQuestions = [
                    "如果我的車被別人騎走，但加滿油還回來了，我可以告他嗎？",
                    "鄰居的狗經常在夜間吠叫影響睡眠，我可以採取什麼法律行動？",
                    "我在網路上購買商品但收到假貨，賣家拒絕退款怎麼辦？"
                ];
                
                for (let i = 0; i < exampleQuestions.length; i++) {
                    if (currentQuestion === exampleQuestions[i]) {
                        digit1 = (i + 1).toString();
                        break;
                    }
                }
            }
        }

        // 第二位：2表示為Streaming版本
        const digit2 = '2';

        // 第三位：判斷是否開啟思考流程
        const digit3 = (this.showThinkingCheckbox.checked && data.thinking) ? '1' : '0';

        // 第四位：5到9隨機
        const digit4 = (Math.floor(Math.random() * 5) + 5).toString();

        // 第五、六位：引用數量（00-99）
        const referenceCount = (data.references && data.references.length) ? data.references.length : 0;
        const digits56 = referenceCount.toString().padStart(2, '0');

        return digit1 + digit2 + digit3 + digit4 + digits56;
    }

    showWelcomeModal() {
        const modal = document.getElementById('researchWelcomeModal');
        console.log('🎭 找到模態框元素:', !!modal);
        
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            console.log('✅ 模態框已顯示');
            
            const startButton = document.getElementById('startSystemBtn');
            const startBtnText = document.getElementById('startBtnText');
            
            if (startButton && startBtnText) {
                // 直接啟用按鈕，不需要等待
                startBtnText.textContent = '開始使用系統';
                startButton.disabled = false;
                startButton.classList.remove('disabled');

                startButton.addEventListener('click', () => {
                    modal.style.display = 'none';
                    console.log('✅ 開始使用系統');
                });
            }
        }
    }

    initializeElements() {
        this.chatContainer = document.getElementById('chatContainer');
        this.questionInput = document.getElementById('questionInput');
        this.sendButton = document.getElementById('sendButton');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // 設定選項元素
        this.showThinkingCheckbox = document.getElementById('showThinking');
        this.showReferencesCheckbox = document.getElementById('showReferences');
        this.enableSearchCheckbox = document.getElementById('enableSearch');
        
        console.log('✅ DOM 元素初始化完成');
    }

    bindEvents() {
        // 綁定發送按鈕事件
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSendQuestion());
        }

        // 綁定輸入框事件
        if (this.questionInput) {
            this.questionInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendQuestion();
                }
            });

            this.questionInput.addEventListener('input', () => {
                this.updateSendButtonState();
                this.autoResizeTextarea();
            });
        }

        // 綁定快速問題按鈕
        const questionButtons = document.querySelectorAll('.question-btn-compact');
        questionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const question = button.getAttribute('data-question');
                this.selectedExampleQuestion = question;
                if (this.questionInput) {
                    this.questionInput.value = question;
                    this.updateSendButtonState();
                    this.autoResizeTextarea();
                }
            });
        });

        console.log('✅ 事件綁定完成');
    }

    loadSavedSettings() {
        // 載入儲存的設定
        const savedSettings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
        
        if (this.showThinkingCheckbox) {
            this.showThinkingCheckbox.checked = savedSettings.showThinking !== false; // 預設為 true
        }
        if (this.showReferencesCheckbox) {
            this.showReferencesCheckbox.checked = savedSettings.showReferences !== false; // 預設為 true
        }
        if (this.enableSearchCheckbox) {
            this.enableSearchCheckbox.checked = savedSettings.enableSearch !== false; // 預設為 true
        }

        console.log('✅ 設定載入完成');
    }

    autoResizeTextarea() {
        if (this.questionInput) {
            this.questionInput.style.height = 'auto';
            this.questionInput.style.height = this.questionInput.scrollHeight + 'px';
        }
    }

    updateSendButtonState() {
        const hasText = this.questionInput && this.questionInput.value.trim().length > 0;
        if (this.sendButton) {
            this.sendButton.disabled = !hasText || this.isStreaming;
        }
    }

    async handleSendQuestion() {
        const question = this.questionInput?.value.trim();
        if (!question || this.isStreaming) return;

        this.isStreaming = true;
        this.updateSendButtonState();

        // 顯示用戶消息
        this.addUserMessage(question);

        // 清空輸入框
        this.questionInput.value = '';
        this.autoResizeTextarea();

        try {
            await this.startStreamingResponse(question);
        } catch (error) {
            console.error('串流回應錯誤:', error);
            this.addErrorMessage('抱歉，發生了錯誤。請稍後再試。');
        } finally {
            this.isStreaming = false;
            this.updateSendButtonState();
        }
    }

    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-user"></i>
                    <span class="message-label">用戶</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    async startStreamingResponse(question) {
        // 創建 AI 回應容器
        const responseDiv = this.createResponseContainer();
        
        try {
            const response = await fetch(`${this.workerUrl}/stream-gemini`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: false,  // 思考階段不使用搜尋
                    showThinking: !!(this.showThinkingCheckbox && this.showThinkingCheckbox.checked),
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let thinkingContainer = null;
            let answerContainer = null;
            let referencesContainer = null;
            
            let buf = '';
            let eventBuf = []; // 暫存單一 SSE 事件的多行
            let shouldStop = false;

            try {
                while (true && !shouldStop) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buf += decoder.decode(value, { stream: true });

                    // 依據 SSE 規格，事件以「空白行」結束（\n\n 或 \r\n\r\n）
                    let sep;
                    while ((sep = buf.search(/\r?\n\r?\n/)) !== -1) {
                        const rawEvent = buf.slice(0, sep);     // 這是一個完整事件（可能多行 data:）
                        buf = buf.slice(sep + (buf[sep] === '\r' ? 4 : 2));

                        // 將多行 data: 合併
                        const dataLines = rawEvent
                            .split(/\r?\n/)
                            .filter(l => l.startsWith('data:'))   // 允許 'data:' 或 'data: ' 兩者
                            .map(l => l.replace(/^data:\s?/, ''));

                        if (dataLines.length === 0) {
                            // 可能是註解行（: ping）或其他欄位，略過
                            continue;
                        }

                        const dataStr = dataLines.join('\n');   // 多行合併成一個 payload
                        if (dataStr === '[DONE]') {
                            // 結束：停止外層讀取、更新 UI
                            shouldStop = true;
                            // 顯示完成（避免只看到 ping/complete 卻沒關轉圈）
                            const code = this.generateSessionCode({
                                originalQuestion: question,
                                thinking: this.showThinkingCheckbox?.checked,
                                references: []
                            });
                            this.showSessionCode(responseDiv, code);
                            break;
                        }

                        let payload;
                        try {
                            payload = JSON.parse(dataStr);
                        } catch (e) {
                            console.warn('SSE JSON 解析失敗，原始：', dataStr);
                            continue;
                        }

                        // 如果是你自訂的協議（有 type），照舊處理
                        if (payload && typeof payload === 'object' && 'type' in payload) {
                            switch (payload.type) {
                                case 'thinking_start':
                                    thinkingContainer = this.createThinkingContainer(responseDiv);
                                    break;
                                case 'thinking_chunk':
                                    if (thinkingContainer && this.showThinkingCheckbox?.checked) {
                                        // 翻譯思考內容為中文
                                        this.translateAndAppendThinking(thinkingContainer, payload.content);
                                    }
                                    break;
                                case 'thinking_end':
                                    console.log('🎯 思考階段結束，繼續等待串流回答');
                                    // 隱藏思考中的串流指示器
                                    const streamingIndicator = responseDiv.querySelector('.streaming-indicator');
                                    if (streamingIndicator) {
                                        streamingIndicator.style.display = 'none';
                                    }
                                    // 不要調用 fetchCompleteAnswer，讓串流繼續
                                    break;
                                case 'answer_start':
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    break;
                                case 'answer_chunk':
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    if (answerContainer) {
                                        // 立即處理markdown格式，讓顯示更即時可靠
                                        const formattedChunk = this.formatResponseChunk(payload.content);
                                        answerContainer.innerHTML += formattedChunk;
                                        this.scrollToBottom();
                                    }
                                    break;
                                case 'grounding':
                                    if (payload.references?.length) {
                                        this.createReferencesContainer(responseDiv, payload.references);
                                    }
                                    break;
                                case 'complete':
                                    // 顯示引用來源（如果有的話）
                                    if (payload.references?.length) {
                                        this.createReferencesContainer(responseDiv, payload.references);
                                    }
                                    
                                    const code = this.generateSessionCode({
                                        originalQuestion: question,
                                        thinking: this.showThinkingCheckbox?.checked,
                                        references: payload.references || []
                                    });
                                    this.showSessionCode(responseDiv, code);
                                    shouldStop = true; // 完成後停止讀取
                                    break;
                                case 'error':
                                    throw new Error(payload.message || '串流處理錯誤');
                            }
                        } else {
                            // 否則視為「Gemini 原生 SSE」事件
                            const didAppend = this.handleGeminiPayload(payload, {
                                ensureThinkingContainer: () => {
                                    if (!thinkingContainer) thinkingContainer = this.createThinkingContainer(responseDiv);
                                    return thinkingContainer;
                                },
                                ensureAnswerContainer: () => {
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    return answerContainer;
                                },
                                showThinking: !!(this.showThinkingCheckbox && this.showThinkingCheckbox.checked),
                                onThinkingContent: (content) => {
                                    // 確保思考容器存在，然後翻譯思考內容
                                    if (!thinkingContainer) thinkingContainer = this.createThinkingContainer(responseDiv);
                                    if (this.showThinkingCheckbox?.checked) {
                                        this.translateAndAppendThinking(thinkingContainer, content);
                                    }
                                },
                                onThinkingEnd: () => {
                                    // 思考結束，呼叫完整 API
                                    this.fetchCompleteAnswer(question, responseDiv);
                                    shouldStop = true;
                                }
                            });

                            // 依需要也可以這裡觀察安全性封鎖/回饋等
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            console.error('串流請求錯誤:', error);
            this.showErrorInResponse(responseDiv, error.message);
        }
    }

    createResponseContainer() {
        const responseDiv = document.createElement('div');
        responseDiv.className = 'message ai-message';
        responseDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-robot"></i>
                    <span class="message-label">AI 助手</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
            </div>
        `;
        
        this.chatContainer.appendChild(responseDiv);
        this.scrollToBottom();
        return responseDiv;
    }

    createThinkingContainer(responseDiv) {
        const messageContent = responseDiv.querySelector('.message-content');
        
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-section';
        thinkingDiv.innerHTML = `
            <div class="thinking-header">
                <i class="fas fa-brain"></i>
                <span>思考流程</span>
                <div class="streaming-indicator">
                    <i class="fas fa-circle-notch fa-spin"></i>
                </div>
            </div>
            <div class="thinking-content">
            </div>
        `;
        
        messageContent.appendChild(thinkingDiv);
        this.scrollToBottom();
        return thinkingDiv.querySelector('.thinking-content');
    }

    createAnswerContainer(responseDiv) {
        const messageContent = responseDiv.querySelector('.message-content');
        
        // 檢查是否已經有答案容器
        let existingAnswerContainer = messageContent.querySelector('.response-section');
        if (existingAnswerContainer) {
            return existingAnswerContainer.querySelector('.response-content');
        }
        
        // 隱藏思考中的串流指示器
        const streamingIndicator = responseDiv.querySelector('.streaming-indicator');
        if (streamingIndicator) {
            streamingIndicator.style.display = 'none';
        }

        const answerDiv = document.createElement('div');
        answerDiv.className = 'response-section';
        answerDiv.innerHTML = `
            <div class="response-header">
                <i class="fas fa-comment-alt"></i>
                <span>回答</span>
            </div>
            <div class="response-content">
            </div>
        `;
        
        messageContent.appendChild(answerDiv);
        this.scrollToBottom();
        return answerDiv.querySelector('.response-content');
    }

    createReferencesContainer(responseDiv, references) {
        const messageContent = responseDiv.querySelector('.message-content');
        
        if (!this.showReferencesCheckbox?.checked || !references || references.length < 10) {
            return null;
        }

        const referencesDiv = document.createElement('div');
        referencesDiv.className = 'references-section large-reference-set';
        referencesDiv.innerHTML = `
            <div class="references-header">
                <i class="fas fa-list-alt"></i>
                <span>引用來源匯總</span>
                <span class="reference-count">(${references.length} 個來源)</span>
                <button class="toggle-references" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                    <i class="fas fa-chevron-up"></i>
                </button>
            </div>
            <div class="references-content">
                ${this.formatLargeReferenceSet(references)}
            </div>
        `;
        
        messageContent.appendChild(referencesDiv);
        this.scrollToBottom();
        return referencesDiv;
    }

    appendToContainer(container, content) {
        if (container) {
            // 直接附加內容，不進行任何格式化
            container.innerHTML += content;
            this.scrollToBottom();
        }
    }

    showSessionCode(responseDiv, code) {
        // 隱藏串流指示器
        const streamingIndicators = responseDiv.querySelectorAll('.streaming-indicator');
        streamingIndicators.forEach(indicator => {
            indicator.style.display = 'none';
        });

        if (!this.hasShownSessionId) {
            const messageContent = responseDiv.querySelector('.message-content');
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-id-display';
            sessionDiv.innerHTML = `
                <div class="session-id-header">
                    <i class="fas fa-id-card"></i>
                    <span>研究識別碼</span>
                </div>
                <div class="session-id-content">
                    <div class="session-id-value">
                        <span class="session-id-text">${code}</span>
                        <button class="copy-session-btn" id="copy-btn-${code}" onclick="window.chatApp.copySessionCode('${code}', this)" title="複製識別碼">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <p class="session-id-note">
                        <i class="fas fa-info-circle"></i>
                        請記下此識別碼，用於問卷填寫和後續追蹤
                    </p>
                </div>
            `;
            
            messageContent.appendChild(sessionDiv);
            this.hasShownSessionId = true;
            this.scrollToBottom();
        }
    }

    copySessionCode(code, buttonElement) {
        navigator.clipboard.writeText(code).then(() => {
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-check"></i>';
            buttonElement.style.color = '#28a745';
            
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('複製失敗:', err);
        });
    }

    showErrorInResponse(responseDiv, errorMessage) {
        const messageContent = responseDiv.querySelector('.message-content');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-section';
        errorDiv.innerHTML = `
            <div class="error-header">
                <i class="fas fa-exclamation-triangle"></i>
                <span>錯誤</span>
            </div>
            <div class="error-content">
                ${this.escapeHtml(errorMessage)}
            </div>
        `;
        
        messageContent.appendChild(errorDiv);
        this.scrollToBottom();
    }

    addErrorMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="message-label">錯誤</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <div class="error-text">${this.escapeHtml(message)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    handleGeminiPayload(payload, ctx) {
        // 可能收到安全性或提示回饋：payload.promptFeedback / promptTokenCount 等
        // 這裡先專注於把文字抽出來
        if (!payload || typeof payload !== 'object') return false;

        const extractTexts = () => {
            // 支援兩型：
            // 1) candidates[0].delta.parts[*].text  (增量)
            // 2) candidates[0].content.parts[*].text (整段)
            const cand = Array.isArray(payload.candidates) && payload.candidates[0] ? payload.candidates[0] : null;
            if (!cand) return [];

            // 先嘗試 delta（增量）
            if (cand.delta && Array.isArray(cand.delta.parts)) {
                return cand.delta.parts.map(p => ({
                    text: (p && typeof p.text === 'string') ? p.text : '',
                    thought: p.thought === true
                })).filter(p => p.text);
            }

            // 再嘗試 content（完整/分段）
            if (cand.content && Array.isArray(cand.content.parts)) {
                return cand.content.parts.map(p => ({
                    text: (p && typeof p.text === 'string') ? p.text : '',
                    thought: p.thought === true
                })).filter(p => p.text);
            }

            // 有些情況 text 可能直接掛在 cand.text（備援）
            if (typeof cand.text === 'string' && cand.text) {
                return [{ text: cand.text, thought: false }];
            }

            return [];
        };

        const pieces = extractTexts();
        if (pieces.length === 0) {
            // 也許是 safety 標記、meta、或非文字增量，直接略過
            return false;
        }

        let hasThinking = false;
        let hasAnswer = false;

        for (const piece of pieces) {
            if (piece.thought && ctx.showThinking) {
                // 思考內容
                hasThinking = true;
                if (ctx.onThinkingContent) {
                    ctx.onThinkingContent(piece.text);
                }
            } else if (!piece.thought) {
                // 答案內容 - 但在混合模式下我們跳過，因為會用完整 API
                hasAnswer = true;
            }
        }

        // 如果從思考階段轉到答案階段
        if (hasAnswer && hasThinking && ctx.onThinkingEnd) {
            ctx.onThinkingEnd();
        }

        return hasThinking || hasAnswer;
    }

    async translateAndAppendThinking(container, content) {
        try {
            // 直接翻譯為中文，不顯示任何英文或提示
            const translatedContent = await this.translateText(content);
            const finalContent = translatedContent || content;
            
            // 格式化翻譯後的內容並直接顯示
            const formattedContent = this.formatThinking(finalContent);
            container.innerHTML += formattedContent;
            this.scrollToBottom();
        } catch (error) {
            console.warn('翻譯思考內容失敗:', error);
            // 翻譯失敗時，直接顯示格式化的原文（不顯示錯誤提示）
            const formattedContent = this.formatThinking(content);
            container.innerHTML += formattedContent;
            this.scrollToBottom();
        }
    }

    async translateText(text) {
        try {
            const response = await fetch(`${this.workerUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,  // 修正參數名稱為 q
                    targetLanguage: 'zh-TW'
                })
            });

            if (!response.ok) {
                throw new Error(`翻譯請求失敗: ${response.status}`);
            }

            const result = await response.json();
            console.log('🌍 翻譯 API 回應:', result);
            
            // 正確解析翻譯結果
            if (result.data && result.data.translations && result.data.translations[0]) {
                return result.data.translations[0].translatedText || text;
            } else if (result.translatedText) {
                // 備用格式
                return result.translatedText;
            } else {
                console.warn('⚠️ 翻譯回應格式異常:', result);
                return text;
            }
        } catch (error) {
            console.warn('翻譯請求錯誤:', error);
            return text; // 翻譯失敗時返回原文
        }
    }

    async fetchCompleteAnswer(question, responseDiv) {
        try {
            console.log('🔄 開始獲取完整答案...');
            
            // 檢查是否已經有串流的回答內容
            let answerContainer = responseDiv.querySelector('.response-content');
            const hasExistingContent = answerContainer && answerContainer.innerHTML.trim().length > 0;
            
            if (hasExistingContent) {
                console.log('📝 已有串流回答內容，跳過完整 API 調用');
                // 如果已經有內容，只處理引用和會話碼
                const code = this.generateSessionCode({
                    originalQuestion: question,
                    thinking: this.showThinkingCheckbox?.checked,
                    references: []
                });
                this.showSessionCode(responseDiv, code);
                return;
            }
            
            // 呼叫完整的 API（與 Case A/B 相同）
            const response = await fetch(`${this.workerUrl}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: !!(this.enableSearchCheckbox && this.enableSearchCheckbox.checked),
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ 完整答案 API 回應:', result);
            
            // 創建答案容器（如果還沒有的話）
            if (!answerContainer) {
                answerContainer = this.createAnswerContainer(responseDiv);
            }
            
            // 顯示完整答案
            if (result.answer) {
                console.log('📝 正在顯示答案內容...');
                const formattedAnswer = this.formatResponse(result.answer);
                answerContainer.innerHTML = formattedAnswer;
                this.scrollToBottom();
            } else {
                console.warn('⚠️ 沒有收到答案內容');
            }

            // 顯示引用來源
            if (result.references && result.references.length > 0) {
                console.log('📚 顯示引用來源:', result.references.length, '個');
                this.createReferencesContainer(responseDiv, result.references);
            }

            // 生成並顯示識別碼
            const code = this.generateSessionCode({
                originalQuestion: question,
                thinking: this.showThinkingCheckbox?.checked,
                references: result.references || []
            });
            this.showSessionCode(responseDiv, code);

        } catch (error) {
            console.error('❌ 完整答案請求錯誤:', error);
            this.showErrorInResponse(responseDiv, `獲取完整答案時發生錯誤: ${error.message}`);
        }
    }

    formatResponseChunk(chunk) {
        if (!chunk) return '';
        
        // 處理 Markdown 格式 - 即時處理每個chunk
        let formatted = chunk;
        
        // 處理粗體文字 **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 處理項目符號列表 (行首的 * 空格)
        formatted = formatted.replace(/^\*\s/gm, '<span style="color: #666;">•</span> ');
        
        // 處理數字列表
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');
        
        // 移除 Markdown 標題符號 ### ## #
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 處理重要標題（以冒號結尾）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        return formatted;
    }

    formatThinking(thinking) {
        if (!thinking) return '';
        
        // 處理 <thinking> 標籤 - 提取內容並移除標籤
        let formatted = thinking;
        
        // 如果包含 <thinking> 標籤，提取其中的內容
        const thinkingMatch = thinking.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
            formatted = thinkingMatch[1].trim();
        }
        
        // 移除任何剩餘的 <thinking> 標籤
        formatted = formatted.replace(/<\/?thinking>/g, '');

        // 處理 Markdown 格式 - 在轉換 HTML 之前先處理
        // 移除 Markdown 標題 ### ## #（包括行首和 <br> 後的）
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        formatted = formatted.replace(/(<br>)#{1,6}\s*/g, '$1');
        
        // 先處理粗體文字 **text** - 在處理斜體之前
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<!BOLD!>$1<!ENDBOLD!>');
        
        // 先保護項目符號列表的星號 (行首或<br>後的 * 空格)
        formatted = formatted.replace(/^(\s*)\*\s/gm, '$1<!LISTBULLET!> ');
        formatted = formatted.replace(/(<br>)(\s*)\*\s/g, '$1$2<!LISTBULLET!> ');
        
        // 移除斜體格式 *text* - 只保留文字內容
        formatted = formatted.replace(/\*(.*?)\*/g, '$1');

        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 再次處理可能殘留的標題符號（針對轉換後的內容）
        formatted = formatted.replace(/<br>\s*#{1,6}\s*/g, '<br>');
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 恢復粗體文字標記
        formatted = formatted.replace(/&lt;!BOLD!&gt;(.*?)&lt;!ENDBOLD!&gt;/g, '<strong>$1</strong>');
        
        // 處理數字列表
        formatted = formatted.replace(/(\d+)\.\s/g, '<strong>$1.</strong> ');
        
        // 處理項目符號列表 (包括星號、橫線、圓點)
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        formatted = formatted.replace(/&lt;!LISTBULLET!&gt;/g, '<span style="color: #666;">•</span>');
        
        // 處理重要標題（以冒號結尾的行）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        return formatted;
    }

    formatResponse(response) {
        if (!response) return '';
        
        // 移除任何 <thinking> 標籤（如果意外包含在回答中）
        let formatted = response.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
        
        // 處理 Markdown 格式 - 在轉換 HTML 之前先處理
        // 移除 Markdown 標題 ### ## #（包括行首和 <br> 後的）
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        formatted = formatted.replace(/(<br>)#{1,6}\s*/g, '$1');
        
        // 先處理粗體文字 **text** - 在處理斜體之前
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<!BOLD!>$1<!ENDBOLD!>');
        
        // 先保護項目符號列表的星號 (行首或<br>後的 * 空格)
        formatted = formatted.replace(/^(\s*)\*\s/gm, '$1<!LISTBULLET!> ');
        formatted = formatted.replace(/(<br>)(\s*)\*\s/g, '$1$2<!LISTBULLET!> ');
        
        // 移除斜體格式 *text* - 只保留文字內容
        formatted = formatted.replace(/\*(.*?)\*/g, '$1');
        
        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 再次處理可能殘留的標題符號（針對轉換後的內容）
        formatted = formatted.replace(/<br>\s*#{1,6}\s*/g, '<br>');
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 恢復粗體文字標記
        formatted = formatted.replace(/&lt;!BOLD!&gt;(.*?)&lt;!ENDBOLD!&gt;/g, '<strong>$1</strong>');
        
        // 處理標題（以冒號結尾）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        // 處理數字列表
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');
        
        // 處理項目符號列表 (包括星號、橫線、圓點)
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        formatted = formatted.replace(/&lt;!LISTBULLET!&gt;/g, '<span style="color: #666;">•</span>');
        
        return formatted;
    }

    formatLargeReferenceSet(references) {
        if (!references || references.length === 0) return '';
        
        // 將大量引用來源以更緊湊的方式顯示
        return `
            <div class="large-reference-notice">
                <p><strong>📋 本回答引用了 ${references.length} 個來源，已移除文本中的註腳編號以提升閱讀體驗。</strong></p>
                <p>以下是完整的引用來源列表：</p>
            </div>
            <div class="large-reference-list">
                ${references.map((ref, index) => `
                    <div class="reference-item compact">
                        <div class="reference-number">${index + 1}</div>
                        <div class="reference-details">
                            <a href="${ref.url || ref.uri}" target="_blank" rel="noopener noreferrer" title="${this.escapeHtml(ref.title)}">
                                ${this.escapeHtml(ref.title.length > 80 ? ref.title.substring(0, 77) + '...' : ref.title)}
                            </a>
                            <div class="reference-domain">${this.extractDomain(ref.url || ref.uri)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    extractDomain(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch (e) {
            return url || '';
        }
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    }

    addErrorMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message error-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="message-label">錯誤</span>
                    <span class="timestamp">${new Date().toLocaleString('zh-TW')}</span>
                </div>
                <div class="error-text">${this.escapeHtml(message)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM 載入完成，初始化 StreamingChatApp...');
    try {
        window.chatApp = new StreamingChatApp();
        console.log('✅ StreamingChatApp 初始化成功');
    } catch (error) {
        console.error('❌ StreamingChatApp 初始化失敗:', error);
    }
});
