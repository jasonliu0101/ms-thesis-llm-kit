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
        
        // 翻譯隊列管理 - Case C 專用
        this.translationQueue = [];
        this.isProcessingTranslation = false;
        this.nextTranslationTime = 0; // 下次翻譯的時間戳
        
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
        // 第一位：判斷是否來自例題或虛擬引用
        let digit1 = '0'; // 預設不是例題
        const currentQuestion = data.originalQuestion || '';
        const currentPage = window.location.pathname.split('/').pop() || '';
        
        // 檢查是否為 Case E 或 Case F 的虛擬引用情況
        if ((currentPage === 'case-e.html' || currentPage === 'case-f.html') && data.references && data.references.length > 0) {
            // 檢查是否有虛擬引用標記（透過明確的虛擬引用標記來判斷）
            const hasVirtualReferences = data.references.some(ref => 
                ref.virtual === true || 
                ref.isVirtual === true || 
                ref.type === 'virtual' ||
                (ref.source && ref.source.includes('virtual')) ||
                (ref.category && typeof ref.category === 'string') // 虛擬引用會有類別分類
            );
            
            if (hasVirtualReferences && currentQuestion && this.selectedExampleQuestion) {
                if (currentQuestion === this.selectedExampleQuestion) {
                    const exampleQuestions = [
                        "如果我的車被別人騎走，但加滿油還回來了，我可以告他嗎？",
                        "鄰居的狗經常在夜間吠叫影響睡眠，我可以採取什麼法律行動？",
                        "我在網路上購買商品但收到假貨，賣家拒絕退款怎麼辦？"
                    ];
                    
                    for (let i = 0; i < exampleQuestions.length; i++) {
                        if (currentQuestion === exampleQuestions[i]) {
                            // Case E/F 虛擬引用情況下：第一題→4，第二題→5，第三題→6
                            digit1 = (i + 4).toString();
                            console.log(`🎯 [${currentPage === 'case-e.html' ? 'Case E' : 'Case F'}] 虛擬引用題目 ${i+1} 識別碼第一位設為: ${digit1}`);
                            break;
                        }
                    }
                }
            } else {
                // Case E/F 但沒有虛擬引用標記 → 使用一般識別碼 (1-3)
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
                                console.log(`🎯 [${currentPage === 'case-e.html' ? 'Case E' : 'Case F'}] 真實引用題目 ${i+1} 識別碼第一位設為: ${digit1}`);
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            // 一般情況：Case C/D 或沒有引用數據的 Case E/F
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
        }

        // 第二位：2表示為版本標識
        const digit2 = '2';

        // 第三位：根據 Case 類型強制設定
        const currentPath = window.location.pathname;
        let digit3;
        if (currentPath.includes('case-c.html') || currentPath.includes('case-e.html')) {
            digit3 = '1'; // Case C 和 Case E 強制為 1
        } else if (currentPath.includes('case-d.html') || currentPath.includes('case-f.html')) {
            digit3 = '0'; // Case D 和 Case F 強制為 0
        } else {
            // 其他情況保持原有邏輯
            digit3 = (this.showThinkingCheckbox && this.showThinkingCheckbox.checked && data.thinking) ? '1' : '0';
        }

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
                // 實現 10 秒倒數計時器
                let countdown = 10;
                startButton.disabled = true;
                startButton.classList.add('disabled');
                
                const updateCountdown = () => {
                    if (countdown > 0) {
                        startBtnText.textContent = `請先閱讀說明 (${countdown}秒)`;
                        countdown--;
                        setTimeout(updateCountdown, 1000);
                    } else {
                        // 倒數結束，啟用按鈕
                        startBtnText.textContent = '開始使用系統';
                        startButton.disabled = false;
                        startButton.classList.remove('disabled');
                        
                        // 更改圖標為 play
                        const icon = startButton.querySelector('i');
                        if (icon) {
                            icon.className = 'fas fa-play';
                        }
                    }
                };
                
                // 開始倒數
                updateCountdown();

                startButton.addEventListener('click', () => {
                    if (!startButton.disabled) {
                        modal.style.display = 'none';
                        console.log('✅ 開始使用系統');
                    }
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
        
        // 重置翻譯隊列時間 - Case C 專用
        this.nextTranslationTime = Date.now();
        
        this.updateSendButtonState();

        // 顯示用戶消息（只顯示一次）
        this.addUserMessage(question);

        // 清空輸入框
        this.questionInput.value = '';
        this.autoResizeTextarea();

        let responseDiv = null;
        let retryCount = 0;
        const maxRetries = 1; // 最多重試1次

        while (retryCount <= maxRetries) {
            try {
                console.log(`🔄 開始處理問題 (嘗試 ${retryCount + 1}/${maxRetries + 1})`);
                responseDiv = await this.startStreamingResponse(question);
                
                // 檢查是否出現"沒有符合顯示條件的回答內容"錯誤
                const answerContainer = responseDiv.querySelector('.answer-section, .response-section .response-content');
                if (answerContainer && answerContainer.innerHTML.includes('沒有符合顯示條件的回答內容')) {
                    if (retryCount < maxRetries) {
                        console.log('⚠️ 檢測到無內容錯誤，自動重試...');
                        retryCount++;
                        // 移除之前的錯誤響應
                        if (responseDiv && responseDiv.parentNode) {
                            responseDiv.parentNode.removeChild(responseDiv);
                        }
                        continue; // 重試
                    } else {
                        console.log('❌ 重試次數已達上限，顯示系統錯誤');
                        // 替換錯誤訊息
                        answerContainer.innerHTML = '<div class="error-message">系統處理發生錯誤，請重新整理頁面後再試。</div>';
                        break;
                    }
                } else {
                    console.log('✅ 響應成功，無需重試');
                    break; // 成功，跳出循環
                }
                
            } catch (error) {
                console.error('回應錯誤:', error);
                
                // 檢查是否為特定的 API 錯誤，需要重試
                const isApiError = this.isRetryableApiError(error);
                
                if (isApiError && retryCount < maxRetries) {
                    console.log('⚠️ 檢測到可重試的 API 錯誤，自動重試...');
                    retryCount++;
                    continue; // 重試
                } else {
                    console.log('❌ 非重試錯誤或重試次數已達上限，顯示錯誤訊息');
                    this.addErrorMessage('抱歉，發生了錯誤，請重新送出問題！（此為系統錯誤，不須納入問卷填答時的評價考量）');
                    break;
                }
            }
        }

        // 最終清理
        this.isStreaming = false;
        this.updateSendButtonState();
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

    // Case D: 純串流模式，過濾英文思考內容，只顯示中文回答
    async startCaseDStreamingResponse(question) {
        // 創建 AI 回應容器
        const responseDiv = this.createResponseContainer();
        
        try {
            console.log('🎯 開始 Case D 純串流模式（過濾英文思考內容）...');
            
            // 創建答案容器
            const answerContainer = this.createAnswerContainer(responseDiv);
            
            // [Case D] 初始顯示 Loading 狀態
            this.showAnswerProcessing(answerContainer);
            console.log('⏳ [Case D] 顯示初始 Loading 狀態');
            
            // 追蹤是否已有內容顯示
            let hasDisplayedContent = false;
            
            // 初始化引用數據存儲
            let collectedReferences = [];
            
            // 新增：追蹤是否已偵測到參考來源區塊
            let referenceSectionDetected = false;
            
            const response = await fetch(`${this.workerUrl}/stream-gemini`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: true,  // 啟用搜尋
                    showThinking: false,  // 關閉思考以快速獲得答案
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Stream API error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') continue;

                    try {
                        const payload = JSON.parse(dataStr);
                        
                        // [Case D] 收集引用數據
                        if (payload.references && Array.isArray(payload.references)) {
                            collectedReferences = payload.references;
                            console.log('📚 [Case D] 收集到引用數據:', collectedReferences.length);
                        }
                        
                        // 處理各種可能的內容格式
                        let content = null;
                        
                        // 檢查標準格式
                        if (payload.type === 'thinking_chunk' || payload.type === 'answer_chunk') {
                            content = payload.content;
                        }
                        // 檢查 Gemini 標準格式
                        else if (payload.candidates && payload.candidates[0]) {
                            const candidate = payload.candidates[0];
                            if (candidate.content && candidate.content.parts) {
                                const textParts = candidate.content.parts.filter(part => part.text);
                                if (textParts.length > 0) {
                                    content = textParts[textParts.length - 1].text;
                                }
                            }
                        }
                        // 其他可能格式
                        else if (payload.content && typeof payload.content === 'string') {
                            content = payload.content;
                        }
                        else if (payload.thinking) {
                            content = payload.thinking;
                        }

                        if (content && content.trim()) {
                            // 檢查是否包含參考來源標記
                            if (!referenceSectionDetected && this.containsReferenceKeywords(content)) {
                                console.log('🚫 [Case D] 偵測到參考來源區塊，停止顯示後續內容');
                                referenceSectionDetected = true;
                                // 不顯示包含參考來源的這個 chunk，也不顯示後續任何內容
                                continue;
                            }
                            
                            // 如果已經偵測到參考來源區塊，跳過所有後續內容
                            if (referenceSectionDetected) {
                                console.log('🚫 [Case D] 跳過參考來源區塊後的內容:', content.substring(0, 30) + '...');
                                continue;
                            }
                            
                            // 語言檢測：只顯示非英文內容
                            const isEnglish = await this.isEnglishContent(content);
                            
                            if (!isEnglish) {
                                console.log('✅ 顯示非英文內容:', content.substring(0, 50) + '...');
                                
                                // [Case D] 第一次顯示內容時清除 Loading 狀態
                                if (!hasDisplayedContent) {
                                    answerContainer.innerHTML = ''; // 清除 Loading 狀態
                                    hasDisplayedContent = true;
                                    console.log('🧹 [Case D] 清除 Loading 狀態，開始顯示內容');
                                }
                                
                                // [Case D] 清理參考來源字樣（與 Case C 一致）
                                const cleanedContent = this.cleanReferenceListFromText(content);
                                
                                // 直接顯示內容（不翻譯，因為已經是中文）
                                const formattedContent = this.formatResponseChunk(cleanedContent);
                                answerContainer.innerHTML += formattedContent;
                                this.scrollToBottom();
                            } else {
                                console.log('🚫 過濾英文思考內容:', content.substring(0, 50) + '...');
                            }
                        }
                        
                    } catch (e) {
                        console.warn('解析 Case D stream event 失敗：', e, dataStr);
                    }
                }
            }

            reader.releaseLock();
            console.log('✅ Case D 串流處理完成');
            
            // [Case D] 如果整個串流過程中都沒有顯示任何內容，清除 Loading 狀態
            if (!hasDisplayedContent) {
                answerContainer.innerHTML = '<div class="no-content-message">沒有符合顯示條件的回答內容</div>';
                console.log('⚠️ [Case D] 整個串流過程中沒有顯示任何內容，顯示無內容消息');
            }
            
            // [Case D] 處理引用數據（採用 Case C 的邏輯）
            console.log('📚 [Case D] 開始處理引用數據，數量:', collectedReferences.length);
            
            // 存儲引用數據到 responseDiv，供識別碼生成使用
            responseDiv.dataset.references = JSON.stringify(collectedReferences);
            responseDiv.dataset.thinking = JSON.stringify(null); // Case D 沒有思考過程
            
            if (collectedReferences.length > 0) {
                console.log('💾 [Case D] 已存儲引用數據到responseDiv');
                
                // 檢查是否應該顯示引用來源（≥10個才顯示）
                if (collectedReferences.length >= 10) {
                    console.log('✅ [Case D] 使用緊湊格式顯示引用區塊');
                    this.displayEnhancedReferences(collectedReferences, responseDiv, 0); // 0 表示沒有虛擬引用
                } else {
                    console.log('❌ [Case D] 引用來源數量 < 10，不顯示引用區塊，但已存儲數據供識別碼使用');
                }
            } else {
                console.log('📚 [Case D] 沒有引用來源');
                // 即使沒有引用來源，也存儲空數組
                responseDiv.dataset.references = JSON.stringify([]);
            }
            
            // [Case D] 最終清理：移除可能遺漏的參考來源字樣
            const finalAnswerContainer = responseDiv.querySelector('.response-section .response-content');
            if (finalAnswerContainer && finalAnswerContainer.innerHTML) {
                // 將 HTML 轉回文字進行清理，然後重新格式化
                const currentText = finalAnswerContainer.innerText || finalAnswerContainer.textContent || '';
                const cleanedText = this.cleanReferenceListFromText(currentText);
                const finalFormattedText = this.formatResponseChunk(cleanedText);
                finalAnswerContainer.innerHTML = finalFormattedText;
                console.log('🧹 [Case D] 已完成最終參考來源清理');
            }
            
            // 顯示識別碼
            this.showFinalSessionCode(responseDiv, question);
            
        } catch (error) {
            console.error('Case D 串流錯誤:', error);
            
            // 錯誤處理
            const answerContainer = responseDiv.querySelector('.response-section .response-content');
            if (answerContainer) {
                answerContainer.innerHTML = `<div class="error-message">串流處理發生錯誤: ${error.message}</div>`;
            }
            
            throw error;
        }
    }

    async startStreamingResponse(question) {
        // 根據當前頁面決定使用哪種處理方式
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('case-d.html')) {
            console.log('🎯 檢測到 Case D 頁面，使用 Case D 串流模式');
            return await this.startCaseDStreamingResponse(question);
        } else if (currentPath.includes('case-e.html')) {
            console.log('🎯 檢測到 Case E 頁面，使用 Case C 模式（介面照抄 Case C）+ 虛擬引用增強');
            return await this.startCaseCStreamingResponseWithVirtualReferences(question);
        } else if (currentPath.includes('case-f.html')) {
            console.log('🎯 檢測到 Case F 頁面，使用 Case D 模式（介面照抄 Case D）+ 虛擬引用增強');
            return await this.startCaseDStreamingResponseWithVirtualReferences(question);
        } else {
            console.log('🧠 預設使用 Case C 混合模式');
            return await this.startCaseCStreamingResponse(question);
        }
    }

    async startCaseCStreamingResponse(question) {
        // 創建 AI 回應容器
        const responseDiv = this.createResponseContainer();
        
        try {
            // === Case C 混合模式：併發執行請求，智能顯示結果 ===
            console.log('🧠 開始 Case C 混合模式（併發請求，智能顯示）...');
            
            // 創建答案狀態追蹤
            let answerData = null;
            let thinkingEnded = false;
            let answerDisplayed = false;
            
            // 併發執行兩個階段的請求
            const answerPromise = this.processAnswerPhaseBackground(question, responseDiv)
                .then(async data => {
                    console.log('📋 答案數據已準備就緒');
                    answerData = data;
                    // 如果思考已結束且答案還未顯示，立即顯示答案
                    if (thinkingEnded && !answerDisplayed) {
                        console.log('⚡ 思考已結束，立即顯示答案（跳過處理中狀態）');
                        answerDisplayed = true;
                        
                        // 確保答案容器存在
                        let answerContainer = responseDiv.querySelector('.response-section');
                        if (!answerContainer) {
                            answerContainer = this.createAnswerContainer(responseDiv);
                        }
                        
                        await this.displayAnswerResult(responseDiv, answerData, question);
                        // 答案顯示完成後顯示識別碼
                        console.log('🏷️ 答案顯示完成，顯示識別碼');
                        this.showFinalSessionCode(responseDiv, question);
                        return data;
                    }
                    return data;
                })
                .catch(error => {
                    console.error('❌ 答案階段失敗:', error);
                    throw error;
                });
            
            const thinkingPromise = this.processThinkingPhase(question, responseDiv, async () => {
                console.log('🎯 思考 chunk 結束回調');
                thinkingEnded = true;
                
                // 思考 chunk 結束，但不立即創建答案容器
                // 等待所有翻譯完成後再創建答案容器
                console.log('⏳ 思考 chunk 結束，等待翻譯完成...');
                
                // 如果答案數據已準備好且還未顯示，記錄但不立即顯示
                if (answerData && !answerDisplayed) {
                    console.log('📋 答案數據已準備，等待翻譯完成後顯示');
                }
            });
            
            // 等待思考階段完成（包括所有翻譯完成）
            await thinkingPromise;
            console.log('✅ 思考階段完全完成，包括所有翻譯');
            
            // 存儲思考數據到responseDiv，供識別碼生成使用
            responseDiv.dataset.thinking = JSON.stringify(true); // Case C 有思考過程
            
            // 檢查答案是否已經顯示了
            if (answerDisplayed) {
                console.log('✅ 答案已經顯示完成，無需進一步處理');
                return responseDiv;
            }
            
            // 創建答案容器（如果還沒有的話）
            let answerContainer = responseDiv.querySelector('.response-section');
            if (!answerContainer) {
                answerContainer = this.createAnswerContainer(responseDiv);
            }
            
            // 檢查答案是否已準備好但還沒顯示
            if (answerData && !answerDisplayed) {
                console.log('⚡ 答案已準備，立即顯示（不顯示處理中狀態）');
                answerDisplayed = true;
                await this.displayAnswerResult(responseDiv, answerData, question);
                // 答案顯示完成後顯示識別碼
                console.log('🏷️ 答案顯示完成，顯示識別碼');
                this.showFinalSessionCode(responseDiv, question);
            } else if (!answerDisplayed) {
                // 答案還沒準備好，顯示處理中狀態作為 buffer
                console.log('⏳ 答案尚未準備，顯示處理中狀態');
                this.showAnswerProcessing(answerContainer);
                
                // 等待答案完成後顯示
                console.log('⏳ 等待答案完成...');
                answerData = await answerPromise;
                if (!answerDisplayed) {
                    answerDisplayed = true;
                    await this.displayAnswerResult(responseDiv, answerData, question);
                    // 答案顯示完成後顯示識別碼
                    console.log('🏷️ 答案顯示完成，顯示識別碼');
                    this.showFinalSessionCode(responseDiv, question);
                }
            }
            
        } catch (error) {
            console.error('混合模式處理錯誤:', error);
            
            // 確保即使在錯誤情況下，responseDiv 也有基本的引用數據存儲
            if (responseDiv) {
                responseDiv.dataset.references = JSON.stringify([]);
                console.log('💾 錯誤情況下存儲空引用數組（混合模式）');
            }
            
            this.showErrorInResponse(responseDiv, error.message);
        }
        
        return responseDiv;
    }

    // 新增：處理 Thinking 階段的串流
    async processThinkingPhase(question, responseDiv, onThinkingChunkEnd = null) {
        // 用於存儲 answer_chunk 內容的變數
        responseDiv.dataset.answerChunks = JSON.stringify([]);
        let answerChunks = [];
        
        try {
            const response = await fetch(`${this.workerUrl}/stream-gemini`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: false,  // Thinking 階段：不使用搜尋
                    showThinking: true,   // 強制顯示 thinking
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Thinking API error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buf = '';
            let doneAll = false;
            let thinkingContainer = null;

            console.log('🎬 開始處理 Thinking 串流...');

            // 建立一個 ctx，交給 handleGeminiPayload 使用
            const ctx = {
                showThinking: true,
                ensureAnswerContainer: () => null,          // 思考階段不生成答案容器
                onThinkingEnd: () => {                      // 可選：關掉指示器
                    const ind = responseDiv.querySelector('.streaming-indicator');
                    if (ind) ind.style.display = 'none';
                },
                onThinkingContent: async (rawText) => {
                    // 移除詳細的思考內容日誌
                    
                    if (!thinkingContainer) {
                        thinkingContainer = this.createThinkingContainer(responseDiv);
                    }
                    const contentDiv = thinkingContainer.querySelector('.thinking-content');
                    if (!contentDiv) return;

                    // 翻譯思考內容
                    try {
                        const translatedText = await this.translateWithQueue(rawText);
                        // 處理 Markdown 格式並轉換為 HTML
                        const formattedContent = this.formatMarkdown(translatedText);
                        contentDiv.innerHTML += formattedContent;
                        this.scrollToBottom();
                        // Case C 思考流程：翻譯已經包含延遲，不需要額外等待
                    } catch (e) {
                        console.warn('翻譯思考內容失敗:', e);
                        // 如果翻譯失敗，直接顯示原文
                        const formattedContent = this.formatMarkdown(rawText);
                        contentDiv.innerHTML += formattedContent;
                        this.scrollToBottom();
                        // Case C 思考流程：翻譯失敗時也需要延遲2秒保持節奏
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                },
                onThinkingEnd: async () => {
                    console.log('🔚 思考階段結束，隱藏串流指示器');
                    const ind = responseDiv.querySelector('.streaming-indicator');
                    if (ind) ind.style.display = 'none';
                    
                    // 調用外部回調（如果提供）
                    if (onThinkingChunkEnd) {
                        console.log('🎯 調用思考 chunk 結束回調');
                        await onThinkingChunkEnd();
                    }
                },
                // 忽略答案階段 - 答案內容將被隱藏
                onAnswerStart: () => {
                    console.log('📝 答案階段開始 - 但將隱藏答案內容');
                    return null; // 不創建答案容器
                },
                onAnswerContent: () => {
                    // 完全忽略答案內容
                    console.log('🙈 隱藏答案內容');
                }
            };

            // 讀取 SSE
            while (!doneAll) {
                const { done, value } = await reader.read();
                if (done) break;

                buf += decoder.decode(value, { stream: true });

                // 以 \n\n 分割 SSE 事件（相容 CRLF）
                let idx;
                while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
                    const rawEvent = buf.slice(0, idx);
                    buf = buf.slice(idx + (buf.slice(idx, idx + 2) === '\r\n' ? 4 : 2));

                    // 解析 event 的 data 行
                    const dataLines = rawEvent
                        .split(/\r?\n/)
                        .filter(l => l.startsWith('data:'))
                        .map(l => l.replace(/^data:\s?/, ''));

                    if (dataLines.length === 0) continue;

                    for (const dataStr of dataLines) {
                        // 移除 thinking 原始回應日誌
                        
                        if (dataStr === '[DONE]') {
                            doneAll = true;
                            console.log('✅ Thinking 階段完成');
                            break;
                        }

                        // 嘗試多種 payload 格式
                        try {
                            const payload = JSON.parse(dataStr);

                            // ① 自訂格式處理
                            if (payload.type === 'thinking_chunk' && payload.content) {
                                // 移除 thinking_chunk 詳細日誌
                                ctx.onThinkingContent(payload.content);
                                continue;
                            }
                            
                            if (payload.type === 'thinking_end') {
                                console.log('🔚 收到 thinking_end');
                                ctx.onThinkingEnd();
                                continue;
                            }
                            
                            // 收集答案階段的內容作為備用方案
                            if (payload.type === 'answer_start' || payload.type === 'answer_chunk') {
                                console.log('� 收集答案內容作為備用方案:', payload.type);
                                // 儲存 answer_chunk 內容
                                if (payload.type === 'answer_chunk' && payload.content) {
                                    answerChunks.push(payload.content);
                                    responseDiv.dataset.answerChunks = JSON.stringify(answerChunks);
                                    console.log('📥 已收集 answer_chunk 內容，目前數量:', answerChunks.length);
                                }
                                continue;
                            }

                            // ② Gemini 標準/近標準：交給既有解析器
                            const consumed = this.handleGeminiPayload && this.handleGeminiPayload(payload, ctx);
                            if (consumed) continue;

                            // ③ 其他可能格式的備援欄位
                            if (payload.thinking) {
                                // 移除 thinking 欄位詳細日誌
                                ctx.onThinkingContent(payload.thinking);
                            } else if (payload.content && typeof payload.content === 'string') {
                                // 移除 content 欄位詳細日誌
                                ctx.onThinkingContent(payload.content);
                            }
                        } catch (e) {
                            console.warn('解析 thinking event 失敗：', e, dataStr);
                        }
                    }
                }
            }

            reader.releaseLock();
            console.log('✅ Thinking 階段處理完成');
            
        } catch (error) {
            console.error('Thinking 階段錯誤:', error);
            throw error;
        }
    }

    // 新增：處理 Answer 階段的完整回應
    async processAnswerPhase(question, responseDiv) {
        let answerContainer = null;
        
        try {
            console.log('📞 呼叫 Answer API（使用搜尋）...');
            
            // 創建 Answer 容器並顯示處理中狀態（思考完成後立即顯示）
            answerContainer = this.createAnswerContainer(responseDiv);
            this.showAnswerProcessing(answerContainer);
            
            const response = await fetch(`${this.workerUrl}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: true,  // Answer 階段：使用搜尋
                    showThinking: true
                })
            });

            if (!response.ok) {
                throw new Error(`Answer API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            // 移除詳細數據結構日誌

            // 清除處理中狀態
            this.clearAnswerProcessing(answerContainer);

            // 解析回應內容 - 處理 Gemini API 的標準格式
            let answerText = null;
            let references = [];
            
            if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];
                
                // 提取答案文本（排除思考內容）
                if (candidate.content && candidate.content.parts) {
                    const nonThoughtParts = candidate.content.parts.filter(part => 
                        part.text && part.thought !== true
                    );
                    if (nonThoughtParts.length > 0) {
                        // 取最後一個非思考部分作為答案
                        answerText = nonThoughtParts[nonThoughtParts.length - 1].text;
                        console.log('💬 提取到答案文本，長度:', answerText.length);
                    }
                }
                
                // 提取引用來源
                if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
                    references = candidate.groundingMetadata.groundingChunks.map(chunk => ({
                        title: chunk.web?.title || '未知來源',
                        uri: chunk.web?.uri || '#',
                        snippet: chunk.content || ''
                    }));
                    console.log('🔗 [Case C] 提取到引用來源:', references.length, '個');
                }
            }

            // 顯示答案內容
            if (answerText) {
                // 翻譯並顯示答案
                const translatedAnswer = await this.translateWithQueue(answerText);
                const cleanedAnswer = this.cleanCompleteText(translatedAnswer);
                const formattedAnswer = this.formatResponseChunk(cleanedAnswer);
                answerContainer.innerHTML = formattedAnswer;
                
                // 處理引用來源
                if (references && references.length > 0) {
                    console.log('📚 [Case C] 處理引用來源:', references.length, '個');
                    
                    // 將引用數據存儲到responseDiv中，供後續識別碼使用
                    responseDiv.dataset.references = JSON.stringify(references);
                    console.log('💾 已存儲引用數據到responseDiv');
                    
                    // 檢查是否應該顯示引用來源（≥10個才顯示）
                    if (references.length >= 10) {
                        console.log('✅ [Case C] 使用緊湊格式顯示引用區塊');
                        this.displayEnhancedReferences(references, responseDiv, 0); // 0 表示沒有虛擬引用
                    } else {
                        console.log('❌ [Case C] 引用來源數量 < 10，不顯示引用區塊，但已存儲數據供識別碼使用');
                    }
                } else {
                    console.log('📚 [Case C] 沒有引用來源');
                    // 即使沒有引用來源，也存儲空數組
                    responseDiv.dataset.references = JSON.stringify([]);
                }
                
                // 答案和引用來源處理完成，稍後在流程結束時顯示識別碼
                
                this.scrollToBottom();
            } else {
                console.warn('⚠️ 沒有找到答案文本');
                answerContainer.innerHTML = '<div class="error-message">未能取得完整回應內容</div>';
            }
            
        } catch (error) {
            console.error('Answer 階段錯誤:', error);
            
            if (answerContainer) {
                this.clearAnswerProcessing(answerContainer);
                answerContainer.innerHTML = `<div class="error-message">答案階段發生錯誤: ${error.message}</div>`;
            }
            
            // 即使發生錯誤，也要確保存儲空的引用數組，以便識別碼能正常顯示
            if (responseDiv) {
                responseDiv.dataset.references = JSON.stringify([]);
                console.log('💾 錯誤情況下存儲空引用數組');
            }
            
            throw error;
        }
    }

    // 新增：背景執行答案階段（不顯示處理狀態）
    async processAnswerPhaseBackground(question, responseDiv) {
        try {
            console.log('🔄 背景執行 Answer API（使用搜尋）...');
            
            const response = await fetch(`${this.workerUrl}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    enableSearch: true,  // Answer 階段：使用搜尋
                    showThinking: true
                })
            });

            if (!response.ok) {
                // 如果是 500 錯誤，嘗試使用收集的 answer_chunk
                if (response.status === 500) {
                    console.warn('⚠️ Answer API 返回 500 錯誤，嘗試使用備用方案');
                    
                    // 檢查是否有收集到 answer_chunk
                    let answerChunks = [];
                    try {
                        answerChunks = JSON.parse(responseDiv.dataset.answerChunks || '[]');
                    } catch (e) {
                        console.error('解析 answerChunks 失敗:', e);
                    }
                    
                    if (answerChunks.length > 0) {
                        console.log('🛟 使用收集到的 answer_chunk 作為備用答案');
                        // 組合所有 answer_chunk 內容作為最終答案
                        const fallbackAnswerText = answerChunks.join('');
                        
                        return {
                            answerText: fallbackAnswerText,
                            references: [],  // 備用答案沒有引用來源
                            question,
                            isFallback: true  // 標記為備用答案
                        };
                    }
                }
                
                throw new Error(`Answer API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            // 移除詳細數據結構日誌

            // 解析回應內容但不顯示
            let answerText = null;
            let references = [];
            
            if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];
                
                // 提取答案文本（排除思考內容）
                if (candidate.content && candidate.content.parts) {
                    const nonThoughtParts = candidate.content.parts.filter(part => 
                        part.text && part.thought !== true
                    );
                    if (nonThoughtParts.length > 0) {
                        answerText = nonThoughtParts[nonThoughtParts.length - 1].text;
                        console.log('💬 背景提取到答案文本，長度:', answerText.length);
                    }
                }
                
                // 提取引用來源
                if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
                    references = candidate.groundingMetadata.groundingChunks.map(chunk => ({
                        title: chunk.web?.title || '未知來源',
                        uri: chunk.web?.uri || '#',
                        snippet: chunk.content || ''
                    }));
                    console.log('🔗 [Case C] 背景提取到引用來源:', references.length, '個');
                }
            }

            // 返回處理好的數據，不顯示
            return {
                answerText,
                references,
                question
            };
            
        } catch (error) {
            console.error('背景 Answer 階段錯誤:', error);
            
            // 如果發生任何錯誤，嘗試使用收集的 answer_chunk
            let answerChunks = [];
            try {
                answerChunks = JSON.parse(responseDiv.dataset.answerChunks || '[]');
            } catch (e) {
                console.error('解析 answerChunks 失敗:', e);
            }
            
            if (answerChunks.length > 0) {
                console.log('🛟 使用收集到的 answer_chunk 作為備用答案（錯誤後備用）');
                // 組合所有 answer_chunk 內容作為最終答案
                const fallbackAnswerText = answerChunks.join('');
                
                return {
                    answerText: fallbackAnswerText,
                    references: [],  // 備用答案沒有引用來源
                    question,
                    isFallback: true  // 標記為備用答案
                };
            }
            
            throw error;
        }
    }

    // 新增：顯示答案結果（在思考完成後）
    async displayAnswerResult(responseDiv, answerData, question) {
        let answerContainer = null;
        
        try {
            const { answerText, references, isFallback } = answerData;
            
            // 尋找已存在的答案容器（應該在 onThinkingEnd 時已創建）
            answerContainer = responseDiv.querySelector('.response-section .response-content');
            
            if (!answerContainer) {
                console.log('⚠️ 未找到現有答案容器，創建新的');
                answerContainer = this.createAnswerContainer(responseDiv);
                this.showAnswerProcessing(answerContainer);
                
                // 模擬短暫處理時間以顯示loading狀態
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 清除處理中狀態
                this.clearAnswerProcessing(answerContainer);
            }
            
            // 如果容器已存在，載入狀態應該已在調用前被清除

            // 顯示答案內容
            if (answerText) {
                // 檢查是否為備用答案（來自 answer_chunk）
                if (isFallback) {
                    console.log('📢 顯示備用答案（來自 answer_chunk）');
                    // 備用答案直接顯示，不進行翻譯處理
                    const formattedAnswer = this.formatResponseChunk(answerText);
                    answerContainer.innerHTML = formattedAnswer;
                    
                    // 備用答案沒有引用來源
                    responseDiv.dataset.references = JSON.stringify([]);
                } else {
                    // 正常答案流程：翻譯並顯示
                    const translatedAnswer = await this.translateWithQueue(answerText);
                    const cleanedAnswer = this.cleanCompleteText(translatedAnswer);
                    const formattedAnswer = this.formatResponseChunk(cleanedAnswer);
                    answerContainer.innerHTML = formattedAnswer;
                    
                    // 處理引用來源
                    if (references && references.length > 0) {
                        console.log('📚 [Case C] 顯示引用來源:', references.length, '個');
                        
                        // 檢查是否已經有增強後的引用數據（Case E 虛擬引用增強）
                        if (!responseDiv.dataset.references) {
                            // 只有在沒有預先存儲的引用數據時才存儲原始引用
                            responseDiv.dataset.references = JSON.stringify(references);
                            console.log('💾 已存儲原始引用數據到responseDiv');
                        } else {
                            console.log('💾 已有增強後的引用數據，不覆蓋');
                        }
                        
                        // 檢查是否應該顯示引用來源（≥10個才顯示）
                        if (references.length >= 10) {
                            console.log('✅ [Case C] 使用緊湊格式顯示引用區塊');
                            this.displayEnhancedReferences(references, responseDiv, 0); // 0 表示沒有虛擬引用
                        } else {
                            console.log('❌ [Case C] 引用來源數量 < 10，不顯示引用區塊，但已存儲數據供識別碼使用');
                        }
                    } else {
                        console.log('📚 [Case C] 沒有引用來源');
                        // 只有在沒有預先存儲的引用數據時才存儲空數組
                        if (!responseDiv.dataset.references) {
                            responseDiv.dataset.references = JSON.stringify([]);
                        }
                    }
                }
                
                // 答案和引用來源處理完成，稍後在流程結束時顯示識別碼
                
                this.scrollToBottom();
            } else {
                console.warn('⚠️ 沒有找到答案文本');
                answerContainer.innerHTML = '<div class="error-message">未能取得完整回應內容</div>';
            }
            
        } catch (error) {
            console.error('顯示答案結果錯誤:', error);
            
            if (answerContainer) {
                this.clearAnswerProcessing(answerContainer);
                answerContainer.innerHTML = `<div class="error-message">顯示答案時發生錯誤: ${error.message}</div>`;
            }
            
            // 即使發生錯誤，也要確保存儲引用數組，以便識別碼能正常顯示
            if (responseDiv && !responseDiv.dataset.references) {
                responseDiv.dataset.references = JSON.stringify([]);
                console.log('💾 錯誤情況下存儲空引用數組');
            }
            
            throw error;
        }
        
        // 返回responseDiv供後續識別碼顯示使用
        return responseDiv;
    }

    async startCaseEStreamingResponse(question) {
        // Case E: Case C + 模擬引用
        console.log('🎯 開始 Case E 模擬串流模式（對應 Case C + 模擬引用）...');
        
        // 檢查是否選擇了範例問題
        const exampleSelect = document.getElementById('exampleSelect');
        const selectedExample = exampleSelect ? exampleSelect.value : '';
        
        if (['1', '2', '3'].includes(selectedExample)) {
            console.log(`🎯 使用範例 ${selectedExample}，將注入模擬引用`);
            return await this.startCaseCStreamingResponseWithSimulation(question, selectedExample);
        } else {
            console.log('🎯 未選擇範例或選擇自訂問題，使用標準 Case C 模式');
            return await this.startCaseCStreamingResponse(question);
        }
    }

    async startCaseFStreamingResponse(question) {
        // Case F: Case D + 模擬引用
        console.log('🎯 開始 Case F 模擬純答案模式（對應 Case D + 模擬引用）...');
        
        // 檢查是否選擇了範例問題
        const exampleSelect = document.getElementById('exampleSelect');
        const selectedExample = exampleSelect ? exampleSelect.value : '';
        
        if (['1', '2', '3'].includes(selectedExample)) {
            console.log(`🎯 使用範例 ${selectedExample}，將注入模擬引用`);
            return await this.startCaseDStreamingResponseWithSimulation(question, selectedExample);
        } else {
            console.log('🎯 未選擇範例或選擇自訂問題，使用標準 Case D 模式');
            return await this.startCaseDStreamingResponse(question);
        }
    }

    async startCaseCStreamingResponseWithSimulation(question, exampleNumber) {
        // 創建 AI 回應容器
        const responseDiv = this.createResponseContainer();
        
        try {
            // 先獲取模擬引用數據
            console.log(`🎯 正在獲取範例 ${exampleNumber} 的模擬引用數據...`);
            const simulationData = await this.fetchSimulationData(exampleNumber);
            
            // === Case E 模擬模式：基於 Case C 但加入模擬引用 ===
            console.log('🧠 開始 Case E 模擬模式（Case C + 模擬引用）...');
            
            // 創建答案狀態追蹤
            let answerData = null;
            let thinkingEnded = false;
            
            // 顯示處理狀態
            this.showAnswerProcessing(responseDiv);
            
            // 並發執行真實 AI 請求
            const [streamResponse] = await Promise.all([
                fetch(`${this.workerUrl}/stream-gemini`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: question,
                        showThinking: this.showThinking,
                        enableSearch: this.enableSearch
                    }),
                })
            ]);

            if (!streamResponse.ok) {
                throw new Error(`串流請求失敗: ${streamResponse.status}`);
            }

            const reader = streamResponse.body.getReader();
            let buffer = '';
            let currentThinkingId = null;
            let currentSection = null;

            // 處理串流數據
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('🏁 Case E 串流數據接收完成');
                    break;
                }

                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            console.log('🏁 Case E 串流處理完成');
                            thinkingEnded = true;
                            
                            // 注入模擬引用到答案中
                            if (answerData && simulationData.references) {
                                console.log(`🎯 注入 ${simulationData.references.length} 個模擬引用到答案中...`);
                                this.injectSimulatedReferences(answerData, simulationData.references);
                            }
                            
                            break;
                        }

                        try {
                            const chunk = JSON.parse(data);
                            
                            if (chunk.type === 'thinking') {
                                if (this.showThinking) {
                                    currentThinkingId = this.displayThinkingChunk(chunk, responseDiv, currentThinkingId);
                                }
                            } else if (chunk.type === 'answer') {
                                // 保存答案數據以便後續注入引用
                                answerData = chunk;
                                
                                this.displayAnswerChunk(chunk, responseDiv);
                            }
                        } catch (e) {
                            console.error('解析串流數據錯誤:', e, '數據:', data);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Case E 串流處理發生錯誤:', error);
            
            const answerContainer = responseDiv.querySelector('.answer-section');
            if (answerContainer) {
                answerContainer.innerHTML = `<div class="error-message">Case E 串流處理發生錯誤: ${error.message}</div>`;
            }
            
            throw error;
        }
        
        // 返回responseDiv供後續識別碼顯示使用
        return responseDiv;
    }

    async startCaseDStreamingResponseWithSimulation(question, exampleNumber) {
        // 創建 AI 回應容器
        const responseDiv = this.createResponseContainer();
        
        try {
            // 先獲取模擬引用數據
            console.log(`🎯 正在獲取範例 ${exampleNumber} 的模擬引用數據...`);
            const simulationData = await this.fetchSimulationData(exampleNumber);
            
            // === Case F 模擬模式：基於 Case D 但加入模擬引用 ===
            console.log('🎯 開始 Case F 模擬模式（Case D + 模擬引用）...');
            
            // 顯示處理狀態
            this.showAnswerProcessing(responseDiv);
            
            const streamResponse = await fetch(`${this.workerUrl}/stream-gemini`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    showThinking: false, // Case D 不顯示思考過程
                    enableSearch: this.enableSearch
                }),
            });

            if (!streamResponse.ok) {
                throw new Error(`串流請求失敗: ${streamResponse.status}`);
            }

            const reader = streamResponse.body.getReader();
            let buffer = '';
            let answerData = null;
            let showingReferences = false;

            // 處理串流數據
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('🏁 Case F 串流數據接收完成');
                    break;
                }

                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            console.log('🏁 Case F 串流處理完成');
                            
                            // 注入模擬引用到答案中
                            if (answerData && simulationData.references) {
                                console.log(`🎯 注入 ${simulationData.references.length} 個模擬引用到答案中...`);
                                this.injectSimulatedReferences(answerData, simulationData.references);
                            }
                            
                            break;
                        }

                        try {
                            const chunk = JSON.parse(data);
                            
                            if (chunk.type === 'answer') {
                                // 保存答案數據以便後續注入引用
                                answerData = chunk;
                                
                                // Case F 特殊處理：過濾引用內容
                                if (chunk.content && this.containsReferenceKeywords(chunk.content) && !showingReferences) {
                                    console.log('🎯 Case F 檢測到參考來源關鍵字，停止顯示後續內容');
                                    showingReferences = true;
                                    continue;
                                }
                                
                                if (!showingReferences) {
                                    this.displayAnswerChunk(chunk, responseDiv);
                                }
                            }
                        } catch (e) {
                            console.error('解析串流數據錯誤:', e, '數據:', data);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Case F 串流處理發生錯誤:', error);
            
            const answerContainer = responseDiv.querySelector('.answer-section');
            if (answerContainer) {
                answerContainer.innerHTML = `<div class="error-message">Case F 串流處理發生錯誤: ${error.message}</div>`;
            }
            
            throw error;
        }
        
        // 返回responseDiv供後續識別碼顯示使用
        return responseDiv;
    }

    async fetchSimulationData(exampleNumber) {
        try {
            const response = await fetch(`${this.workerUrl}/sample-data?example=${exampleNumber}`);
            if (!response.ok) {
                throw new Error(`獲取模擬數據失敗: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('❌ 獲取模擬數據失敗:', error);
            return { references: [] };
        }
    }

    injectSimulatedReferences(answerData, references) {
        // 找到答案容器
        const answerContainer = document.querySelector('.answer-content');
        if (!answerContainer) {
            console.warn('⚠️ 找不到答案容器，無法注入模擬引用');
            return;
        }

        // 創建引用區塊
        const referencesSection = document.createElement('div');
        referencesSection.className = 'references-section';
        referencesSection.innerHTML = `
            <div class="section-header">
                <h3><i class="fas fa-link"></i> 參考來源</h3>
                <p class="reference-count">共 ${references.length} 個來源</p>
            </div>
            <div class="references-list">
                ${references.map((ref, index) => {
                    const refData = ref.web || ref; // 兼容不同的數據格式
                    return `
                        <div class="reference-item compact" id="ref-${index + 1}">
                            <div class="reference-number">${index + 1}</div>
                            <div class="reference-details">
                                <a href="${refData.uri || refData.url}" target="_blank" rel="noopener noreferrer" class="reference-title">
                                    ${refData.title}
                                </a>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // 將引用區塊添加到整個 messageContent，而不是答案容器內部
        const messageContent = document.querySelector('.message-content') || document.querySelector('.message.ai-message');
        if (messageContent) {
            messageContent.appendChild(referencesSection);
        } else {
            // 如果找不到 messageContent，回退到原來的行為
            answerContainer.appendChild(referencesSection);
        }
        
        console.log(`✅ 成功注入 ${references.length} 個模擬引用`);

        // 顯示成功訊息
        this.showNotification(`✅ 已注入 ${references.length} 個模擬引用來源`, 'success');
    }

    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // 添加到頁面
        document.body.appendChild(notification);

        // 自動移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // 新增：Case C + 虛擬引用增強
    async startCaseCStreamingResponseWithVirtualReferences(question) {
        const responseDiv = this.createResponseContainer();
        
        try {
            console.log('🎯 開始 Case E 模式（Case C + 虛擬引用增強）...');
            
            // 創建答案狀態追蹤
            let answerData = null;
            let thinkingEnded = false;
            let answerDisplayed = false;
            let collectedReferences = [];
            let virtualReferencesReady = false;
            let enhancedReferences = null;
            
            // 先啟動虛擬引用增強請求（不等待結果，但追蹤狀態）
            const virtualEnhancementPromise = (async () => {
                try {
                    // 檢測問題類型並獲取虛擬引用
                    const questionCategory = this.detectQuestionCategory(question);
                    if (questionCategory) {
                        console.log(`🎯 [Case E] 檢測到問題類型: ${questionCategory}，開始預先獲取虛擬引用...`);
                        const virtualData = await this.fetchVirtualReferences(questionCategory);
                        if (virtualData && virtualData.references && virtualData.references.length > 0) {
                            console.log('✅ [Case E] 虛擬引用數據已準備就緒');
                            virtualReferencesReady = true;
                            
                            // 虛擬引用準備好後檢查是否可以顯示
                            console.log('🎯 [Case E] 虛擬引用已準備，檢查是否可以顯示');
                            checkAndDisplayAnswerWhenReady();
                            
                            return virtualData;
                        }
                    }
                    virtualReferencesReady = true; // 即使沒有虛擬引用也標記為準備就緒
                    return null;
                } catch (error) {
                    console.warn('⚠️ [Case E] 虛擬引用獲取失敗，但繼續處理:', error);
                    virtualReferencesReady = true;
                    return null;
                }
            })();

            // 共用的檢查和顯示函數
            const checkAndDisplayAnswerWhenReady = async () => {
                // 檢查翻譯隊列是否清空
                const currentTime = Date.now();
                const queueWaitTime = Math.max(0, this.nextTranslationTime - currentTime);
                const queueIsEmpty = queueWaitTime <= 0;
                
                console.log('🔍 [Case E] 檢查顯示條件:', {
                    virtualReferencesReady,
                    answerDataReady: !!answerData,
                    queueIsEmpty,
                    answerDisplayed,
                    queueWaitTime
                });
                
                // 所有條件滿足：虛擬引用準備好 + 答案數據準備好 + 翻譯隊列清空 + 還沒顯示答案
                if (virtualReferencesReady && answerData && queueIsEmpty && !answerDisplayed) {
                    console.log('🚀 [Case E] 所有條件滿足，立即顯示答案和識別碼');
                    
                    // 處理虛擬引用增強
                    const virtualData = await virtualEnhancementPromise;
                    enhancedReferences = await this.enhanceWithVirtualReferencesSync(question, collectedReferences, virtualData, responseDiv);
                    
                    // 立即顯示答案
                    await this.displayAnswerResult(responseDiv, answerData, question);
                    answerDisplayed = true;
                    
                    // [Case E] 與引用來源同時顯示識別碼
                    this.showFinalSessionCodeWithReferences(responseDiv, question, enhancedReferences);
                    return true; // 表示已經顯示
                }
                
                return false; // 表示條件不滿足，未顯示
            };

            // 併發執行兩個階段的請求
            const answerPromise = this.processAnswerPhaseBackground(question, responseDiv)
                .then(data => {
                    answerData = data;
                    if (data && data.references) {
                        collectedReferences = data.references;
                    }
                    
                    // 答案數據獲取後檢查是否可以顯示
                    console.log('🎯 [Case E] 答案數據已獲取，檢查是否可以顯示');
                    checkAndDisplayAnswerWhenReady();
                });

            const thinkingPromise = this.processThinkingPhase(question, responseDiv, async () => {
                // thinking end 回調：等待翻譯隊列清空後檢查是否可以開始顯示答案
                console.log('🎯 [Case E] thinking end 收到，檢查翻譯隊列狀態...');
                
                // 計算翻譯隊列還需要多長時間清空
                const currentTime = Date.now();
                const queueWaitTime = Math.max(0, this.nextTranslationTime - currentTime);
                
                if (queueWaitTime > 0) {
                    console.log(`⏳ [Case E] 翻譯隊列還需等待 ${queueWaitTime}ms，等待清空後檢查顯示條件`);
                    await new Promise(resolve => setTimeout(resolve, queueWaitTime));
                }
                
                console.log('✅ [Case E] 翻譯隊列已清空，檢查虛擬引用和答案狀態');
                
                // 檢查是否可以開始顯示答案
                const displayed = await checkAndDisplayAnswerWhenReady();
                
                // 如果還沒顯示，說明條件不滿足，顯示載入狀態
                if (!displayed) {
                    console.log('⏳ [Case E] 條件尚未滿足，顯示載入狀態');
                    const answerContainer = this.createAnswerContainer(responseDiv);
                    this.showAnswerProcessing(answerContainer);
                }
            })
                .then(() => {
                    thinkingEnded = true;
                });

            // 等待思考階段完成
            await thinkingPromise;
            console.log('✅ Case E 思考階段完成');
            
            // 如果答案還沒顯示，等待必要條件滿足後顯示
            if (!answerDisplayed) {
                console.log('⏳ [Case E] 思考階段完成但答案尚未顯示，等待條件滿足...');
                
                // 等待虛擬引用和答案數據都準備好
                await Promise.all([virtualEnhancementPromise, answerPromise]);
                
                if (answerData && !answerDisplayed) {
                    // 處理虛擬引用增強（如果還沒處理）
                    if (!enhancedReferences) {
                        const virtualData = await virtualEnhancementPromise;
                        enhancedReferences = await this.enhanceWithVirtualReferencesSync(question, collectedReferences, virtualData, responseDiv);
                        
                        // [Case E] 與引用來源同時顯示識別碼
                        this.showFinalSessionCodeWithReferences(responseDiv, question, enhancedReferences);
                    }
                    
                    console.log('🚀 [Case E] 最終條件滿足，顯示答案');
                    await this.displayAnswerResult(responseDiv, answerData, question);
                    answerDisplayed = true;
                } else if (!answerData) {
                    // 重新獲取答案容器以顯示錯誤
                    const answerContainer = responseDiv.querySelector('.response-section .response-content');
                    if (answerContainer) {
                        answerContainer.innerHTML = '<div class="error-message">未能獲取回答內容</div>';
                    }
                }
            }

            // 等待答案階段完成（確保所有背景處理完成）
            await answerPromise;
            console.log('✅ Case E 答案階段完成');

            // 如果還沒有增強引用，現在處理（用於識別碼生成）
            if (!enhancedReferences) {
                const virtualData = await virtualEnhancementPromise;
                enhancedReferences = await this.enhanceWithVirtualReferencesSync(question, collectedReferences, virtualData, responseDiv);
                
                // [Case E] 與引用來源同時顯示識別碼
                this.showFinalSessionCodeWithReferences(responseDiv, question, enhancedReferences);
            }
            
            // 存儲思考數據到 responseDiv，供識別碼生成使用
            responseDiv.dataset.thinking = JSON.stringify(true); // Case E 有思考過程
            
            // 存儲增強後的引用數據到 responseDiv，供識別碼生成使用
            const finalReferences = enhancedReferences || collectedReferences || [];
            responseDiv.dataset.references = JSON.stringify(finalReferences);
            console.log('💾 [Case E] 存儲增強後的引用數據到responseDiv，數量:', finalReferences.length);
            
            // 在清除載入狀態
            const loadingContainer = responseDiv.querySelector('.response-section .response-content');
            if (loadingContainer) {
                console.log('🧹 [Case E] 清除載入狀態');
                this.clearAnswerProcessing(loadingContainer);
            }
            
            // 識別碼已經與引用來源同時顯示，無需再次顯示

        } catch (error) {
            console.error('❌ Case E 串流處理發生錯誤:', error);
            
            const answerContainer = responseDiv.querySelector('.answer-section');
            if (answerContainer) {
                answerContainer.innerHTML = `<div class="error-message">Case E 串流處理發生錯誤: ${error.message}</div>`;
            }
            
            throw error;
        }
        
        return responseDiv;
    }

    // 新增：Case D + 虛擬引用增強
    async startCaseDStreamingResponseWithVirtualReferences(question) {
        const responseDiv = this.createResponseContainer();
        
        try {
            console.log('🎯 開始 Case F 模式（Case D + 虛擬引用增強）...');
            
            // 創建答案容器
            const answerContainer = this.createAnswerContainer(responseDiv);
            
            let collectedReferences = [];
            let referenceSectionDetected = false;
            let hasDisplayedContent = false; // 追蹤是否已顯示內容
            
            // 顯示處理狀態
            this.showAnswerProcessing(answerContainer);
            
            const streamResponse = await fetch(`${this.workerUrl}/stream-gemini`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    showThinking: false, // Case D 不顯示思考過程
                    enableSearch: this.enableSearch
                }),
            });

            if (!streamResponse.ok) {
                throw new Error(`串流請求失敗: ${streamResponse.status}`);
            }

            const reader = streamResponse.body.getReader();
            let buffer = '';
            let answerBuffer = '';

            // 處理串流數據
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('🏁 Case F 串流數據接收完成');
                    break;
                }

                buffer += new TextDecoder().decode(value);
                let lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            console.log('🏁 Case F 串流處理完成');
                            break;
                        }

                        try {
                            const payload = JSON.parse(dataStr);
                            
                            // [Case D] 收集引用數據
                            if (payload.references && Array.isArray(payload.references)) {
                                collectedReferences = payload.references;
                                console.log('📚 [Case F] 收集到引用數據:', collectedReferences.length);
                            }
                            
                            // 處理各種可能的內容格式
                            let content = null;
                            
                            if (payload.type === 'thinking_chunk' || payload.type === 'answer_chunk') {
                                content = payload.content;
                            } else if (payload.candidates && payload.candidates[0]) {
                                const candidate = payload.candidates[0];
                                if (candidate.content && candidate.content.parts) {
                                    const textParts = candidate.content.parts.filter(part => part.text);
                                    if (textParts.length > 0) {
                                        content = textParts[textParts.length - 1].text;
                                    }
                                }
                            } else if (payload.content && typeof payload.content === 'string') {
                                content = payload.content;
                            } else if (payload.thinking) {
                                content = payload.thinking;
                            }

                            if (content && content.trim()) {
                                // 調試：記錄收到的內容
                                if (content.includes('參考資料') || content.includes('引用來源')) {
                                    console.log('🔍 [Case F Debug] 發現包含參考標記的內容:', JSON.stringify(content.substring(0, 200)));
                                }
                                
                                // 檢查是否包含參考來源標記，如果有混合內容則先分離
                                if (!referenceSectionDetected && this.containsReferenceKeywords(content)) {
                                    console.log('✅ [Case F Debug] containsReferenceKeywords 返回 true');
                                    
                                    // 分離混合內容
                                    const { beforeReference, hasReference } = this.separateMixedContent(content);
                                    
                                    // 如果有參考資料前的有效內容，先顯示它
                                    if (beforeReference && beforeReference.trim()) {
                                        console.log('📝 [Case F] 發現混合內容，先顯示參考資料前的內容');
                                        
                                        // 語言檢測：只顯示非英文內容
                                        const isEnglish = await this.isEnglishContent(beforeReference);
                                        
                                        if (!isEnglish) {
                                            // [Case F] 第一次顯示內容時清除 Loading 狀態
                                            if (!hasDisplayedContent) {
                                                answerContainer.innerHTML = ''; // 清除 Loading 狀態
                                                hasDisplayedContent = true;
                                                console.log('🧹 [Case F] 清除 Loading 狀態，開始顯示內容');
                                            }
                                            
                                            // 直接顯示參考資料前的內容
                                            const formattedContent = this.formatResponseChunk(beforeReference);
                                            answerContainer.innerHTML += formattedContent;
                                            this.scrollToBottom();
                                            
                                            answerBuffer += beforeReference;
                                        }
                                    }
                                    
                                    // 設置參考來源區塊檢測標記
                                    console.log('🚫 [Case F] 偵測到參考來源區塊，停止顯示後續內容');
                                    referenceSectionDetected = true;
                                    
                                    // 立即顯示來源處理載入提示
                                    console.log('🔄 [Case F] 偵測到引用來源，顯示載入提示');
                                    this.showSourceProcessingLoader(responseDiv);
                                    
                                    continue;
                                }
                                
                                // 如果已經偵測到參考來源區塊，跳過所有後續內容
                                if (referenceSectionDetected) {
                                    continue;
                                }
                                
                                // 語言檢測：只顯示非英文內容
                                const isEnglish = await this.isEnglishContent(content);
                                
                                if (!isEnglish) {
                                    // [Case F] 第一次顯示內容時清除 Loading 狀態
                                    if (!hasDisplayedContent) {
                                        answerContainer.innerHTML = ''; // 清除 Loading 狀態
                                        hasDisplayedContent = true;
                                        console.log('🧹 [Case F] 清除 Loading 狀態，開始顯示內容');
                                    }
                                    
                                    // [Case F] 清理參考來源字樣（與 Case D 一致）
                                    const cleanedContent = this.cleanReferenceListFromText(content);
                                    
                                    // 直接顯示內容
                                    const formattedContent = this.formatResponseChunk(cleanedContent);
                                    answerContainer.innerHTML += formattedContent;
                                    this.scrollToBottom();
                                    
                                    answerBuffer += content;
                                }
                            }
                        } catch (e) {
                            console.error('解析串流數據錯誤:', e, '數據:', dataStr);
                        }
                    }
                }
            }

            // [Case F] 如果整個串流過程中都沒有顯示任何內容，清除 Loading 狀態
            if (!hasDisplayedContent && answerContainer) {
                answerContainer.innerHTML = '<div class="no-content-message">沒有符合顯示條件的回答內容</div>';
                console.log('⚠️ [Case F] 整個串流過程中沒有顯示任何內容，顯示無內容消息');
            }
            
            console.log('✅ Case F 串流處理完成');
            
            // 如果還沒有顯示過載入提示（沒有偵測到引用來源），現在顯示
            const existingLoader = responseDiv.querySelector('.source-processing-loader');
            if (!existingLoader) {
                console.log('🔄 [Case F] 補充顯示來源處理載入提示（未偵測到引用來源情況）');
                this.showSourceProcessingLoader(responseDiv);
            }
            
            // 檢查是否需要虛擬引用增強（僅獲取數據，不顯示）
            const finalReferences = await this.enhanceWithVirtualReferencesDataOnly(question, collectedReferences);
            
            // 移除載入提示
            this.removeSourceProcessingLoader(responseDiv);
            
            // 存儲引用數據到 responseDiv，供識別碼生成使用（參照 Case D）
            // 使用增強後的引用數據（如果有的話）
            const referencesForId = finalReferences || collectedReferences;
            responseDiv.dataset.references = JSON.stringify(referencesForId);
            responseDiv.dataset.thinking = JSON.stringify(null); // Case F 沒有思考過程
            
            if (referencesForId.length > 0) {
                console.log('💾 [Case F] 已存儲引用數據到responseDiv');
            } else {
                console.log('📚 [Case F] 沒有引用來源');
                // 即使沒有引用來源，也存儲空數組
                responseDiv.dataset.references = JSON.stringify([]);
            }
            
            // 先顯示識別碼（參照 Case D）
            this.showFinalSessionCode(responseDiv, question);
            
            // 然後顯示引用來源
            if (referencesForId && referencesForId.length > 0) {
                const virtualCount = (finalReferences && collectedReferences) ? finalReferences.length - collectedReferences.length : 0;
                this.displayEnhancedReferences(referencesForId, responseDiv, virtualCount);
            }

        } catch (error) {
            console.error('❌ Case F 串流處理發生錯誤:', error);
            
            // 確保移除載入提示
            this.removeSourceProcessingLoader(responseDiv);
            
            const answerContainer = responseDiv.querySelector('.answer-section');
            if (answerContainer) {
                answerContainer.innerHTML = `<div class="error-message">Case F 串流處理發生錯誤: ${error.message}</div>`;
            }
            
            throw error;
        }
        
        return responseDiv;
    }

    // 新增：虛擬引用增強邏輯
    async enhanceWithVirtualReferences(question, existingReferences, responseDiv) {
        try {
            console.log(`🔍 檢查是否需要虛擬引用增強，現有引用數量: ${existingReferences ? existingReferences.length : 0}`);
            
            // 檢查是否需要虛擬引用（引用數據小於10）
            const needsVirtualReferences = !existingReferences || existingReferences.length < 10;
            
            if (!needsVirtualReferences) {
                console.log('✅ 現有引用數據充足，無需虛擬引用增強');
                return existingReferences; // 返回原始引用數據
            }

            // 檢測問題類型
            const questionCategory = this.detectQuestionCategory(question);
            if (!questionCategory) {
                console.log('ℹ️ 無法檢測問題類型，不進行虛擬引用增強');
                return existingReferences; // 返回原始引用數據
            }

            console.log(`🎯 檢測到問題類型: ${questionCategory}，開始虛擬引用增強...`);

            // 獲取虛擬引用數據
            const virtualData = await this.fetchVirtualReferences(questionCategory);
            if (!virtualData || !virtualData.references || virtualData.references.length === 0) {
                console.warn('⚠️ 無法獲取虛擬引用數據');
                return existingReferences; // 返回原始引用數據
            }

            // 使用所有的虛擬引用（不再限制數量）
            const selectedVirtualReferences = virtualData.references;
            
            // 轉換為標準格式並添加虛擬引用標記
            const formattedReferences = selectedVirtualReferences.map(ref => ({
                web: {
                    title: ref.web.title,
                    uri: ref.web.uri
                },
                virtual: true,        // 明確標記為虛擬引用
                isVirtual: true,      // 備用標記
                type: 'virtual',      // 類型標記
                category: questionCategory,  // 類別標記
                referenceId: ref.referenceId // 保留後端生成的識別碼
            }));

            // 如果有現有引用，合併；否則只使用虛擬引用
            const enhancedReferences = existingReferences && existingReferences.length > 0 
                ? [...existingReferences, ...formattedReferences]
                : formattedReferences;

            console.log(`✅ 虛擬引用增強完成：原有 ${existingReferences ? existingReferences.length : 0} 個，新增 ${selectedVirtualReferences.length} 個虛擬引用`);

            // 顯示增強後的引用
            this.displayEnhancedReferences(enhancedReferences, responseDiv, selectedVirtualReferences.length);
            
            // 返回增強後的引用數據供識別碼生成使用
            return enhancedReferences;

        } catch (error) {
            console.error('❌ 虛擬引用增強失敗:', error);
            return existingReferences; // 發生錯誤時返回原始引用數據
        }
    }

    // 新增：僅處理虛擬引用數據而不顯示（用於 Case F 調整順序）
    async enhanceWithVirtualReferencesDataOnly(question, existingReferences) {
        try {
            console.log(`🔍 [數據處理] 檢查是否需要虛擬引用增強，現有引用數量: ${existingReferences ? existingReferences.length : 0}`);
            
            // 檢查是否需要虛擬引用（引用數據小於10）
            const needsVirtualReferences = !existingReferences || existingReferences.length < 10;
            
            if (!needsVirtualReferences) {
                console.log('✅ [數據處理] 現有引用數據充足，無需虛擬引用增強');
                return existingReferences; // 返回原始引用數據
            }

            // 檢測問題類型
            const questionCategory = this.detectQuestionCategory(question);
            if (!questionCategory) {
                console.log('ℹ️ [數據處理] 無法檢測問題類型，不進行虛擬引用增強');
                return existingReferences; // 返回原始引用數據
            }

            console.log(`🎯 [數據處理] 檢測到問題類型: ${questionCategory}，開始虛擬引用增強...`);

            // 獲取虛擬引用數據
            const virtualData = await this.fetchVirtualReferences(questionCategory);
            if (!virtualData || !virtualData.references || virtualData.references.length === 0) {
                console.warn('⚠️ [數據處理] 無法獲取虛擬引用數據');
                return existingReferences; // 返回原始引用數據
            }

            // 使用所有的虛擬引用（不再限制數量）
            const selectedVirtualReferences = virtualData.references;
            
            // 轉換為標準格式並添加虛擬引用標記
            const formattedReferences = selectedVirtualReferences.map(ref => ({
                web: {
                    title: ref.web.title,
                    uri: ref.web.uri
                },
                virtual: true,        // 明確標記為虛擬引用
                isVirtual: true,      // 備用標記
                type: 'virtual',      // 類型標記
                category: questionCategory,  // 類別標記
                referenceId: ref.referenceId // 保留後端生成的識別碼
            }));

            // 如果有現有引用，合併；否則只使用虛擬引用
            const enhancedReferences = existingReferences && existingReferences.length > 0 
                ? [...existingReferences, ...formattedReferences]
                : formattedReferences;

            console.log(`✅ [數據處理] 虛擬引用增強完成：原有 ${existingReferences ? existingReferences.length : 0} 個，新增 ${selectedVirtualReferences.length} 個虛擬引用`);
            
            // 只返回數據，不顯示
            return enhancedReferences;

        } catch (error) {
            console.error('❌ [數據處理] 虛擬引用增強失敗:', error);
            return existingReferences; // 發生錯誤時返回原始引用數據
        }
    }

    // 新增：使用預取的虛擬引用數據進行同步增強（用於 Case E 優化）
    async enhanceWithVirtualReferencesSync(question, existingReferences, virtualData, responseDiv) {
        try {
            console.log(`🔍 [同步增強] 檢查是否需要虛擬引用增強，現有引用數量: ${existingReferences ? existingReferences.length : 0}`);
            
            // 檢查是否需要虛擬引用（引用數據小於10）
            const needsVirtualReferences = !existingReferences || existingReferences.length < 10;
            
            if (!needsVirtualReferences) {
                console.log('✅ [同步增強] 現有引用數據充足，無需虛擬引用增強');
                return existingReferences; // 返回原始引用數據
            }

            if (!virtualData || !virtualData.references || virtualData.references.length === 0) {
                console.log('ℹ️ [同步增強] 沒有虛擬引用數據，返回原始引用');
                return existingReferences; // 返回原始引用數據
            }

            // 使用所有的虛擬引用（不再限制數量）
            const selectedVirtualReferences = virtualData.references;
            
            // 轉換為標準格式並添加虛擬引用標記
            const formattedReferences = selectedVirtualReferences.map(ref => ({
                web: {
                    title: ref.web.title,
                    uri: ref.web.uri
                },
                virtual: true,        // 明確標記為虛擬引用
                isVirtual: true,      // 備用標記
                type: 'virtual',      // 類型標記
                category: virtualData.category,  // 類別標記
                referenceId: ref.referenceId     // 保留後端生成的識別碼
            }));

            // 如果有現有引用，合併；否則只使用虛擬引用
            const enhancedReferences = existingReferences && existingReferences.length > 0 
                ? [...existingReferences, ...formattedReferences]
                : formattedReferences;

            console.log(`✅ [同步增強] 虛擬引用增強完成：原有 ${existingReferences ? existingReferences.length : 0} 個，新增 ${selectedVirtualReferences.length} 個虛擬引用`);

            // 顯示增強後的引用
            this.displayEnhancedReferences(enhancedReferences, responseDiv, selectedVirtualReferences.length);
            
            // 返回增強後的引用數據供識別碼生成使用
            return enhancedReferences;

        } catch (error) {
            console.error('❌ [同步增強] 虛擬引用增強失敗:', error);
            return existingReferences; // 發生錯誤時返回原始引用數據
        }
    }

    // 新增：檢測問題類型
    detectQuestionCategory(question) {
        const categories = {
            '車輛竊取': ['車', '竊取', '竊盜', '偷', '機車', '汽車', '騎走', '開走'],
            '噪音干擾': ['噪音', '吵', '吠叫', '聲音', '安寧', '干擾', '鄰居'],
            '消費糾紛': ['購買', '買', '商品', '假貨', '退款', '消費', '網購', '賣家']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => question.includes(keyword))) {
                return category;
            }
        }

        return null;
    }

    // 新增：獲取虛擬引用數據
    async fetchVirtualReferences(category) {
        try {
            const response = await fetch(`${this.workerUrl}/virtual-references?category=${encodeURIComponent(category)}`);
            if (!response.ok) {
                throw new Error(`獲取虛擬引用失敗: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('❌ 獲取虛擬引用數據失敗:', error);
            return null;
        }
    }

    // 新增：顯示增強後的引用（完全比照 sample_for_reference 格式）
    displayEnhancedReferences(references, responseDiv, virtualCount) {
        // 移除現有的引用區塊
        const existingReferences = responseDiv.querySelector('.references-section');
        if (existingReferences) {
            existingReferences.remove();
        }

        // 創建增強後的引用區塊（使用 sample_for_reference 格式）
        const referencesSection = document.createElement('div');
        referencesSection.className = 'references-section';
        referencesSection.innerHTML = `
            <div class="references-header">
                <span><i class="fas fa-link"></i> 引用來源</span>
                <button class="toggle-references" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                    <i class="fas fa-chevron-up"></i>
                </button>
            </div>
            <div class="references-content">
                ${this.formatSampleReferences(references)}
            </div>
        `;

        // 添加到整個回應容器的 messageContent，而不是 answerSection 內部
        const messageContent = responseDiv.querySelector('.message-content') || responseDiv;
        messageContent.appendChild(referencesSection);

        // 不顯示虛擬引用的特殊通知，保持一致性
        console.log(`✅ 顯示引用來源：${references.length} 個來源（其中 ${virtualCount} 個為增強引用，但外觀完全一致）`);
    }

    // 新增：格式化引用來源（美化版：較小尺寸，僅顯示標題）
    formatSampleReferences(references) {
        if (!references || references.length === 0) return '';
        
        return references.map((ref, index) => {
            const refData = ref.web || ref; // 兼容不同的數據格式
            return `
                <div class="reference-item compact" id="ref-${index + 1}">
                    <div class="reference-number">${index + 1}</div>
                    <div class="reference-details">
                        <a href="${refData.uri || refData.url}" target="_blank" rel="noopener noreferrer" class="reference-title">
                            ${this.escapeHtml(refData.title)}
                        </a>
                    </div>
                </div>
            `;
        }).join('');
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
        let messageContent = responseDiv.querySelector('.message-content');
        
        // 如果找不到 message-content，創建一個
        if (!messageContent) {
            messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            responseDiv.appendChild(messageContent);
        }
        
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-section';
        const thinkingId = 'thinking-' + Date.now();
        thinkingDiv.innerHTML = `
            <div class="thinking-header" onclick="window.chatAppStreaming.toggleThinkingSection('${thinkingId}')">
                <div class="thinking-header-left">
                    <i class="fas fa-brain"></i>
                    <span>思考流程</span>
                </div>
                <div class="thinking-header-right">
                    <div class="streaming-indicator">
                        <i class="fas fa-circle-notch fa-spin"></i>
                    </div>
                    <i class="fas fa-chevron-down thinking-toggle-icon"></i>
                </div>
            </div>
            <div class="thinking-content" id="${thinkingId}" style="display: block;">
            </div>
        `;
        
        messageContent.appendChild(thinkingDiv);
        this.scrollToBottom();
        return thinkingDiv;  // 返回整個 thinking section，而不是內容區域
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
        
        // 找到思考容器，將答案容器插入其後
        const thinkingSection = messageContent.querySelector('.thinking-section');
        if (thinkingSection && thinkingSection.nextSibling) {
            // 如果思考容器存在且有下一個兄弟節點，插入在下一個節點之前
            messageContent.insertBefore(answerDiv, thinkingSection.nextSibling);
        } else if (thinkingSection) {
            // 如果思考容器存在但沒有下一個兄弟節點，直接追加
            messageContent.appendChild(answerDiv);
        } else {
            // 如果沒有思考容器，直接追加
            messageContent.appendChild(answerDiv);
        }
        
        this.scrollToBottom();
        return answerDiv.querySelector('.response-content');
    }

    // 舊版引用容器創建函數（大型藍色格式）- 已棄用，改用 displayEnhancedReferences
    createReferencesContainer(responseDiv, references) {
        const messageContent = responseDiv.querySelector('.message-content');
        
        // 檢查是否已經有引用容器
        const existingReferences = messageContent.querySelector('.references-section');
        if (existingReferences) {
            return existingReferences;
        }
        
        // 統一邏輯：只有當引用數量 ≥ 10 且開關開啟時才顯示
        if (!this.showReferencesCheckbox?.checked || !references || references.length < 10) {
            const reason = !this.showReferencesCheckbox.checked ? '引用來源開關關閉' : 
                          !references ? '沒有引用資料' : 
                          references.length === 0 ? '引用來源數量為0' : 
                          references.length < 10 ? `引用來源數量 ${references.length} < 10，隱藏引用區塊` : '未知原因';
            
            console.log('❌ 不顯示引用來源區塊，原因:', reason);
            return null;
        }

        console.log('✅ 顯示引用來源區塊，數量:', references.length, '≥ 10');

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
        
        // 添加引用容器並使用排序機制確保正確順序
        messageContent.appendChild(referencesDiv);
        
        // 如果識別碼已存在，重新排序所有元素
        const sessionDiv = messageContent.querySelector('.session-id-display');
        if (sessionDiv) {
            this.ensureSessionCodeAtBottom(messageContent, sessionDiv.cloneNode(true));
        }
        
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
                <div class="survey-return-notice">
                    <i class="fas fa-external-link-alt"></i>
                    <span>點擊以下連結，即可返回問卷繼續填答：</span>
                    <a href="https://www.surveycake.com/s/XYOg0" target="_blank" class="survey-link">
                        https://www.surveycake.com/s/XYOg0
                    </a>
                    <div class="survey-note">
                        如果遇到問卷網頁跳轉回歡迎頁面，請點擊「開始後繼續填答即可
                    </div>
                </div>
            `;
            
            // 確保識別碼始終在最下方：使用强制排序
            const existingSessionDiv = messageContent.querySelector('.session-id-display');
            if (existingSessionDiv) {
                existingSessionDiv.remove();
            }
            
            // 將識別碼添加到最後，並確保它在所有現有元素之後
            this.ensureSessionCodeAtBottom(messageContent, sessionDiv);
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

    // 新增：確保識別碼始終在最下方
    ensureSessionCodeAtBottom(messageContent, sessionDiv) {
        // 移除舊的識別碼
        const existingSessionDiv = messageContent.querySelector('.session-id-display');
        if (existingSessionDiv) {
            existingSessionDiv.remove();
        }

        // 排序其他元素
        const children = Array.from(messageContent.children);
        const getElementPriority = (element) => {
            if (element.classList.contains('message-header')) return 1;
            if (element.classList.contains('thinking-section')) return 2;
            if (element.classList.contains('response-section')) return 3;
            if (element.classList.contains('references-section')) return 4;
            return 0;
        };
        children.sort((a, b) => getElementPriority(a) - getElementPriority(b));

        // 重新 append 所有元素（不含識別碼）
        messageContent.innerHTML = '';
        children.forEach(element => messageContent.appendChild(element));

        // 最後 append 識別碼
        messageContent.appendChild(sessionDiv);

        console.log('✅ 識別碼已固定在最下方');
    }

    // 新增：將識別碼顯示在回答區下方（比照Case B格式）
    showSessionCodeBelowAnswer(responseDiv, code) {
        if (!this.hasShownSessionId) {
            const messageContent = responseDiv.querySelector('.message-content');
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-code-section';
            sessionDiv.innerHTML = `
                <div class="session-code-display">
                    <i class="fas fa-id-card"></i>
                    <span class="code-label">識別碼：</span>
                    <span class="session-code-text">${code}</span>
                    <button class="copy-code-btn" id="copy-btn-${code}" onclick="window.chatApp.copySessionCode('${code}', this)" title="複製識別碼">
                        <i class="fas fa-copy"></i>
                        <span class="copy-btn-text">複製識別碼</span>
                    </button>
                </div>
                <div class="survey-return-notice">
                    <i class="fas fa-external-link-alt"></i>
                    <span>點擊以下連結，即可返回問卷繼續填答：</span>
                    <a href="https://www.surveycake.com/s/XYOg0" target="_blank" class="survey-link">
                        https://www.surveycake.com/s/XYOg0
                    </a>
                    <div class="survey-note">
                        如果遇到問卷網頁跳轉回歡迎頁面，請點擊「開始」後繼續填答即可
                    </div>
                </div>
            `;
            
            // 確保識別碼在回答區之後顯示
            this.ensureSessionCodeBelowAnswer(messageContent, sessionDiv);
            this.hasShownSessionId = true;
            
            console.log('✅ [Case C] 識別碼已顯示在回答區下方');
        }
    }

    // 確保識別碼在回答區之後，但在引用來源之前
    ensureSessionCodeBelowAnswer(messageContent, sessionDiv) {
        console.log('🔧 [Case C] ensureSessionCodeBelowAnswer 開始');
        
        const place = () => {
            const references = messageContent.querySelector('.references-section');
            const response = messageContent.querySelector('.response-section');

            // 先移除舊的識別碼（支援兩種不同的 CSS 類名）
            messageContent.querySelectorAll('.session-code-section, .session-id-display')
                .forEach(n => {
                    if (n !== sessionDiv) { // 避免移除要插入的元素
                        n.remove();
                        console.log('🗑️ 移除舊識別碼');
                    }
                });

            // 如果存在引用來源，將識別碼插入到引用來源之前
            if (references && response) {
                response.parentNode.insertBefore(sessionDiv, references);
                console.log('✅ 識別碼已插入到回答區之後，引用來源之前');
                return true;
            } 
            // 如果只有回答區，將識別碼插入到回答區之後
            else if (response && response.nextSibling) {
                response.parentNode.insertBefore(sessionDiv, response.nextSibling);
                console.log('✅ 識別碼已插入到回答區之後');
                return true;
            } else if (response) {
                response.parentNode.appendChild(sessionDiv);
                console.log('✅ 識別碼已附加到回答區之後');
                return true;
            } else {
                // 回答區還沒生出來，先暫緩
                console.log('⏳ 回答區尚未生成，等待中...');
                return false;
            }
        };

        if (place()) return; // 已經放好

        // 監聽回答區生成後再放
        console.log('👀 設置 MutationObserver 等待回答區生成');
        const mo = new MutationObserver(() => {
            console.log('🔄 檢測到 DOM 變化，嘗試放置識別碼');
            if (place()) {
                mo.disconnect();
                console.log('✅ MutationObserver 已完成任務');
            }
        });
        mo.observe(messageContent, { childList: true, subtree: false });
    }

    // 最終階段：顯示識別碼（在所有內容處理完成後）
    showFinalSessionCode(responseDiv, question) {
        try {
            console.log('🏁 開始最終階段顯示識別碼 - 時間:', new Date().toISOString());
            console.log('🏁 hasShownSessionId 狀態:', this.hasShownSessionId);
            console.log('🏁 responseDiv 存在:', !!responseDiv);
            
            if (!responseDiv) {
                console.error('❌ responseDiv 為 null，無法顯示識別碼');
                return;
            }
            
            // 直接顯示，不需要延遲
            this.displaySessionCodeWhenReady(responseDiv, question);
            
        } catch (error) {
            console.error('❌ 顯示最終識別碼時發生錯誤:', error);
            console.error('❌ 錯誤堆棧:', error.stack);
        }
    }

    // 新增：當回答區域準備好時顯示識別碼
    displaySessionCodeWhenReady(responseDiv, question) {
        try {
            const messageContent = responseDiv.querySelector('.message-content');
            if (!messageContent) {
                console.error('❌ 找不到 message-content');
                return;
            }

            // 檢查回答區域是否存在
            const responseSection = messageContent.querySelector('.response-section');
            const thinkingSection = messageContent.querySelector('.thinking-section');
            
            console.log('📋 DOM 狀態檢查:', {
                hasResponseSection: !!responseSection,
                hasThinkingSection: !!thinkingSection,
                totalChildren: messageContent.children.length
            });

            // 檢查識別碼是否已經存在於DOM中
            const existingSessionCode = responseDiv.querySelector('.session-code-section, .session-id-display');
            if (existingSessionCode) {
                console.log('✅ [Case C] 識別碼已存在，跳過顯示');
                return;
            }
            
            // 獲取思考數據
            let thinking = null;
            if (responseDiv.dataset && responseDiv.dataset.thinking) {
                try {
                    thinking = JSON.parse(responseDiv.dataset.thinking);
                } catch (e) {
                    console.warn('⚠️ 解析存儲的思考數據失敗:', e);
                    thinking = null;
                }
            }
            
            // 獲取引用數據
            let references = [];
            if (responseDiv.dataset && responseDiv.dataset.references) {
                try {
                    references = JSON.parse(responseDiv.dataset.references);
                    console.log('📚 從數據屬性恢復引用來源:', references.length, '個');
                } catch (e) {
                    console.warn('⚠️ 解析存儲的引用數據失敗:', e);
                    references = [];
                }
            } else {
                console.log('📚 沒有存儲的引用數據，使用空數組');
            }

            // 生成動態識別碼
            const code = this.generateSessionCode({
                originalQuestion: question,
                thinking: thinking,
                references: references
            });

            console.log('🏁 最終階段顯示識別碼:', code, '，引用來源數量:', references.length);
            
            // 強制顯示識別碼，不管 hasShownSessionId 的狀態
            this.forceShowSessionCode(responseDiv, code);
            
            console.log('🏁 displaySessionCodeWhenReady 完成 - 時間:', new Date().toISOString());
            
        } catch (error) {
            console.error('❌ displaySessionCodeWhenReady 錯誤:', error);
            console.error('❌ 錯誤堆棧:', error.stack);
        }
    }

    // 新增：Case E 專用 - 與引用來源同時顯示識別碼
    showFinalSessionCodeWithReferences(responseDiv, question, enhancedReferences) {
        try {
            console.log('🎯 [Case E] 與引用來源同時顯示識別碼');
            
            // 存儲思考數據到 responseDiv，供識別碼生成使用
            responseDiv.dataset.thinking = JSON.stringify(true); // Case E 有思考過程
            
            // 存儲增強後的引用數據到 responseDiv，供識別碼生成使用
            const finalReferences = enhancedReferences || [];
            responseDiv.dataset.references = JSON.stringify(finalReferences);
            console.log('💾 [Case E] 存儲增強後的引用數據到responseDiv，數量:', finalReferences.length);
            
            // 清除載入狀態
            const loadingContainer = responseDiv.querySelector('.response-section .response-content');
            if (loadingContainer) {
                console.log('🧹 [Case E] 清除載入狀態');
                this.clearAnswerProcessing(loadingContainer);
            }
            
            // 直接顯示識別碼，不需要延遲
            this.displaySessionCodeWhenReady(responseDiv, question);
            
        } catch (error) {
            console.error('❌ [Case E] 與引用來源同時顯示識別碼時發生錯誤:', error);
        }
    }

    // 強制顯示識別碼（忽略 hasShownSessionId 檢查）
    forceShowSessionCode(responseDiv, code) {
        console.log('🔧 [Case C] 強制顯示識別碼開始, code:', code);
        
        const messageContent = responseDiv.querySelector('.message-content');
        if (!messageContent) {
            console.error('❌ 找不到 message-content 容器');
            console.error('❌ responseDiv 結構:', responseDiv.outerHTML.substring(0, 200) + '...');
            return;
        }
        
        console.log('✅ [Case C] 找到 message-content 容器');

        // 檢查當前 DOM 結構
        const currentStructure = Array.from(messageContent.children).map(child => {
            return {
                className: child.className,
                type: child.classList.contains('message-header') ? 'header' :
                      child.classList.contains('thinking-section') ? 'thinking' :
                      child.classList.contains('response-section') ? 'answer' :
                      child.classList.contains('references-section') ? 'references' :
                      child.classList.contains('session-code-section') ? 'session-code' :
                      child.classList.contains('session-id-display') ? 'session-id' : 'unknown'
            };
        });
        
        console.log('📋 [Case C] 當前 DOM 結構:', currentStructure);
        
        // 檢查是否已經有識別碼存在，如果有則移除
        const existingSessionDiv = messageContent.querySelector('.session-code-section, .session-id-display');
        if (existingSessionDiv) {
            existingSessionDiv.remove();
            console.log('🗑️ 移除已存在的識別碼');
        }
        
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'session-code-section';
        sessionDiv.innerHTML = `
            <div class="session-code-display">
                <i class="fas fa-id-card"></i>
                <span class="code-label">識別碼：</span>
                <span class="session-code-text">${code}</span>
                <button class="copy-code-btn" id="copy-btn-${code}" onclick="window.chatApp.copySessionCode('${code}', this)" title="複製識別碼">
                    <i class="fas fa-copy"></i>
                    <span class="copy-btn-text">複製識別碼</span>
                </button>
            </div>
            <div class="survey-return-notice">
                <i class="fas fa-external-link-alt"></i>
                <span>點擊以下連結，即可返回問卷繼續填答：</span>
                <a href="https://www.surveycake.com/s/XYOg0" target="_blank" class="survey-link">
                    https://www.surveycake.com/s/XYOg0
                </a>
                <div class="survey-note">
                    如果遇到問卷網頁跳轉回歡迎頁面，請點擊「開始」後繼續填答即可
                </div>
            </div>
        `;
        
        console.log('📋 [Case C] 識別碼 HTML 已創建');
        
        // 確保識別碼在回答區之後顯示
        try {
            this.ensureSessionCodeBelowAnswer(messageContent, sessionDiv);
            console.log('✅ [Case C] ensureSessionCodeBelowAnswer 完成');
        } catch (error) {
            console.error('❌ ensureSessionCodeBelowAnswer 失敗，直接 append:', error);
            // 如果排序失敗，直接添加到最後
            messageContent.appendChild(sessionDiv);
        }
        
        this.hasShownSessionId = true;
        
        // 驗證識別碼確實被添加到 DOM 中
        const verifySessionDiv = messageContent.querySelector('.session-code-section');
        if (verifySessionDiv) {
            console.log('✅ [Case C] 強制顯示識別碼完成並驗證成功');
            
            // 記錄最終的 DOM 結構
            const finalStructure = Array.from(messageContent.children).map(child => {
                return child.classList.contains('message-header') ? 'header' :
                       child.classList.contains('thinking-section') ? 'thinking' :
                       child.classList.contains('response-section') ? 'answer' :
                       child.classList.contains('references-section') ? 'references' :
                       child.classList.contains('session-code-section') ? 'session-code' :
                       child.classList.contains('session-id-display') ? 'session-id' : 'unknown';
            });
            console.log('📋 [Case C] 最終 DOM 結構順序:', finalStructure);
            
        } else {
            console.error('❌ [Case C] 識別碼驗證失敗，未在 DOM 中找到');
        }
    }

    // 新增：顯示答案處理中狀態
    showAnswerProcessing(container) {
        if (!container) return;
        
        container.innerHTML = `
            <div class="processing-indicator">
                <div class="processing-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <span class="processing-text">正在處理答案...</span>
            </div>
        `;
    }

    // 新增：清除答案處理中狀態
    clearAnswerProcessing(container) {
        if (!container) return;
        
        const processingIndicator = container.querySelector('.processing-indicator');
        if (processingIndicator) {
            processingIndicator.remove();
        }
    }

    // 新增：顯示來源處理載入提示
    showSourceProcessingLoader(responseDiv) {
        console.log('🔧 [Debug] showSourceProcessingLoader 被調用，responseDiv:', !!responseDiv);
        
        if (!responseDiv) {
            console.error('❌ [Debug] responseDiv 為空，無法顯示載入提示');
            return;
        }
        
        // 移除現有的來源載入提示
        this.removeSourceProcessingLoader(responseDiv);
        
        // 創建來源處理載入提示
        const sourceLoader = document.createElement('div');
        sourceLoader.className = 'source-processing-loader';
        sourceLoader.innerHTML = `
            <div class="source-processing-indicator">
                <div class="source-processing-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <span class="source-processing-text">正在整理引用來源...</span>
            </div>
        `;
        
        // 添加到回應容器的末尾
        const messageContent = responseDiv.querySelector('.message-content') || responseDiv;
        console.log('🔧 [Debug] messageContent 找到:', !!messageContent);
        
        messageContent.appendChild(sourceLoader);
        
        console.log('✅ [Debug] 載入提示已添加到 DOM');
        console.log('🔄 [Case F] 已顯示來源處理載入提示');
        this.scrollToBottom();
    }

    // 新增：移除來源處理載入提示
    removeSourceProcessingLoader(responseDiv) {
        if (!responseDiv) return;
        
        const sourceLoader = responseDiv.querySelector('.source-processing-loader');
        if (sourceLoader) {
            sourceLoader.remove();
            console.log('✅ [Case F] 已移除來源處理載入提示');
        }
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
                // 答案內容
                hasAnswer = true;
                // 在串流模式下直接處理答案內容
                const answerContainer = ctx.ensureAnswerContainer();
                if (answerContainer) {
                    const cleanedChunk = this.cleanCompleteText(piece.text);
                    const formattedChunk = this.formatResponseChunk(cleanedChunk);
                    answerContainer.innerHTML += formattedChunk;
                    this.scrollToBottom();
                }
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
            const translatedContent = await this.translateWithQueue(content);
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

    // Case C 翻譯隊列管理 - 每次翻譯等待2秒，並累積排隊延遲
    async translateWithQueue(text) {
        const currentTime = Date.now();
        
        // 計算這次翻譯應該開始的時間
        const translationStartTime = Math.max(currentTime, this.nextTranslationTime);
        
        // 更新下次翻譯的時間（當前開始時間 + 2秒）
        this.nextTranslationTime = translationStartTime + 2000;
        
        // 計算需要等待的時間
        const waitTime = translationStartTime - currentTime;
        
        console.log(`🔄 翻譯隊列: 需等待 ${waitTime}ms, 下次翻譯時間: ${new Date(this.nextTranslationTime).toLocaleTimeString()}`);
        
        // 等待到指定時間
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // 執行翻譯
        return await this.translateText(text);
    }

    async translateText(text) {
        try {
            const response = await fetch(`${this.workerUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,  // Worker 期待的參數名稱
                    target: 'zh-TW'  // 修正：使用 target 而不是 targetLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`翻譯請求失敗: ${response.status}`);
            }

            const result = await response.json();
            // 移除翻譯 API 詳細回應日誌
            
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

    // 語言檢測函數 - 修正版本（直接翻譯並檢查 detectedSourceLanguage）
    async detectLanguage(text) {
        try {
            const response = await fetch(`${this.workerUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: 'zh-TW'  // 只指定目標語言，讓API自動檢測來源語言
                })
            });

            if (!response.ok) {
                console.warn('語言檢測請求失敗:', response.status);
                return 'unknown';
            }

            const result = await response.json();
            
            if (result.data && result.data.translations && result.data.translations[0]) {
                const detectedLang = result.data.translations[0].detectedSourceLanguage || 'unknown';
                console.log('🔍 檢測到語言:', detectedLang, '內容預覽:', text.substring(0, 30) + '...');
                return detectedLang;
            }
            
            return 'unknown';
        } catch (error) {
            console.warn('語言檢測錯誤:', error);
            return 'unknown';
        }
    }

    // 檢查是否為英文內容 - 簡化版本（像 Case C 一樣直接翻譯檢測）
    async isEnglishContent(text) {
        if (!text || text.trim().length < 3) {
            return false; // 太短的文本不過濾
        }
        
        // 計算中文字符比例
        const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
        const chineseMatches = text.match(chineseRegex);
        const chineseCharCount = chineseMatches ? chineseMatches.length : 0;
        
        // 計算總字符數（排除空白字符）
        const totalChars = text.replace(/\s/g, '').length;
        
        if (totalChars === 0) {
            return false; // 空內容不過濾
        }
        
        // 計算中文字符比例
        const chineseRatio = chineseCharCount / totalChars;
        
        console.log(`📊 文本分析 - 總字符: ${totalChars}, 中文字符: ${chineseCharCount}, 中文比例: ${(chineseRatio * 100).toFixed(1)}%`);
        
        // 如果中文字符比例超過50%，視為中文內容，應該顯示
        if (chineseRatio > 0.5) {
            console.log('✅ 中文比例 > 50%，顯示內容:', text.substring(0, 50) + '...');
            return false; // 不是英文，應該顯示
        }
        
        // 如果中文比例較低，再用翻譯API進一步檢測語言
        try {
            const detectedLang = await this.detectLanguage(text);
            const isEnglish = detectedLang === 'en' || detectedLang === 'english' || detectedLang.startsWith('en');
            
            if (isEnglish) {
                console.log('🚫 API檢測為英文思考內容，過濾:', text.substring(0, 50) + '...');
                return true;
            } else {
                console.log('✅ API檢測為非英文內容，顯示:', text.substring(0, 50) + '...');
                return false;
            }
        } catch (error) {
            console.warn('語言檢測失敗，基於中文比例判斷:', error);
            // API 失敗時，基於中文比例判斷：如果有中文字符且比例 > 10%，則顯示
            if (chineseRatio > 0.1) {
                console.log('✅ 中文比例 > 10%，顯示內容（API失敗降級）');
                return false; // 顯示
            } else {
                console.log('🚫 中文比例過低，過濾內容（API失敗降級）');
                return true; // 過濾
            }
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
                // 識別碼將在主流程結束後統一顯示
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
                // 完整清理註腳編號和參考資料列表並格式化答案
                const cleanedAnswer = this.cleanCompleteText(result.answer);
                const formattedAnswer = this.formatResponse(cleanedAnswer);
                answerContainer.innerHTML = formattedAnswer;
                this.scrollToBottom();
            } else {
                console.warn('⚠️ 沒有收到答案內容');
            }

            // 顯示引用來源（採用 Case A 的邏輯：≥10 才顯示）
            if (result.references && result.references.length >= 10) {
                console.log('📚 [Case C] 顯示引用來源:', result.references.length, '個');
                console.log('✅ [Case C] 使用緊湊格式顯示引用區塊');
                this.displayEnhancedReferences(result.references, responseDiv, 0); // 0 表示沒有虛擬引用
            } else {
                const count = result.references?.length || 0;
                console.log(`❌ [Case C] 引用來源數量 ${count} < 10，隱藏引用區塊`);
            }

            // 生成並顯示識別碼（移到回答區下方）
            const code = this.generateSessionCode({
                originalQuestion: question,
                thinking: this.showThinkingCheckbox?.checked,
                references: result.references || []
            });
            // 識別碼將在主流程結束後統一顯示

        } catch (error) {
            console.error('❌ 完整答案請求錯誤:', error);
            this.showErrorInResponse(responseDiv, `獲取完整答案時發生錯誤: ${error.message}`);
        }
    }

    extractReferences(groundingMetadata) {
        const references = [];
        const seenUrls = new Set();

        console.log('=== [Case C] 提取引用來源詳細信息 ===');
        console.log('[Case C] groundingSupports 數量:', groundingMetadata.groundingSupports?.length || 0);
        console.log('[Case C] groundingChunks 數量:', groundingMetadata.groundingChunks?.length || 0);

        // 檢查 groundingChunks 是否存在且有內容
        if (!groundingMetadata.groundingChunks || groundingMetadata.groundingChunks.length === 0) {
            console.log('⚠️ [Case C] 沒有 groundingChunks 或 groundingChunks 為空');
            return references; // 返回空數組
        }

        // 直接從 groundingChunks 提取所有有效的 web 引用
        groundingMetadata.groundingChunks.forEach((chunk, index) => {
            if (chunk && chunk.web) {
                const url = chunk.web.uri;
                const title = chunk.web.title || 'Untitled';
                
                if (url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    references.push({
                        title: title,
                        url: url,
                        uri: url,
                        snippet: ''
                    });
                    console.log(`✅ [Case C] 添加引用 ${references.length}: ${title}`);
                } else if (url && seenUrls.has(url)) {
                    console.log(`⚠️ [Case C] 重複的 URL，已跳過`);
                }
            }
        });

        console.log(`📋 [Case C] 最終提取到 ${references.length} 個有效引用來源`);
        return references;
    }

    cleanFootnotesFromText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // 第一步：移除文本中的所有註腳編號 [1], [2], [3] 等（包括連續的如 [1][2]）
        // 多重清理策略，確保移除所有可能的註腳格式
        // 1. 移除單個註腳 [1], [2], [3] 等
        cleaned = cleaned.replace(/\[\d+\]/g, '');
        // 2. 移除連續註腳 [1][2][3] 等
        cleaned = cleaned.replace(/(\[\d+\])+/g, '');
        // 3. 移除帶空格的註腳 [ 1 ], [ 2 ] 等
        cleaned = cleaned.replace(/\[\s*\d+\s*\]/g, '');
        // 4. 移除可能的註腳變體（加強版）
        cleaned = cleaned.replace(/\[(\d+)\]/g, '');
        // 5. 移除任何剩餘的數字方括號組合
        cleaned = cleaned.replace(/\[[\d\s,]+\]/g, '');
        
        return cleaned;
    }

    // 檢查文本是否包含參考來源關鍵字
    containsReferenceKeywords(text) {
        if (!text) return false;
        
        // 調試：記錄檢查的文本
        if (text.includes('參考資料') || text.includes('引用來源')) {
            console.log('🔍 [Debug] containsReferenceKeywords 檢查文本:', JSON.stringify(text.substring(0, 300)));
        }
        
        // 檢查各種參考來源標記模式
        const referencePatterns = [
            /參考資料[：:]/,
            /引用資料[：:]/,
            /引用來源[：:]/,
            /參考來源[：:]/,
            /參考資料來源[：:]/,
            /\*\*參考資料[：:]\*\*/,
            /\*\*引用來源[：:]\*\*/,
            /\*\*參考來源[：:]\*\*/,
            /\*\*參考資料來源[：:]\*\*/,
            /\*\*引用資料[：:]\*\*/
        ];
        
        const matched = referencePatterns.some(pattern => {
            const result = pattern.test(text);
            if (result) {
                console.log('✅ [Debug] 匹配到模式:', pattern, '在文本中');
            }
            return result;
        });
        
        if (!matched && (text.includes('參考資料') || text.includes('引用來源'))) {
            console.log('⚠️ [Debug] 包含關鍵字但未匹配到模式');
        }
        
        return matched;
    }

    // 新增：分離混合內容，提取參考資料前的有效內容
    separateMixedContent(text) {
        if (!text) return { beforeReference: '', hasReference: false };
        
        // 使用與 cleanReferenceListFromText 相同的邏輯
        // 定義參考資料標記模式，精確匹配分隔符
        const referencePatterns = [
            // 帶分隔符的標記（--- 開頭）
            /^([\s\S]*?)(\n---\s*\n?\s*\*\*參考資料[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n---\s*\n?\s*\*\*引用來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n---\s*\n?\s*\*\*參考來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n---\s*\n?\s*\*\*參考資料來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n---\s*\n?\s*\*\*引用資料[：:]\*\*[\s\S]*)$/,
            
            // 純標記模式（\n\n 分隔符 + 粗體標記）
            /^([\s\S]*?)(\n\n\*\*參考資料[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\n\*\*引用來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\n\*\*參考來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\n\*\*參考資料來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\n\*\*引用資料[：:]\*\*[\s\S]*)$/,
            
            // 單換行 + 粗體標記
            /^([\s\S]*?)(\n\*\*參考資料[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\*\*引用來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\*\*參考來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\*\*參考資料來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\n\*\*引用資料[：:]\*\*[\s\S]*)$/,
            
            // 無分隔符的標記（但要求前面有換行）
            /^([\s\S]*?)(\n\s*參考資料[：:][\s\S]*)$/,
            /^([\s\S]*?)(\n\s*引用來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(\n\s*參考來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(\n\s*參考資料來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(\n\s*引用資料[：:][\s\S]*)$/,
            
            // 直接開始的粗體標記（沒有前置換行）
            /^([\s\S]*?)(\*\*參考資料[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\*\*引用來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\*\*參考來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\*\*參考資料來源[：:]\*\*[\s\S]*)$/,
            /^([\s\S]*?)(\*\*引用資料[：:]\*\*[\s\S]*)$/,
            
            // 直接開始的普通標記（沒有前置換行）
            /^([\s\S]*?)(參考資料[：:][\s\S]*)$/,
            /^([\s\S]*?)(引用來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(參考來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(參考資料來源[：:][\s\S]*)$/,
            /^([\s\S]*?)(引用資料[：:][\s\S]*)$/
        ];
        
        // 嘗試匹配並分離內容
        for (const pattern of referencePatterns) {
            const match = text.match(pattern);
            if (match) {
                const beforeReference = match[1].trim();
                console.log('🔍 [separateMixedContent] 找到參考標記，保留前文:', beforeReference.substring(Math.max(0, beforeReference.length - 50)));
                return {
                    beforeReference: beforeReference,
                    hasReference: true
                };
            }
        }
        
        // 如果沒有找到參考資料標記，檢查是否整個文本都是參考資料
        if (this.containsReferenceKeywords(text)) {
            const isOnlyReference = /^\s*(\*\*)?參考資料來源?[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?引用來源[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?參考來源[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?引用資料[：:]/.test(text.trim());
            
            if (isOnlyReference) {
                console.log('🔍 [separateMixedContent] 整個文本都是參考資料');
                return {
                    beforeReference: '',
                    hasReference: true
                };
            }
        }
        
        // 沒有參考資料標記
        return {
            beforeReference: text,
            hasReference: false
        };
    }

    cleanReferenceListFromText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // 更精確的參考資料分離邏輯：保留參考標記前的正文內容
        // 定義參考資料標記模式，確保只從分隔符開始清理
        const referencePatterns = [
            // 帶分隔符的標記（--- 開頭）
            /(\n|^)---\s*\n?\s*\*\*參考資料[：:]\*\*[\s\S]*$/m,
            /(\n|^)---\s*\n?\s*\*\*引用來源[：:]\*\*[\s\S]*$/m,
            /(\n|^)---\s*\n?\s*\*\*參考來源[：:]\*\*[\s\S]*$/m,
            /(\n|^)---\s*\n?\s*\*\*參考資料來源[：:]\*\*[\s\S]*$/m,
            /(\n|^)---\s*\n?\s*\*\*引用資料[：:]\*\*[\s\S]*$/m,
            
            // 純標記模式（\n\n 分隔符 + 粗體標記）
            /(\n\n|\n)\*\*參考資料[：:]\*\*[\s\S]*$/m,
            /(\n\n|\n)\*\*引用來源[：:]\*\*[\s\S]*$/m,
            /(\n\n|\n)\*\*參考來源[：:]\*\*[\s\S]*$/m,
            /(\n\n|\n)\*\*參考資料來源[：:]\*\*[\s\S]*$/m,
            /(\n\n|\n)\*\*引用資料[：:]\*\*[\s\S]*$/m,
            
            // 無分隔符的標記（但要求前面有換行）
            /(\n)\s*參考資料[：:][\s\S]*$/m,
            /(\n)\s*引用來源[：:][\s\S]*$/m,
            /(\n)\s*參考來源[：:][\s\S]*$/m,
            /(\n)\s*參考資料來源[：:][\s\S]*$/m,
            /(\n)\s*引用資料[：:][\s\S]*$/m
        ];
        
        // 嘗試每個模式進行匹配和清理
        for (const pattern of referencePatterns) {
            const match = text.match(pattern);
            if (match) {
                // 找到匹配，提取參考標記之前的內容
                const beforeReference = text.substring(0, match.index + (match[1] ? match[1].length : 0));
                cleaned = beforeReference.trim();
                console.log('🧹 [cleanReferenceListFromText] 找到參考標記，保留前文:', cleaned.substring(Math.max(0, cleaned.length - 50)));
                break;
            }
        }
        
        // 如果沒有找到明確的分隔符，但整個文本都是參考資料格式，則返回空
        if (cleaned === text) {
            // 檢查是否整個文本都是參考資料
            const isOnlyReference = /^\s*(\*\*)?參考資料來源?[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?引用來源[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?參考來源[：:]/.test(text.trim()) ||
                                  /^\s*(\*\*)?引用資料[：:]/.test(text.trim());
            
            if (isOnlyReference) {
                cleaned = '';
                console.log('🧹 [cleanReferenceListFromText] 整個文本都是參考資料，清空');
            }
        }
        
        // 第三步：清理可能產生的多餘空白和換行
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        
        return cleaned;
    }

    // 統一的文本清理方法，結合註腳和參考資料列表清理
    cleanCompleteText(text) {
        if (!text) return '';
        
        // 移除詳細文本清理日誌
        
        // 第一步：移除註腳編號
        let cleaned = this.cleanFootnotesFromText(text);
        
        // 第二步：移除參考資料列表
        cleaned = this.cleanReferenceListFromText(cleaned);
        
        // 移除詳細清理日誌
        
        return cleaned;
    }

    formatResponseChunk(chunk) {
        if (!chunk) return '';
        
        // 處理 Markdown 格式 - 即時處理每個chunk
        let formatted = chunk;
        
        // 移除 Markdown 標題符號 ### ## #
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 先處理粗體文字 **text** - 在轉換HTML之前
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<!BOLD!>$1<!ENDBOLD!>');
        
        // 先保護項目符號列表的星號 (行首的 * 空格)
        formatted = formatted.replace(/^\*\s/gm, '<!LISTBULLET!> ');
        
        // 移除斜體格式 *text* - 只保留文字內容
        formatted = formatted.replace(/\*(.*?)\*/g, '$1');
        
        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 恢復粗體文字標記
        formatted = formatted.replace(/&lt;!BOLD!&gt;(.*?)&lt;!ENDBOLD!&gt;/g, '<strong>$1</strong>');
        
        // 恢復項目符號列表
        formatted = formatted.replace(/&lt;!LISTBULLET!&gt;/g, '<span style="color: #666;">•</span>');
        
        // 處理數字列表
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');
        
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

    formatStandardReferences(references) {
        if (!references || references.length === 0) return '';
        
        return references.map((ref, index) => {
            const refData = ref.web || ref; // 兼容不同的數據格式
            return `
                <div class="reference-item compact" id="ref-${index + 1}">
                    <div class="reference-number">${index + 1}</div>
                    <div class="reference-details">
                        <a href="${refData.uri || refData.url}" target="_blank" rel="noopener noreferrer" class="reference-title">
                            ${this.escapeHtml(refData.title)}
                        </a>
                    </div>
                </div>
            `;
        }).join('');
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
                ${references.map((ref, index) => {
                    const refData = ref.web || ref; // 兼容不同的數據格式
                    const title = refData.title || 'Untitled';
                    return `
                        <div class="reference-item compact">
                            <div class="reference-number">${index + 1}</div>
                            <div class="reference-details">
                                <a href="${refData.uri || refData.url}" target="_blank" rel="noopener noreferrer" title="${this.escapeHtml(title)}">
                                    ${this.escapeHtml(title.length > 80 ? title.substring(0, 77) + '...' : title)}
                                </a>
                            </div>
                        </div>
                    `;
                }).join('')}
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

    // Markdown 格式處理
    formatMarkdown(text) {
        if (!text) return '';
        
        let html = this.escapeHtml(text);
        
        // 處理標題
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // 處理粗體
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // 處理斜體
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // 處理換行
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // 包裹段落
        if (html.includes('<br>') || html.includes('<h') || html.includes('<strong>')) {
            html = '<p>' + html + '</p>';
            // 清理多餘的段落標籤
            html = html.replace(/<p><\/p>/g, '');
            html = html.replace(/<p>(<h[1-6]>)/g, '$1');
            html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
        }
        
        return html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 檢查是否為可重試的 API 錯誤
    isRetryableApiError(error) {
        if (!error || !error.message) return false;
        
        const errorMessage = error.message.toLowerCase();
        
        // 檢查常見的 API 錯誤模式
        const retryablePatterns = [
            // Gemini API 錯誤
            /gemini.*api.*error.*5\d{2}/i,
            /gemini.*streaming.*api.*error.*5\d{2}/i,
            /524.*error code.*524/i,
            /503.*service unavailable/i,
            /502.*bad gateway/i,
            /504.*gateway timeout/i,
            /500.*internal server error/i,
            
            // 通用 API 錯誤
            /internal server error/i,
            /service unavailable/i,
            /bad gateway/i,
            /gateway timeout/i,
            
            // 網路相關錯誤
            /network.*error/i,
            /connection.*error/i,
            /timeout/i,
            /fetch.*failed/i
        ];
        
        return retryablePatterns.some(pattern => pattern.test(errorMessage));
    }

    toggleThinkingSection(thinkingId) {
        const thinkingContent = document.getElementById(thinkingId);
        const toggleIcon = thinkingContent.closest('.thinking-section').querySelector('.thinking-toggle-icon');
        
        if (thinkingContent.style.display === 'none') {
            thinkingContent.style.display = 'block';
            toggleIcon.className = 'fas fa-chevron-down thinking-toggle-icon';
        } else {
            thinkingContent.style.display = 'none';
            toggleIcon.className = 'fas fa-chevron-right thinking-toggle-icon';
        }
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM 載入完成，初始化 StreamingChatApp...');
    try {
        window.chatAppStreaming = new StreamingChatApp();
        window.chatApp = window.chatAppStreaming; // 保持向後兼容
        console.log('✅ StreamingChatApp 初始化成功');
    } catch (error) {
        console.error('❌ StreamingChatApp 初始化失敗:', error);
    }
});
