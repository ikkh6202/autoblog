// ✅ 저작권 정보 추가
// Copyright (c) 2024 kimcoding.co.kr
// MIT License - https://kimcoding.co.kr

// ChatGPT 자동 실행 + 블로그 제목/본문/사용자 프롬프트 복사 붙혀넣기 기능
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "injectPrompt") {
        const inputSelector = 'div[contenteditable="true"]';
        const maxRetries = 15;
        let retryCount = 0;

        const tryInput = () => {
            const inputBox = document.querySelector(inputSelector);
            if (inputBox) {
                inputBox.focus();
                document.execCommand("insertText", false, request.text);

                setTimeout(() => {
                    const enterEvent = new KeyboardEvent("keydown", {
                        bubbles: true,
                        cancelable: true,
                        key: "Enter",
                        code: "Enter",
                        which: 13,
                        keyCode: 13
                    });
                    inputBox.dispatchEvent(enterEvent);
                    console.log("✅ ChatGPT 입력 후 엔터 실행 완료!");

                    setTimeout(() => {
                        forceScrollToBottom();
                    }, 4000);

                    sendResponse({ success: true });
                }, 1000);
            } else if (retryCount < maxRetries) {
                retryCount++;
                console.warn(`⏳ 입력창을 찾을 수 없습니다. 재시도 중... (${retryCount}/${maxRetries})`);
                setTimeout(tryInput, 500);
            } else {
                console.error("❌ ChatGPT 입력 필드를 찾을 수 없습니다.");
                sendResponse({ success: false });
            }
        };

        tryInput();
        return true;
    }
});

// 채팅창 컨테이너를 찾아 강제 스크롤하는 함수
function forceScrollToBottom() {
    console.log("⏳ 페이지 맨 아래로 스크롤 중...");

    const selectors = [
        "div[class*='react-scroll-to-bottom'] > div",
        "div[class*='chat-scroll']",
        "main div[tabindex='0']",
        "div[class='flex h-full flex-col overflow-y-auto [scrollbar-gutter:stable]']"
    ];

    let chatContainer = null;
    for (const selector of selectors) {
        chatContainer = document.querySelector(selector);
        if (chatContainer) break;
    }

    if (chatContainer) {
        console.log("✅ 올바른 채팅 컨테이너 찾음:", chatContainer);

        let attempts = 0;
        let scrollInterval = setInterval(() => {
            let copyButton = document.querySelector("button[aria-label='복사'][data-testid='copy-turn-action-button']");
            
            if (copyButton) {
                console.log("✅ 복사 버튼 발견! 스크롤 중단 및 클릭 실행...");
                clearInterval(scrollInterval);
                clickCopyButton();
                return;
            }

            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
            console.log(`⬇️ 스크롤 진행 중... (${attempts + 1}/150)`);

            attempts++;
            if (attempts >= 150) {
                clearInterval(scrollInterval);
                console.log("✅ 페이지 맨 아래로 스크롤 완료!");
            }
        }, 500);
    } else {
        console.error("❌ 올바른 ChatGPT 채팅 컨테이너를 찾을 수 없습니다.");
    }
}

// 복사 버튼 클릭 및 HTML 서식 복사 기능
function clickCopyButton() {
    console.log("🔹 복사 버튼 클릭 실행...");

    let copyButton = document.querySelector("button[aria-label='복사'][data-testid='copy-turn-action-button']");

    if (copyButton) {
        console.log("✅ 복사 버튼 발견! 강제 클릭 실행...");

        copyButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        copyButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

        console.log("✅ 마크다운 복사 버튼 클릭 완료!");

        setTimeout(copyHtmlContent, 1000);
    } else {
        console.error("❌ 복사 버튼을 찾을 수 없습니다.");
    }
}

// HTML 서식 유지한 채 클립보드 저장 및 복사
async function copyHtmlContent() {
    console.log("📋 HTML 서식 유지 복사 실행...");

    const chatContent = document.querySelector("div[class*='prose']");

    if (chatContent) {
        console.log("✅ 채팅 내용 가져오기 성공!", chatContent.innerHTML);

        try {
            console.log("✅ 마크다운 클립보드에 복사 완료");
        } catch (err) {
            console.error("❌ 클립보드 저장 실패:", err);
        }
    } else {
        console.error("❌ 채팅 내용을 찾을 수 없습니다.");
    }
}

