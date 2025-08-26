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
        messageDiv.className = 'chat-message user-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-user"></i>
                    <span class="message-label">您的問題</span>
                    <span class="timestamp">${new Date().toLocaleString('zh-TW')}</span>
                </div>
                <div class="user-text">${this.escapeHtml(message)}</div>
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
                    enableSearch: !!(this.enableSearchCheckbox && this.enableSearchCheckbox.checked),
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
                                        this.appendToContainer(thinkingContainer, payload.content);
                                    }
                                    break;
                                case 'thinking_end':
                                    answerContainer = this.createAnswerContainer(responseDiv);
                                    break;
                                case 'answer_start':
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    break;
                                case 'answer_chunk':
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    if (answerContainer) this.appendToContainer(answerContainer, payload.content);
                                    break;
                                case 'grounding':
                                    if (payload.references?.length) {
                                        this.createReferencesContainer(responseDiv, payload.references);
                                    }
                                    break;
                                case 'complete':
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
                                ensureAnswerContainer: () => {
                                    if (!answerContainer) answerContainer = this.createAnswerContainer(responseDiv);
                                    return answerContainer;
                                },
                                showThinking: !!(this.showThinkingCheckbox && this.showThinkingCheckbox.checked),
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
        responseDiv.className = 'chat-message ai-message';
        responseDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-robot"></i>
                    <span class="message-label">AI 回應</span>
                    <span class="timestamp">${new Date().toLocaleString('zh-TW')}</span>
                    <div class="streaming-indicator">
                        <i class="fas fa-circle-notch fa-spin"></i>
                        <span>串流中...</span>
                    </div>
                </div>
                <div class="response-content">
                    <!-- 內容將在此處動態添加 -->
                </div>
            </div>
        `;
        
        this.chatContainer.appendChild(responseDiv);
        this.scrollToBottom();
        return responseDiv;
    }

    createThinkingContainer(responseDiv) {
        const responseContent = responseDiv.querySelector('.response-content');
        
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-section';
        thinkingDiv.innerHTML = `
            <div class="section-header">
                <i class="fas fa-brain"></i>
                <span>思考流程</span>
                <div class="thinking-indicator">
                    <i class="fas fa-circle-notch fa-spin"></i>
                </div>
            </div>
            <div class="thinking-content">
                <div class="thinking-text"></div>
            </div>
        `;
        
        responseContent.appendChild(thinkingDiv);
        this.scrollToBottom();
        return thinkingDiv.querySelector('.thinking-text');
    }

    createAnswerContainer(responseDiv) {
        const responseContent = responseDiv.querySelector('.response-content');
        
        // 隱藏思考中指示器
        const thinkingIndicator = responseDiv.querySelector('.thinking-indicator');
        if (thinkingIndicator) {
            thinkingIndicator.style.display = 'none';
        }

        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-section';
        answerDiv.innerHTML = `
            <div class="section-header">
                <i class="fas fa-comment-dots"></i>
                <span>詳細回答</span>
                <div class="answer-indicator">
                    <i class="fas fa-circle-notch fa-spin"></i>
                </div>
            </div>
            <div class="answer-content">
                <div class="answer-text"></div>
            </div>
        `;
        
        responseContent.appendChild(answerDiv);
        this.scrollToBottom();
        return answerDiv.querySelector('.answer-text');
    }

    createReferencesContainer(responseDiv, references) {
        const responseContent = responseDiv.querySelector('.response-content');
        
        if (!this.showReferencesCheckbox?.checked) {
            return null;
        }

        const referencesDiv = document.createElement('div');
        referencesDiv.className = 'references-section';
        referencesDiv.innerHTML = `
            <div class="section-header">
                <i class="fas fa-link"></i>
                <span>引用來源</span>
            </div>
            <div class="references-content">
                ${references.map((ref, index) => `
                    <div class="reference-item">
                        <div class="reference-header">
                            <i class="fas fa-external-link-alt"></i>
                            <a href="${ref.uri}" target="_blank" rel="noopener noreferrer">
                                ${ref.title || `來源 ${index + 1}`}
                            </a>
                        </div>
                        <div class="reference-snippet">${ref.snippet || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        responseContent.appendChild(referencesDiv);
        this.scrollToBottom();
        return referencesDiv;
    }

    appendToContainer(container, content) {
        if (container) {
            // 關閉回答中的轉圈
            const answerIndicator = container.closest('.answer-section')?.querySelector('.answer-indicator');
            if (answerIndicator) {
                answerIndicator.style.display = 'none';
            }
            container.innerHTML += this.escapeHtml(content);
            this.scrollToBottom();
        }
    }

    showSessionCode(responseDiv, code) {
        // 隱藏所有串流指示器
        const indicators = responseDiv.querySelectorAll('.fa-spin');
        indicators.forEach(indicator => {
            indicator.classList.remove('fa-spin');
            indicator.style.display = 'none';
        });

        const streamingIndicator = responseDiv.querySelector('.streaming-indicator');
        if (streamingIndicator) {
            streamingIndicator.innerHTML = '<i class="fas fa-check"></i><span>完成</span>';
        }

        if (!this.hasShownSessionId) {
            const responseContent = responseDiv.querySelector('.response-content');
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-code-section';
            sessionDiv.innerHTML = `
                <div class="session-code-header">
                    <i class="fas fa-id-card"></i>
                    <span>識別碼</span>
                </div>
                <div class="session-code-content">
                    <div class="session-code">${code}</div>
                    <div class="session-note">請記錄此識別碼，以便在問卷中提供</div>
                </div>
            `;
            
            responseContent.appendChild(sessionDiv);
            this.hasShownSessionId = true;
            this.scrollToBottom();
        }
    }

    showErrorInResponse(responseDiv, errorMessage) {
        const responseContent = responseDiv.querySelector('.response-content');
        
        // 隱藏串流指示器
        const streamingIndicator = responseDiv.querySelector('.streaming-indicator');
        if (streamingIndicator) {
            streamingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>錯誤</span>';
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-section';
        errorDiv.innerHTML = `
            <div class="section-header">
                <i class="fas fa-exclamation-triangle"></i>
                <span>錯誤</span>
            </div>
            <div class="error-content">
                ${this.escapeHtml(errorMessage)}
            </div>
        `;
        
        responseContent.appendChild(errorDiv);
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
                return cand.delta.parts
                    .map(p => (p && typeof p.text === 'string') ? p.text : '')
                    .filter(Boolean);
            }

            // 再嘗試 content（完整/分段）
            if (cand.content && Array.isArray(cand.content.parts)) {
                return cand.content.parts
                    .map(p => (p && typeof p.text === 'string') ? p.text : '')
                    .filter(Boolean);
            }

            // 有些情況 text 可能直接掛在 cand.text（備援）
            if (typeof cand.text === 'string' && cand.text) {
                return [cand.text];
            }

            return [];
        };

        const pieces = extractTexts();
        if (pieces.length === 0) {
            // 也許是 safety 標記、meta、或非文字增量，直接略過
            return false;
        }

        const answerContainer = ctx.ensureAnswerContainer();
        for (const t of pieces) {
            this.appendToContainer(answerContainer, t);
        }
        return true;
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
