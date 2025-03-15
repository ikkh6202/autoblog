// ✅ 저작권 정보 추가
// Copyright (c) 2024 kimcoding.co.kr
// MIT License - https://kimcoding.co.kr

// ✅ 유튜브 [ai자동화 복붙코딩]이 제작한 것으로 임의 수정 배포하시면 안됩니다.




// ✅ 메시지 리스너 수정
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📩 받은 메시지:", request);

    if (request.action === "generateText") {
        const model = request.model; // ✅ 모델 값 받아오기
        console.log("🛠 API 호출 - 선택된 모델:", model); // ✅ 모델 값 로그 확인

        chrome.storage.local.get(`${model}ApiKey`, (data) => {
            const apiKey = data[`${model}ApiKey`];
            if (!apiKey) {
                sendResponse({ success: false, text: "🚨 API 키가 설정되지 않았습니다!" });
                return;
            }

            callModelAPI(request.prompt, model, apiKey, sendResponse);
        });
        return true; // ✅ 비동기 응답을 위해 true 반환
    }

    if (request.action === "convertMarkdownToWord") {
        convertMarkdownToWord(request.content, sendResponse);
        return true;
    }

    if (request.action === "applyTextStyles") {
        applyTextStyles(sendResponse);
        return true;
    }

    if (request.action === "prepareDocxFile") {
        prepareDocxFile(sendResponse);
        return true;
    }
});





// ✅ 언어 모델별 API 호출
async function callModelAPI(prompt, model, apiKey, sendResponse) {
    let apiUrl, requestBody, headers;

    console.log("📡 API 요청 모델:", model); // ✅ 모델 로그 추가

    if (model === "gemini") {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`;
        requestBody = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        // ✅ Gemini는 "x-goog-api-key" 사용
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        };

    } else if (model === "deepseek") {
        apiUrl = `https://openrouter.ai/api/v1/chat/completions`;
        requestBody = {
            model: "deepseek/deepseek-r1:free",
            messages: [{ role: "user", content: prompt }]
        };

        // ✅ DeepSeek & Qwen은 "Authorization: Bearer ..." 사용
        headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

    } else if (model === "deepseek_v3") { // ✅ DeepSeek AI V3 추가됨
        apiUrl = `https://openrouter.ai/api/v1/chat/completions`;
        requestBody = {
            model: "deepseek/deepseek-chat:free",
            messages: [{ role: "user", content: prompt }]
        };

        headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

    } else if (model === "qwen") {
        apiUrl = `https://openrouter.ai/api/v1/chat/completions`;
        requestBody = {
            model: "qwen/qwen2.5-vl-72b-instruct:free",
            messages: [{ role: "user", content: prompt }]
        };

        headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

    } else if (model === "gpt-4o" || model === "gpt-4o-mini" || model === "gpt-4-turbo" || model === "gpt-3.5-turbo") {
        apiUrl = "https://api.openai.com/v1/chat/completions";
        
        requestBody = {
            model: model, // 선택한 모델 값 그대로 사용
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3, // ✅ 더 일관된 응답을 위해 값 조정
            max_tokens: 2000 // ✅ 응답 길이를 2000자로 제한 (원하는 길이 설정 가능)
        };
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };
    }
    else {
        sendResponse({ success: false, text: "🚨 지원되지 않는 모델입니다." });
        return;
    }

    try {
        console.log("📡 API 요청 헤더:", headers); // ✅ 헤더 확인 로그 추가
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log("📩 API 응답:", data); // ✅ 응답 확인

        if (model === "gemini" && data.candidates && data.candidates.length > 0) {
            sendResponse({ success: true, text: data.candidates[0].content.parts[0].text });
        } else if (data.choices && data.choices.length > 0) {
            sendResponse({ success: true, text: data.choices[0].message.content });
        } else {
            sendResponse({ success: false, text: "응답이 없습니다." });
        }
    } catch (error) {
        console.error("API 오류:", error);
        sendResponse({ success: false, text: "API 요청 중 오류 발생" });
    }
}







// ✅ Markdown → Word 변환 (저장 1번만 실행)
function convertMarkdownToWord(markdownText, sendResponse) {
    if (!markdownText) {
        sendResponse({ success: false, error: "Markdown 내용이 없습니다." });
        return;
    }

    // ✅ **저장은 여기서만 실행!**
    chrome.storage.local.set({ convertedText: markdownText }, () => {
        console.log("✅ Markdown 저장 완료:", markdownText);
        sendResponse({ success: true });
    });
}

// ✅ 텍스트 스타일 적용 (저장 X → 변환된 데이터만 반환)
function applyTextStyles(sendResponse) {
    chrome.storage.local.get("convertedText", (data) => {
        if (!data.convertedText) {
            sendResponse({ success: false, error: "변환된 Markdown 데이터가 없습니다." });
            return;
        }

        let modifiedText = data.convertedText;

        // ** 굵은 텍스트 처리 **
        modifiedText = modifiedText.replace(/\*\*(.*?)\*\*/g, (_, match) => `__${match}__`);
        
        // 📌 '*   ' 리스트 스타일 적용
        modifiedText = modifiedText.replace(/\*   /g, "• ");

        console.log("✅ 스타일 적용 완료:", modifiedText);
        sendResponse({ success: true, styledText: modifiedText });
    });
}

