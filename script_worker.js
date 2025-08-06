class ChatApp {
    constructor() {
        // 生成會話 ID
        this.sessionId = this.generateSessionId();
        
        // 跟蹤是否已顯示過識別碼
        this.hasShownSessionId = false;
        
        // 檢查是否需要顯示歡迎頁面
        this.showWelcomeModal();
        
        // 設定 Worker URL - 部署後請更新此 URL
        // 部署說明請參考 README_DEPLOYMENT.md
        this.workerUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev'; // 請替換為您的 Worker URL
        
        // 調試信息
        console.log('=== ChatApp 初始化 ===');
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
        return `session-${timestamp}-${randomStr}`;
    }

    generateSessionCode(data) {
        // 第一位：判斷是否來自例題
        let digit1 = '0'; // 預設不是例題
        const lastUserMessage = this.getLastUserMessage();
        if (lastUserMessage) {
            // 檢查是否是例題
            const exampleQuestions = [
                "如果我的車被別人騎走，但加滿油還回來了，我可以告他嗎？", // 例題1
                "鄰居的狗經常在夜間吠叫影響睡眠，我可以採取什麼法律行動？", // 例題2
                "我在網路上購買商品但收到假貨，賣家拒絕退款怎麼辦？" // 例題3
            ];
            
            for (let i = 0; i < exampleQuestions.length; i++) {
                if (lastUserMessage.includes(exampleQuestions[i]) || exampleQuestions[i].includes(lastUserMessage)) {
                    digit1 = (i + 1).toString();
                    break;
                }
            }
        }

        // 第二位：判斷是否開啟思考流程
        const digit2 = (this.showThinkingCheckbox.checked && data.thinking) ? '1' : '0';

        // 第三、四位：引用數量（00-99）
        const referenceCount = (data.references && data.references.length) ? data.references.length : 0;
        const digits34 = referenceCount.toString().padStart(2, '0');

        return digit1 + digit2 + digits34;
    }

    getLastUserMessage() {
        // 獲取最後一個用戶訊息
        const userMessages = this.chatContainer.querySelectorAll('.user-message');
        if (userMessages.length > 0) {
            const lastMessage = userMessages[userMessages.length - 1];
            const messageContent = lastMessage.querySelector('.user-text');
            return messageContent ? messageContent.textContent.trim() : '';
        }
        return '';
    }

    showWelcomeModal() {
        // 檢查是否已經顯示過歡迎頁面（可以使用 sessionStorage）
        const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
        
        if (!hasSeenWelcome) {
            const modal = document.getElementById('researchWelcomeModal');
            if (modal) {
                // 顯示模態框
                modal.style.display = 'flex';
                
                // 綁定開始按鈕事件
                const startButton = document.getElementById('startSystemBtn');
                if (startButton) {
                    startButton.addEventListener('click', () => {
                        this.hideWelcomeModal();
                    });
                }
                
                // 點擊背景關閉模態框
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.hideWelcomeModal();
                    }
                });
            }
        }
    }

    hideWelcomeModal() {
        const modal = document.getElementById('researchWelcomeModal');
        if (modal) {
            modal.classList.add('hidden');
            // 標記已經看過歡迎頁面
            sessionStorage.setItem('hasSeenWelcome', 'true');
            
            // 延遲移除以配合動畫
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    initializeElements() {
        // Checkbox elements
        this.showReferencesCheckbox = document.getElementById('showReferences');
        this.showThinkingCheckbox = document.getElementById('showThinking');
        this.enableSearchCheckbox = document.getElementById('enableSearch');
        
        // Main elements
        this.chatContainer = document.getElementById('chatContainer');
        this.questionInput = document.getElementById('questionInput');
        this.sendButton = document.getElementById('sendButton');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Settings panel elements
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsPanel = document.getElementById('settingsPanel');
        
        // 檢查關鍵元素是否存在
        const requiredElements = [
            'chatContainer', 'questionInput', 'sendButton', 'settingsToggle',
            'showReferencesCheckbox', 'showThinkingCheckbox'
        ];
        
        for (const elementName of requiredElements) {
            if (!this[elementName]) {
                console.error(`Required element not found: ${elementName}`);
                throw new Error(`無法找到必需的元素: ${elementName}`);
            }
        }
    }

    bindEvents() {
        // Settings panel toggle
        if (this.settingsToggle) {
            this.settingsToggle.addEventListener('click', () => {
                this.toggleSettingsPanel();
            });
        }

        // 選項變更事件
        if (this.showReferencesCheckbox) {
            this.showReferencesCheckbox.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        if (this.showThinkingCheckbox) {
            this.showThinkingCheckbox.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        if (this.enableSearchCheckbox) {
            this.enableSearchCheckbox.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        // 輸入框事件
        if (this.questionInput) {
            this.questionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.canSendMessage()) {
                        this.sendMessage();
                    }
                }
            });

            this.questionInput.addEventListener('input', () => {
                this.updateSendButtonState();
                this.autoResizeTextarea();
            });
        }

        // 發送按鈕事件
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                if (this.canSendMessage()) {
                    this.sendMessage();
                }
            });
        }

        // 快速問題按鈕事件
        document.querySelectorAll('.question-btn-compact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.questionInput.value = question;
                this.updateSendButtonState();
                this.autoResizeTextarea();
                // 移除自動發送，只填入輸入欄
            });
        });

        // 點擊設定面板外部時關閉
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.top-right-settings')) {
                this.hideSettingsPanel();
            }
        });

        // 防止設定面板內部點擊事件冒泡
        if (this.settingsPanel) {
            this.settingsPanel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    toggleSettingsPanel() {
        const isActive = this.settingsPanel.classList.contains('active');
        
        if (isActive) {
            this.hideSettingsPanel();
        } else {
            this.showSettingsPanel();
        }
    }

    showSettingsPanel() {
        this.settingsPanel.classList.add('active');
        this.settingsToggle.classList.add('active');
    }

    hideSettingsPanel() {
        this.settingsPanel.classList.remove('active');
        this.settingsToggle.classList.remove('active');
    }

    updateSendButtonState() {
        // 只檢查 Worker URL 和是否有問題輸入
        const hasQuestion = this.questionInput.value.trim().length > 0;
        
        this.sendButton.disabled = !(this.workerUrl && hasQuestion);
        
        if (!this.workerUrl) {
            this.sendButton.title = "使用 Worker 服務";
        } else if (!hasQuestion) {
            this.sendButton.title = "請輸入問題";
        } else {
            this.sendButton.title = "發送問題";
        }
    }

    canSendMessage() {
        if (!this.questionInput) return false;
        const hasQuestion = this.questionInput.value.trim().length > 0;
        return this.workerUrl && hasQuestion;
    }

    async sendMessage() {
        if (!this.canSendMessage()) return;

        const question = this.questionInput.value.trim();
        
        // 顯示載入中
        this.showLoading();
        
        // 添加用戶消息
        this.addUserMessage(question);
        
        // 清空輸入框
        this.questionInput.value = '';
        this.updateSendButtonState();
        this.autoResizeTextarea();

        try {
            let response;
            
            // 使用 Worker API
            if (this.workerUrl) {
                response = await this.callWorkerAPI(question);
            } else {
                throw new Error('沒有可用的 API 配置');
            }

            // 處理並顯示回應
            this.processAndDisplayResponse(response, question);
            
            // 隱藏載入中覆蓋層
            this.hideLoading();
            
        } catch (error) {
            this.hideLoading();
            console.error('API 調用錯誤:', error);
            this.addErrorMessage('發生錯誤: ' + error.message);
        }
    }

    // 調用 Cloudflare Worker API
    async callWorkerAPI(question) {
        if (!this.workerUrl || this.workerUrl.includes('your-worker-name')) {
            throw new Error('請先設定 Worker URL');
        }

        // 強制使用絕對 URL，直接硬編碼以避免任何 URL 解析問題
        const finalUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev';
        
        // 調試信息
        console.log('=== API 調用詳細信息 ===');
        console.log('原始 workerUrl:', this.workerUrl);
        console.log('強制使用的 URL:', finalUrl);
        console.log('當前頁面 URL:', window.location.href);
        console.log('URL 類型檢查 - startsWith https:', finalUrl.startsWith('https://'));

        // 根據前端設定構建請求體
        const requestBody = {
            question: question,
            enableSearch: this.enableSearchCheckbox ? this.enableSearchCheckbox.checked : true,
            showThinking: this.showThinkingCheckbox ? this.showThinkingCheckbox.checked : true
        };

        console.log('請求體:', JSON.stringify(requestBody, null, 2));

        // 使用 URL 構造函數確保絕對 URL
        let urlObj;
        try {
            urlObj = new URL(finalUrl);
            console.log('URL 對象創建成功:', urlObj.href);
        } catch (e) {
            console.error('URL 構造失敗:', e);
            throw new Error('無效的 Worker URL');
        }

        const response = await fetch(urlObj.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('收到回應，狀態:', response.status, response.statusText);
        console.log('實際請求的 URL:', response.url);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // 只嘗試讀取一次 response body - 克隆 response 以避免 stream 問題
            try {
                const responseClone = response.clone();
                const responseText = await responseClone.text();
                console.error('=== Worker API 錯誤詳細信息 ===');
                console.error('狀態碼:', response.status);
                console.error('狀態文字:', response.statusText);
                console.error('回應內容:', responseText);
                
                if (responseText) {
                    try {
                        const errorData = JSON.parse(responseText);
                        console.error('解析後的錯誤數據:', errorData);
                        errorMessage = errorData.error || errorData.message || errorMessage;
                        
                        // 如果有更詳細的錯誤信息，也要顯示
                        if (errorData.details) {
                            errorMessage += ` (詳細: ${errorData.details})`;
                        }
                        if (errorData.stack && this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                            console.error('錯誤堆疊:', errorData.stack);
                        }
                    } catch (parseError) {
                        console.error('無法解析錯誤 JSON:', parseError);
                        errorMessage = responseText || errorMessage;
                    }
                }
            } catch (readError) {
                console.warn('無法讀取錯誤回應內容:', readError);
            }
            
            throw new Error(`Worker API 錯誤: ${errorMessage}`);
        }

        return await response.json();
    }

    showSettingsPanel() {
        this.settingsPanel.classList.add('active');
        this.settingsToggle.classList.add('active');
    }

    hideSettingsPanel() {
        this.settingsPanel.classList.remove('active');
        this.settingsToggle.classList.remove('active');
    }

    autoResizeTextarea() {
        if (this.questionInput) {
            // 重置高度以獲得正確的 scrollHeight
            this.questionInput.style.height = 'auto';
            
            // 計算所需高度
            const minHeight = 24; // 最小高度（一行）
            const maxHeight = 120; // 最大高度
            const scrollHeight = this.questionInput.scrollHeight;
            
            // 設置新高度
            const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
            this.questionInput.style.height = newHeight + 'px';
        }
    }

    processAndDisplayResponse(response, originalQuestion) {
        // 檢查是否為雙重回應格式
        if (response.isDualMode) {
            console.log('=== 處理雙重回應模式 ===');
            console.log('搜索回應存在:', !!response.searchResponse);
            console.log('推理回應存在:', !!response.reasoningResponse);
            
            // 根據前端設定決定使用哪個回應作為主要內容
            let mainResponse = null;
            let thinkingSource = null;
            
            if (response.searchResponse && response.reasoningResponse) {
                // 兩個回應都存在，根據引用來源設定決定
                if (this.showReferencesCheckbox.checked) {
                    // 顯示引用：使用搜索回應作為主要內容
                    mainResponse = response.searchResponse;
                    // 優先使用推理回應的思考內容
                    thinkingSource = response.reasoningResponse;
                    console.log('✅ 使用搜索回應 + 推理思考內容');
                } else {
                    // 不顯示引用：使用推理回應作為主要內容
                    mainResponse = response.reasoningResponse;
                    // 將搜索的 grounding metadata 附加上去（雖然不顯示）
                    if (response.searchResponse.candidates?.[0]?.groundingMetadata) {
                        mainResponse.candidates[0].groundingMetadata = response.searchResponse.candidates[0].groundingMetadata;
                    }
                    thinkingSource = response.reasoningResponse;
                    console.log('✅ 使用推理回應 (隱藏引用)');
                }
            } else if (response.searchResponse) {
                mainResponse = response.searchResponse;
                thinkingSource = response.searchResponse;
                console.log('⚠️ 僅使用搜索回應');
            } else if (response.reasoningResponse) {
                mainResponse = response.reasoningResponse;
                thinkingSource = response.reasoningResponse;
                console.log('⚠️ 僅使用推理回應');
            } else {
                this.addErrorMessage('雙重 API 調用都失敗了');
                return;
            }
            
            // 提取思考內容
            this.extractAndEnhanceThinking(mainResponse, thinkingSource);
            
            // 使用主要回應進行顯示
            this.processSingleResponse(mainResponse, originalQuestion);
            
        } else {
            // 單一回應模式
            this.processSingleResponse(response, originalQuestion);
        }
    }

    processSingleResponse(response, originalQuestion) {
        if (!response.candidates || response.candidates.length === 0) {
            this.addErrorMessage('API 回應中沒有找到候選答案');
            return;
        }

        const candidate = response.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
            this.addErrorMessage('API 回應格式不正確');
            return;
        }

        // 調試輸出
        console.log('=== 處理 API 回應 ===');
        console.log('Candidate parts:', candidate.content.parts);
        console.log('Has enhancedThinkingContent:', !!candidate.enhancedThinkingContent);
        console.log('Has groundingMetadata:', !!candidate.groundingMetadata);

        // 提取回應內容
        let answerText = '';
        let thinkingText = '';

        // 從 parts 中提取內容
        candidate.content.parts.forEach((part, index) => {
            if (part.text) {
                console.log(`Part ${index}:`, {
                    length: part.text.length,
                    isThought: part.thought === true,
                    hasThinkingTag: part.text.includes('<thinking>'),
                    preview: part.text.substring(0, 100) + '...'
                });
                
                // 檢查是否為思考內容
                if (part.thought === true || part.text.includes('<thinking>')) {
                    thinkingText += part.text + '\n';
                } else {
                    answerText += part.text + '\n';
                }
            }
        });

        // 如果有 enhancedThinkingContent，優先使用它作為思考內容
        if (candidate.enhancedThinkingContent) {
            thinkingText = candidate.enhancedThinkingContent;
            console.log('使用 enhancedThinkingContent 作為思考內容');
        }

        // 如果沒有通過 part.thought 找到思考內容，嘗試從文本中提取
        if (!thinkingText && answerText.includes('<thinking>')) {
            console.log('嘗試從回答文本中提取思考內容...');
            const thinkingMatch = answerText.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (thinkingMatch) {
                thinkingText = thinkingMatch[1].trim();
                // 從回答中移除思考內容
                answerText = answerText.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
                console.log('成功提取思考內容:', thinkingText.length, '字元');
            }
        }

        // 提取引用來源
        let references = [];
        if (candidate.groundingMetadata) {
            references = this.extractReferences(candidate.groundingMetadata);
            console.log('提取到引用來源:', references.length, '個');
        }

        console.log('=== 最終提取結果 ===');
        console.log('Thinking 內容:', thinkingText ? thinkingText.substring(0, 200) + '...' : '無');
        console.log('Answer 內容:', answerText ? answerText.substring(0, 200) + '...' : '無');
        console.log('References 數量:', references.length);
        console.log('顯示思考流程:', this.showThinkingCheckbox.checked);
        console.log('顯示引用來源:', this.showReferencesCheckbox.checked);

        // 顯示回應
        this.addAIResponse({
            answer: answerText.trim() || '無法生成回應',
            thinking: thinkingText.trim(),
            references: references,
            groundingData: candidate.groundingMetadata,
            originalQuestion: originalQuestion
        });
    }

    extractAndEnhanceThinking(mainResponse, thinkingSource) {
        if (!mainResponse.candidates?.[0] || !thinkingSource.candidates?.[0]) return;
        
        const mainCandidate = mainResponse.candidates[0];
        const thinkingCandidate = thinkingSource.candidates[0];
        
        // 提取思考內容
        let thinkingContent = '';
        
        // 方法1: 檢查 part.thought 標記的內容
        if (thinkingCandidate.content && thinkingCandidate.content.parts) {
            thinkingCandidate.content.parts.forEach(part => {
                if (part.thought === true && part.text) {
                    thinkingContent += part.text + '\n';
                }
            });
        }
        
        // 方法2: 如果沒有找到 thought 標記的內容，尋找 <thinking> 標籤
        if (!thinkingContent && thinkingCandidate.content && thinkingCandidate.content.parts) {
            thinkingCandidate.content.parts.forEach(part => {
                if (part.text && part.text.includes('<thinking>')) {
                    thinkingContent += part.text + '\n';
                }
            });
        }
        
        // 將思考內容添加到主要回應中
        if (thinkingContent) {
            mainCandidate.enhancedThinkingContent = thinkingContent.trim();
            console.log('💭 已添加增強思考內容，長度:', thinkingContent.trim().length);
        }
    }

    extractReferences(groundingMetadata) {
        const references = [];
        const seenUrls = new Set();

        if (groundingMetadata.groundingSupports) {
            groundingMetadata.groundingSupports.forEach(support => {
                if (support.groundingChunkIndices && groundingMetadata.groundingChunks) {
                    support.groundingChunkIndices.forEach(index => {
                        const chunk = groundingMetadata.groundingChunks[index];
                        if (chunk && chunk.web) {
                            const url = chunk.web.uri;
                            const title = chunk.web.title || 'Untitled';
                            
                            if (url && !seenUrls.has(url)) {
                                seenUrls.add(url);
                                references.push({
                                    title: title,
                                    url: url,
                                    snippet: ''
                                });
                            }
                        }
                    });
                }
            });
        }

        return references;
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

    addAIResponse(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        let responseHtml = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-robot"></i>
                    <span class="message-label">AI 助手</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
        `;

        // 調試輸出
        console.log('=== 處理 API 回應 ===');
        console.log('Thinking 內容:', data.thinking ? data.thinking.substring(0, 200) + '...' : '無');
        console.log('Answer 內容:', data.answer ? data.answer.substring(0, 200) + '...' : '無');
        console.log('References 數量:', data.references ? data.references.length : 0);
        console.log('顯示思考流程:', this.showThinkingCheckbox.checked);
        console.log('顯示引用來源:', this.showReferencesCheckbox.checked);

        // 顯示思考流程（如果啟用且有內容）
        if (this.showThinkingCheckbox.checked && data.thinking) {
            responseHtml += `
                <div class="thinking-section">
                    <div class="thinking-header">
                        <i class="fas fa-brain"></i>
                        <span>思考流程</span>
                        <button class="toggle-thinking" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="thinking-content">
                        ${this.formatThinking(data.thinking)}
                    </div>
                </div>
            `;
        }

        // 主要回答內容
        responseHtml += `
            <div class="response-section">
                <div class="response-header">
                    <i class="fas fa-comment-alt"></i>
                    <span>回答</span>
                </div>
                <div class="response-content">
                    ${this.formatResponse(data.answer, data.groundingData)}
                </div>
            </div>
        `;

        // 顯示引用來源（如果啟用且有內容）
        if (this.showReferencesCheckbox.checked && data.references && data.references.length > 0) {
            responseHtml += `
                <div class="references-section">
                    <div class="references-header">
                        <i class="fas fa-link"></i>
                        <span>引用來源</span>
                        <button class="toggle-references" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="references-content">
                        ${this.formatReferences(data.references)}
                    </div>
                </div>
            `;
        }

        // 生成四位數識別碼並顯示
        const sessionCode = this.generateSessionCode(data);
        responseHtml += `
            <div class="session-code-section">
                <div class="session-code-display">
                    <i class="fas fa-id-card"></i>
                    <span class="code-label">識別碼：</span>
                    <span class="session-code-text">${sessionCode}</span>
                    <button class="copy-code-btn" onclick="window.chatApp.copySessionCode('${sessionCode}')" title="複製識別碼">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;

        responseHtml += `</div>`;
        messageDiv.innerHTML = responseHtml;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToMessage(messageDiv);
    }

    addErrorMessage(errorText) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="message-label">錯誤</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <div class="error-text">${this.escapeHtml(errorText)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
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

        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 處理數字列表
        formatted = formatted.replace(/(\d+)\.\s/g, '<strong>$1.</strong> ');
        
        // 處理項目符號列表
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        
        // 處理重要標題（以冒號結尾的行）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        return formatted;
    }

    formatResponse(response, groundingData = null) {
        if (!response) return '';
        
        // 移除任何 <thinking> 標籤（如果意外包含在回答中）
        let formatted = response.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
        
        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 處理粗體文字
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 處理斜體文字
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // 處理標題（以冒號結尾）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        // 處理數字列表
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');
        
        // 處理項目符號列表
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        
        // 處理引用註腳（如果有 grounding 數據且啟用引用）
        if (this.showReferencesCheckbox.checked && groundingData && groundingData.groundingSupports) {
            formatted = this.addFootnotes(formatted, groundingData.groundingSupports);
        }
        
        return formatted;
    }

    addFootnotes(text, groundingSupports) {
        if (!groundingSupports || groundingSupports.length === 0) return text;
        
        let annotatedText = text;
        let footnoteCounter = 1;
        
        // 處理每個 grounding support
        groundingSupports.forEach((support, index) => {
            if (support.segment && support.segment.text) {
                const segmentText = support.segment.text.trim();
                
                // 在文本中查找並替換匹配的段落
                // 使用更寬鬆的匹配策略，因為 API 返回的文本可能與原始回答略有不同
                const escapedSegment = this.escapeRegex(segmentText);
                const regex = new RegExp(`(${escapedSegment})`, 'gi');
                
                // 如果在文本中找到匹配，添加註腳
                if (regex.test(annotatedText)) {
                    annotatedText = annotatedText.replace(regex, `$1<sup class="footnote-ref" onclick="document.getElementById('ref-${footnoteCounter}')?.scrollIntoView({behavior: 'smooth', block: 'center'}); document.getElementById('ref-${footnoteCounter}')?.classList.add('highlight'); setTimeout(() => document.getElementById('ref-${footnoteCounter}')?.classList.remove('highlight'), 2000);">[${footnoteCounter}]</sup>`);
                    footnoteCounter++;
                }
            }
        });
        
        return annotatedText;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatReferences(references) {
        if (!references || references.length === 0) return '';
        
        return references.map((ref, index) => `
            <div class="reference-item" id="ref-${index + 1}">
                <div class="reference-number">${index + 1}</div>
                <div class="reference-details">
                    <a href="${ref.url}" target="_blank" rel="noopener noreferrer">
                        ${this.escapeHtml(ref.title)}
                    </a>
                    ${ref.snippet ? `<div class="reference-snippet">${this.escapeHtml(ref.snippet)}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString('zh-TW', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
    }

    scrollToMessage(messageElement) {
        setTimeout(() => {
            messageElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
        }, 100);
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
        this.loadingOverlay.style.opacity = '1';
        this.loadingOverlay.style.visibility = 'visible';
        this.sendButton.disabled = true;
    }

    hideLoading() {
        this.loadingOverlay.style.opacity = '0';
        this.loadingOverlay.style.visibility = 'hidden';
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none';
        }, 300);
        this.updateSendButtonState();
    }

    saveSettings() {
        const settings = {
            showReferences: this.showReferencesCheckbox.checked,
            showThinking: this.showThinkingCheckbox.checked,
            enableSearch: this.enableSearchCheckbox ? this.enableSearchCheckbox.checked : true
        };
        
        localStorage.setItem('aiQASettings', JSON.stringify(settings));
    }

    loadSavedSettings() {
        try {
            const savedSettings = localStorage.getItem('aiQASettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.showReferencesCheckbox.checked = settings.showReferences !== false;
                this.showThinkingCheckbox.checked = settings.showThinking !== false;
                
                if (this.enableSearchCheckbox) {
                    this.enableSearchCheckbox.checked = settings.enableSearch !== false;
                }
            }
        } catch (error) {
            console.error('載入設定時發生錯誤:', error);
        }
    }

    copySessionIdInChat() {
        const sessionId = this.sessionId;
        
        // 使用 Clipboard API 複製文字
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(sessionId).then(() => {
                this.showCopyFeedback();
            }).catch(err => {
                console.error('複製失敗:', err);
                this.fallbackCopyText(sessionId);
            });
        } else {
            // 備用複製方法
            this.fallbackCopyText(sessionId);
        }
    }

    copySessionCode(code) {
        // 使用 Clipboard API 複製識別碼
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(code).then(() => {
                this.showCodeCopyFeedback();
            }).catch(err => {
                console.error('複製失敗:', err);
                this.fallbackCopyText(code);
            });
        } else {
            // 備用複製方法
            this.fallbackCopyText(code);
        }
    }

    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback();
        } catch (err) {
            console.error('複製失敗:', err);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showCopyFeedback() {
        // 顯示複製成功的反饋
        const button = document.querySelector('.copy-session-btn');
        if (button) {
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.style.color = '#4caf50';
            
            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.style.color = '';
            }, 2000);
        }
        
        // 也可以顯示 toast 消息
        console.log('✅ 識別碼已複製到剪貼板');
    }

    showCodeCopyFeedback() {
        // 顯示識別碼複製成功的反饋
        const button = document.querySelector('.copy-code-btn');
        if (button) {
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.style.backgroundColor = '#4caf50';
            
            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.style.backgroundColor = '';
            }, 2000);
        }
        
        console.log('✅ 識別碼已複製到剪貼板');
    }
}

// 確保DOM完全加載後再初始化應用
function initializeApp() {
    try {
        console.log('正在初始化ChatApp...');
        window.chatApp = new ChatApp();
        console.log('ChatApp初始化成功');
    } catch (error) {
        console.error('ChatApp初始化失敗:', error);
        // 延遲重試
        setTimeout(() => {
            console.log('嘗試重新初始化ChatApp...');
            try {
                window.chatApp = new ChatApp();
                console.log('ChatApp重新初始化成功');
            } catch (retryError) {
                console.error('ChatApp重新初始化也失敗:', retryError);
                alert('應用程式初始化失敗，請重新整理頁面。');
            }
        }, 1000);
    }
}

// 多種方式確保初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
    // DOM已經加載完成
    setTimeout(initializeApp, 100);
} else {
    // 備用方案
    window.addEventListener('load', initializeApp);
}