// ✅ Word 파일 변환 (저장 X → 가져오기만 함)
function prepareDocxFile(sendResponse) {
    chrome.storage.local.get("convertedText", (data) => {
        if (!data.convertedText) {
            sendResponse({ success: false, error: "변환된 Markdown 데이터가 없습니다." });
            return;
        }

        console.log("📂 Word 변환 준비 완료!");
        sendResponse({ success: true, fileData: data.convertedText });
    });
}


// ✅ 페이지 이미지 다운로드(네이버 + 티스토리 + 블로그스팟 + 브런치스토리 + 워드프레스 + 쿠팡)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadImages") {
        let images = request.images;
        let pageTitle = request.title;

        if (!images.length) {
            console.log("❌ 다운로드할 이미지가 없습니다.");
            return;
        }

        images.forEach((url, index) => {
            let filename = `${pageTitle.replace(/[^a-zA-Z0-9가-힣]/g, "_")}_image_${index + 1}.jpg`;
        
            if (url.includes("coupangcdn.com")) {
                filename = `Coupang_${filename}`;
            } else if (url.includes("wp-content/uploads") || url.includes("ctfassets.net")) {
                filename = `WordPress_${filename}`;
            } else if (url.includes("daumcdn.net") && url.includes("brunch")) {
                filename = `Brunch_${filename}`;
            } else if (url.includes("kakaocdn.net") || url.includes("daumcdn.net")) {
                filename = `Tistory_${filename}`;
            } else if (url.includes("blogger.googleusercontent.com")) {
                filename = `Blogger_${filename}`;
            } else {
                filename = `Naver_${filename}`;
            }

            chrome.downloads.download({ url: url, filename: filename });
        });

        console.log("📥 이미지 다운로드 시작:", pageTitle);
    }
});









// ✅ ChatGPT 자동 실행 + 블로그 제목/본문/사용자 프롬프트 복사 붙혀넣기 기능 추가
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openChatGPT") {
        // ✅ 저장된 사용자 선택 URL 가져오기
        chrome.storage.local.get(["selectedChatGPT"], (data) => {
            let chatGPTUrl = data.selectedChatGPT || "https://chatgpt.com/";

            chrome.tabs.create({ url: chatGPTUrl }, (tab) => {
                console.log("✅ ChatGPT 새 창 생성 완료! Tab ID:", tab.id);

                // ChatGPT 페이지 로드 후 실행
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(listener);
                        console.log("✅ ChatGPT 페이지 로드 완료, 입력 실행 시작.");

                        // content.js 실행
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ["content.js"]
                        }).then(() => {
                            console.log("✅ content.js 실행 완료!");

                            // content.js에 메시지 보내기 (텍스트 입력 및 엔터 실행)
                            chrome.tabs.sendMessage(tab.id, {
                                action: "injectPrompt",
                                text: request.prompt
                            }, (response) => {
                                if (response && response.success) {
                                    console.log("✅ ChatGPT 입력 성공!");
                                } else {
                                    console.error("❌ ChatGPT 입력 실패!");
                                }
                            });
                        }).catch((error) => {
                            console.error("❌ content.js 실행 오류:", error);
                        });
                    }
                });
            });

            sendResponse({ success: true });
        });

        return true;
    }
});






/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ 네이버 블로그 작성 페이지 열기 요청을 받고, content.js에서 본문을 붙여넣도록 유도 (삭제 하지 말것!)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openNaverBlog") {
        chrome.tabs.create({ url: "https://blog.naver.com/PostWriteForm.naver" }, (tab) => {
            console.log("✅ 네이버 블로그 작성 페이지 열림! Tab ID:", tab.id);
            
            // ✅ 탭 ID를 저장 (네이버 블로그 페이지가 열릴 때 content.js 실행을 확인하기 위함)
            chrome.storage.local.set({ naverTabId: tab.id });

            sendResponse({ success: true, tabId: tab.id });
        });

        return true; // 비동기 응답을 위해 `true` 반환
    }
});


// ✅ 챗GPTS 사이트 저장 기능 (최대 5개까지 가능)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSites") {
        chrome.storage.local.get(["savedSites"], (data) => {
            sendResponse({ success: true, sites: data.savedSites || [] });
        });
        return true;
    }
});


// ✅ 북마크
chrome.runtime.onInstalled.addListener(() => {
    const bookmarks = [
        { title: "AI 자동화 복붙코딩 유튜브 채널", url: "https://www.youtube.com/@ai%EC%9E%90%EB%8F%99%ED%99%94" },
        { title: "쿠팡", url: "https://link.coupang.com/a/ceqmAJ" },
        { title: "알리익스프레스", url: "https://s.click.aliexpress.com/e/_olRoB9e?bz=300*250" },
        { title: "챗GPT & 넷플릭스 할인 사이트", url: "https://www.gamsgo.com/partner/QZ3J4Cva" }
    ];

    bookmarks.forEach(bookmark => {
        chrome.bookmarks.search({ url: bookmark.url }, (results) => {
            if (results.length === 0) {
                // ✅ 북마크가 존재하지 않으면 추가
                chrome.bookmarks.create({
                    title: bookmark.title,
                    url: bookmark.url
                }, (newBookmark) => {
                    console.log(`✅ '${bookmark.title}' 북마크 추가 완료:`, newBookmark);
                });
            } else {
                console.log(`⚠️ '${bookmark.title}' 북마크가 이미 존재하여 추가하지 않음.`);
            }
        });
    });
});
