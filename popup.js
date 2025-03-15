// ✅ 저작권 정보 추가
// Copyright (c) 2025 kimcoding.co.kr
// MIT License - https://kimcoding.co.kr

// ✅ 중복 방지를 위해 `isDownloading` 선언을 확인 후 추가
if (typeof isDownloading === "undefined") {
    var isDownloading = false;
}

// ✅ 페이지 로드 시 초기화 함수
document.addEventListener("DOMContentLoaded", async () => {
    // ✅ 저장된 데이터 초기 로드
    initializeExtension();

    // ✅ 이벤트 리스너 등록
    setupEventListeners();
});

// ✅ 확장프로그램 초기화 함수
async function initializeExtension() {
    try {
        // ✅ 저장된 모든 데이터 로드
        chrome.storage.local.get(null, (data) => {
            // API 키 & 모델 설정 복원
            const model = data.lastUsedModel || "gemini"; // 기본값 설정
            const apiKey = data[`${model}ApiKey`];
            
            // 모델 선택 복원
            const modelSelect = document.getElementById("modelSelect");
            if (modelSelect && model) {
                modelSelect.value = model;
            }

            // API 키 복원
            const apiKeyInput = document.getElementById("apiKey");
            if (apiKeyInput && apiKey) {
                apiKeyInput.value = apiKey;
                console.log(`✅ ${model}의 저장된 API 키를 불러왔습니다.`);
            }

            // 저장된 프롬프트 복원
            if (data.savedPrompt) {
                document.getElementById("userPrompt").value = data.savedPrompt;
            }

            // 저장된 응답 복원
            if (data.editedResponse) {
                document.getElementById("responseOutput").value = data.editedResponse;
            }
        });

        // ✅ 현재 페이지 콘텐츠 자동 로드
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            fetchBlogContent();
        }
    } catch (error) {
        console.error("❌ 초기화 중 오류 발생:", error);
    }
}

// ✅ 이벤트 리스너 설정 함수
function setupEventListeners() {
    // API 키 관련
    const saveApiKeyButton = document.getElementById("saveApiKeyButton");
    if (saveApiKeyButton) {
        saveApiKeyButton.removeEventListener("click", saveApiKey);
        saveApiKeyButton.addEventListener("click", saveApiKey);
    }

    // 모델 선택 변경
    const modelSelect = document.getElementById("modelSelect");
    if (modelSelect) {
        modelSelect.removeEventListener("change", handleModelChange);
        modelSelect.addEventListener("change", handleModelChange);
    }

    // 프롬프트 자동 저장
    const userPrompt = document.getElementById("userPrompt");
    if (userPrompt) {
        userPrompt.addEventListener("input", debounce(saveUserPrompt, 500));
    }

    // 기타 버튼 이벤트
    document.getElementById("fetchBlogContent").addEventListener("click", fetchBlogContent);
    document.getElementById("generateResponse").addEventListener("click", () => {
        showModal();
        generateModelResponse();
    });
    document.getElementById("saveEditedResponse").addEventListener("click", saveEditedResponse);
    document.getElementById("convertMarkdownToHTML").addEventListener("click", convertMarkdownToHTML);

    // HTML 관련 UI 초기화
    document.getElementById("htmlContainer").style.display = "block";
    document.getElementById("copyHTML").style.display = "inline-block";
}

// ✅ API 키 저장 함수 개선
function saveApiKey() {
    const model = document.getElementById("modelSelect").value;
    const apiKey = document.getElementById("apiKey").value.trim();

    if (!apiKey) {
        alert("🚨 API 키를 입력하세요!");
        return;
    }

    chrome.storage.local.set({
        [`${model}ApiKey`]: apiKey,
        lastUsedModel: model
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("❌ API 키 저장 오류:", chrome.runtime.lastError);
            alert("🚨 API 키 저장 중 오류가 발생했습니다!");
            return;
        }
        console.log(`✅ ${model} API 키 저장 완료`);
        alert(`✅ ${model} API 키가 성공적으로 저장되었습니다!`);
    });
}

// ✅ 모델 변경 핸들러 개선
function handleModelChange(event) {
    const model = event.target.value;
    chrome.storage.local.set({ lastUsedModel: model }, () => {
        chrome.storage.local.get(`${model}ApiKey`, (data) => {
            const apiKey = data[`${model}ApiKey`];
            const apiKeyInput = document.getElementById("apiKey");
            if (apiKeyInput) {
                apiKeyInput.value = apiKey || "";
            }
        });
    });
}

// ✅ 저장된 응답 불러오기 (페이지 새로고침 후에도 유지)
function loadSavedResponse() {
    chrome.storage.local.get("editedResponse", (data) => {
        if (data.editedResponse) {
            document.getElementById("responseOutput").value = data.editedResponse;
        }
    });
}

// ✅ 수정된 응답 저장
function saveEditedResponse() {
    let editedResponse = document.getElementById("responseOutput").value.trim();
    
    if (!editedResponse) {
        alert("🚨 저장할 응답이 없습니다.");
        return;
    }

    chrome.storage.local.set({ editedResponse: editedResponse }, () => {

    });
}

// ✅ 다운로드 중복 방지 + Word 변환 실행
// ✅ 1차 → 2차 → 3차 변환 후 Word 다운로드 실행
async function handleDownloadResponseDocx() {
    if (isDownloading) {
        console.warn("⚠️ 다운로드가 이미 진행 중입니다.");
        return;
    }

    try {
        isDownloading = true;
        console.log("🚀 1차 변환 시작...");
        await convertMarkdownToWord();
        console.log("🚀 2차 변환 시작...");
        await applyTextStyles();
        console.log("🚀 3차 변환 시작...");
        await downloadDocxFile();
    } catch (error) {
        console.error("❌ 다운로드 중 오류 발생:", error);
    } finally {
        isDownloading = false;
    }
}




// ✅ 1차 변환 (Markdown → Word 변환)
function convertMarkdownToWord() {
    return new Promise((resolve, reject) => {
        let responseText = document.getElementById("responseOutput").value.trim();
        if (!responseText) {
            alert("🚨 변환할 Gemini 응답이 없습니다.");
            return reject("No response text to convert.");
        }

        chrome.runtime.sendMessage(
            { action: "convertMarkdownToWord", content: responseText },
            (response) => {
                if (!response || !response.success) {
                    alert("🚨 1차 변환 실패: " + (response?.error || "알 수 없는 오류"));
                    return reject("Failed to convert response to Markdown.");
                }
                console.log("✅ 1차 변환 완료!");
                resolve();
            }
        );
    });
}

// ✅ 2차 변환 (스타일 적용)
function applyTextStyles() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "applyTextStyles" }, (response) => {
            if (!response || !response.success) {
                alert("🚨 2차 변환 실패: " + (response?.error || "알 수 없는 오류"));
                return reject("Failed to apply text styles.");
            }
            console.log("✅ 2차 변환 완료!");
            resolve();
        });
    });
}



// ✅ 3차 변환 (Word 다운로드)
function downloadDocxFile() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "prepareDocxFile" }, (response) => {
            if (!response || !response.success) {
                alert("🚨 Word 다운로드 실패: " + (response?.error || "알 수 없는 오류"));
                return reject("Failed to prepare DOCX file.");
            }

            let markdownText = response.fileData;

            if (!window.docx) {
                alert("🚨 Word 변환을 위한 docx.js가 로드되지 않았습니다.");
                return reject("docx.js is not loaded.");
            }

            const { Document, Packer, Paragraph, TextRun } = window.docx;
            const doc = new Document({
                sections: [
                    {
                        properties: {},
                        children: markdownText.split("\n").map(line => {
                            // ✅ 제목 처리 (#, ##, ###) + 굵은 텍스트 처리
                            let titleMatch = line.match(/^(#+)\s*(\*\*.*?\*\*|.*)$/);
                            if (titleMatch) {
                                let level = titleMatch[1].length; // # 개수
                                let text = titleMatch[2].replace(/\*\*/g, ""); // ** 제거

                                return new Paragraph({
                                    children: [new TextRun({ 
                                        text: text, 
                                        bold: true, 
                                        size: level === 1 ? 45 : level === 2 ? 45 : 45, // 제목 크기 변경 (H1: 40, H2: 36, H3: 32)
                                        color: "003399" 
                                    })]
                                });
                            }

                            // ✅ **굵은 텍스트** 처리
                            let parts = [];
                            let lastIndex = 0;
                            let boldRegex = /\*\*(.*?)\*\*/g;

                            line.replace(boldRegex, (match, boldText, index) => {
                                if (index > lastIndex) {
                                    parts.push(new TextRun({ text: line.substring(lastIndex, index), size: 30 })); // ✅ 일반 글씨 크기 적용
                                }
                                parts.push(new TextRun({ text: boldText, bold: true, size: 30 })); // ✅ 굵은 글씨 크기 적용
                                lastIndex = index + match.length;
                            });

                            if (lastIndex < line.length) {
                                parts.push(new TextRun({ text: line.substring(lastIndex), size: 30 })); // ✅ 일반 글씨 크기 적용
                            }

                            return new Paragraph({ 
                                children: parts.length ? parts : [new TextRun({ text: line, bold: false, size: 30 })], // ✅ 일반 글씨 크기 적용
                                spacing: { after: 100 } 
                            });
                        })
                    }
                ]
            });

            // 📌 Word 파일을 Blob으로 변환하여 다운로드
            Packer.toBlob(doc).then(blob => {
                let link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "converted_markdown.docx";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log("📂 Word 파일 다운로드 완료! `**` 기호 제거 후 굵게 적용됨.");
                resolve();
            });
        });
    });
}









// ✅ 언어 모델 선택 변경 시 저장된 API 키 불러오기
document.getElementById("modelSelect").addEventListener("change", loadSavedApiKey);

// ✅ API 키 불러오기 함수
function loadSavedApiKey() {
    chrome.storage.local.get(null, (data) => {
        const model = data.lastUsedModel || document.getElementById("modelSelect").value;
        const apiKey = data[`${model}ApiKey`];
        
        // 모델 선택 업데이트
        const modelSelect = document.getElementById("modelSelect");
        if (modelSelect && model) {
            modelSelect.value = model;
        }

        // API 키 입력 필드 업데이트
        const apiKeyInput = document.getElementById("apiKey");
        if (apiKeyInput) {
            apiKeyInput.value = apiKey || "";
            console.log(apiKey ? `✅ ${model}의 저장된 API 키를 불러왔습니다.` : `⚠️ ${model}의 저장된 API 키가 없습니다.`);
        }
    });
}

// ✅ 사용자 프롬프트 저장
function saveUserPrompt() {
    let promptText = document.getElementById("userPrompt").value.trim();
    chrome.storage.local.set({ savedPrompt: promptText }, () => {
        console.log("✅ 사용자 프롬프트 저장 완료:", promptText);
    });
}

// ✅ 저장된 사용자 프롬프트 불러오기
function loadSavedUserPrompt() {
    chrome.storage.local.get("savedPrompt", (data) => {
        if (data.savedPrompt) {
            document.getElementById("userPrompt").value = data.savedPrompt;
            console.log("✅ 저장된 프롬프트 불러오기:", data.savedPrompt);
        }
    });
}











// ✅ 네이버, 티스토리, 블로그스팟(Blogger), 매일신문, 알리익스프레스, 쿠팡, 다음 본문 가져오기
function fetchBlogContent() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                function: extractBlogDetails
            },
            (results) => {
                if (results && results[0] && results[0].result) {
                    document.getElementById("blogTitle").value = results[0].result.title;
                    document.getElementById("blogContent").value = results[0].result.content;
                } else {
                    document.getElementById("blogTitle").value = "제목을 찾을 수 없습니다.";
                    document.getElementById("blogContent").value = "본문을 가져올 수 없습니다.";
                }
            }
        );
    });
}

// ✅ 본문 크롤링 (탭 내에서 실행)
function extractBlogDetails() {
    try {
        let title = "";
        let content = "";
        let iframe = document.querySelector("iframe#mainFrame");

        // ✅ 네이버 블로그 처리 (일반 + 편집 모드)
        if (iframe) {
            let iframeDoc = iframe.contentDocument;
            title = iframeDoc.querySelector('meta[property="og:title"]')?.content || "";

            // ✅ 새로운 본문 탐색 방법 적용
            let contentElements = iframeDoc.querySelectorAll(".se-text-paragraph");
            
            if (contentElements.length > 0) {
                content = Array.from(contentElements).map(el => el.innerText.trim()).join("\n\n");
            } else {
                content = "네이버 블로그 본문을 찾을 수 없습니다.";
            }
        }


        // ✅ 네이버 스포츠 기사 처리 (추가된 코드)
        else if (document.querySelector("._article_content")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("._article_content");
            content = contentElement ? contentElement.innerText.trim() : "네이버 스포츠 본문을 찾을 수 없습니다.";
        }


        // ✅ 카카오 브런치스토리 본문 가져오기 (추가된 코드)
        else if (document.querySelector(".wrap_body.text_align_left.finish_txt")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".wrap_body.text_align_left.finish_txt");
            content = contentElement ? contentElement.innerText.trim() : "카카오 브런치스토리 본문을 찾을 수 없습니다.";
        }


        // ✅ 워드프레스 블로그 본문 가져오기 (추가된 코드)
        else if (document.querySelector(".entry-content[itemprop='text']")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".entry-content[itemprop='text']");
            content = contentElement ? contentElement.innerText.trim() : "워드프레스 본문을 찾을 수 없습니다.";
        }


        // ✅ 네이트 뉴스 본문 가져오기 (업데이트된 코드)
        else if (document.querySelector("#realArtcContents")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("#realArtcContents");
            content = contentElement ? contentElement.innerText.trim() : "네이트 뉴스 본문을 찾을 수 없습니다.";
        }



        // ✅ 네이트 스포츠 본문 가져오기 (추가된 코드)
        else if (document.querySelector(".content_view")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".content_view");
            content = contentElement ? contentElement.innerText.trim() : "네이트 스포츠 본문을 찾을 수 없습니다.";
        }

        
        // ✅ 티스토리 블로그 처리
        else if (document.querySelector(".tt_article_useless_p_margin")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".tt_article_useless_p_margin");
            content = contentElement ? contentElement.innerText.trim() : "본문을 찾을 수 없습니다.";
        } 


        // ✅ 티스토리2 블로그 본문 가져오기 (새로운 스킨 지원)
        else if (document.querySelector(".article-view div[itemprop='articleBody']")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".article-view div[itemprop='articleBody']");

            content = contentElement ? contentElement.innerText.trim() : "티스토리2 본문을 찾을 수 없습니다.";
        }

        


        // ✅ 티스토리 편집 모드 처리 (iframe 내부 본문 가져오기)
        else if (document.querySelector("#editor-tistory_ifr")) {
            let iframe = document.querySelector("#editor-tistory_ifr");
            let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            title = document.querySelector("#post-title-inp")?.value || "제목 없음";
            
            let contentElement = iframeDoc.querySelector("body");
            content = contentElement ? contentElement.innerText.trim() : "티스토리 편집 모드 본문을 찾을 수 없습니다.";
        }


        // ✅ 블로그스팟(Blogger) 처리
        else if (document.querySelector(".post-body.entry-content")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".post-body.entry-content");
            content = contentElement ? contentElement.innerText.trim() : "본문을 찾을 수 없습니다.";
        } 


       
        // ✅ 매일신문 처리
        else if (document.querySelector("article#dic_area")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("article#dic_area");
            content = contentElement ? contentElement.innerText.trim() : "본문을 찾을 수 없습니다.";
        } 
        
        // ✅ 알리익스프레스(AliExpress) 처리 (리뷰 우선)
        else if (document.querySelector(".comet-v2-modal-content.comet-v2-modal-no-footer")) {
            title = "AliExpress 이용후기";
            let contentElement = document.querySelector(".comet-v2-modal-content.comet-v2-modal-no-footer");
            content = contentElement ? contentElement.innerText.trim() : "이용후기를 찾을 수 없습니다.";
        } 
        
        else if (document.querySelector(".description--product-description--Mjtql28")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector(".description--product-description--Mjtql28");
            content = contentElement ? contentElement.innerText.trim() : "상품 설명을 찾을 수 없습니다.";
        } 
        
        // ✅ 쿠팡(Coupang) 처리 (리뷰 > 상품 설명 > 제품 정보 순서)
        else if (document.querySelector("#btfTab > ul.tab-contents > li.product-review.tab-contents__content > div > div.sdp-review__article.js_reviewArticleContainer")) {
            title = "쿠팡 이용후기";
            let contentElement = document.querySelector("#btfTab > ul.tab-contents > li.product-review.tab-contents__content > div > div.sdp-review__article.js_reviewArticleContainer");
            content = contentElement ? contentElement.innerText.trim() : "이용후기를 찾을 수 없습니다.";
        } 

        else if (document.querySelector("#btfTab > ul.tab-contents > li.product-detail.tab-contents__content")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("#btfTab > ul.tab-contents > li.product-detail.tab-contents__content");
            content = contentElement ? contentElement.innerText.trim() : "상품 설명을 찾을 수 없습니다.";
        } 

        else if (document.querySelector("#itemBrief")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("#itemBrief");
            content = contentElement ? contentElement.innerText.trim() : "제품 정보를 찾을 수 없습니다.";
        }

        // ✅ 다음(Daum) 뉴스 본문 가져오기
        else if (document.querySelector("#mArticle > div.news_view.fs_type1")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("#mArticle > div.news_view.fs_type1");
            content = contentElement ? contentElement.innerText.trim() : "뉴스 본문을 찾을 수 없습니다.";
        }

        // ✅ 워드프레스(WordPress) 본문 가져오기
        else if (document.querySelector("#page-content > section.l-section.wpb_row.height_auto.width_custom > div > div > div > div")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            let contentElement = document.querySelector("#page-content > section.l-section.wpb_row.height_auto.width_custom > div > div > div > div");
            content = contentElement ? contentElement.innerText.trim() : "워드프레스 본문을 찾을 수 없습니다.";
        }




        // ✅ 유튜브 스크립트(자막) 가져오기
        else if (document.querySelector("#content ytd-transcript-search-panel-renderer")) {
            title = document.querySelector("meta[property='og:title']")?.content || document.title;
            
            let transcriptContainer = document.querySelector("#content ytd-transcript-search-panel-renderer");
            let transcriptLines = transcriptContainer.querySelectorAll("yt-formatted-string");

            if (transcriptLines.length > 0) {
                content = Array.from(transcriptLines).map(el => el.innerText.trim()).join("\n\n");
            } else {
                content = "유튜브 스크립트를 찾을 수 없습니다.";
            }
        }


        // ✅ 네이버 스마트스토어 리뷰 내용 추출
        else if (document.querySelector("div._3gvExYl9AC")) {
            let reviews = [];
            let reviewElements = document.querySelectorAll("span._2L3vDiadT9");

            // 타이틀 추출 (og:title이 있으면 그 값을, 없으면 document.title을 사용)
            let title = document.querySelector("meta[property='og:title']")?.content || document.title;

            // 모든 리뷰를 순차적으로 추출
            reviewElements.forEach(review => {
                reviews.push(review.innerText.trim());
            });

            // 리뷰 내용이 있으면 content에 저장, 없으면 기본 메시지 출력
            if (reviews.length > 0) {
                content = reviews.join("\n\n"); // 리뷰들을 하나의 문자열로 결합
            } else {
                content = "리뷰를 찾을 수 없습니다.";
            }

            return { title, content }; // 제목과 리뷰를 함께 반환
        }


        // ✅ 네이버 스마트스토어 베스트 리뷰 내용 추출
        else if (document.querySelector("li._1ekDTXuAJB")) {
            let reviews = [];
            let reviewElements = document.querySelectorAll("li._1ekDTXuAJB .IrHstFoqIi span._3eMaa46Quy");

            // 타이틀 추출 (og:title이 있으면 그 값을, 없으면 document.title을 사용)
            let title = document.querySelector("meta[property='og:title']")?.content || document.title;

            // 모든 베스트 리뷰를 순차적으로 추출
            reviewElements.forEach(review => {
                reviews.push(review.innerText.trim());
            });

            // 리뷰 내용이 있으면 content에 저장, 없으면 기본 메시지 출력
            if (reviews.length > 0) {
                content = reviews.join("\n\n"); // 베스트 리뷰들을 하나의 문자열로 결합
            } else {
                content = "베스트 리뷰를 찾을 수 없습니다.";
            }

            return { title, content }; // 제목과 리뷰를 함께 반환
        }


        // ✅ 챗GPT 사이트 본문 가져오기
        else if (document.querySelector(".text-message")) {
            title = "ChatGPT 대화 내용"; // ChatGPT에는 일반적인 제목이 없으므로 기본값 설정
            let contentElements = document.querySelectorAll(".text-message");

            if (contentElements.length > 0) {
                content = Array.from(contentElements)
                    .map(el => el.innerText.trim())
                    .join("\n\n"); // 여러 개의 메시지를 줄바꿈으로 연결
            } else {
                content = "챗GPT 본문을 찾을 수 없습니다.";
            }
        }


        // ✅ 인스타그램 댓글 가져오기_25년 3월1일 추가함.
        else if (document.querySelector("div.xt0psk2")) {
            title = document.querySelector("meta[property='og:title']")?.content || "인스타그램 댓글";
            let contentElement = document.querySelectorAll("div.xt0psk2 > span._ap3a._aaco._aacu._aacx._aad7._aade");

            let comments = Array.from(contentElement).map(el => el.innerText.trim());
            content = comments.length > 0 ? comments.join("\n\n") : "인스타그램 댓글을 찾을 수 없습니다.";
        }



        // ✅ 엔카 차량 정보 가져오기_25년 3월1일 추가함.
        else if (document.querySelector("td.inf")) {
            title = "엔카 차량 정보";

            let carElements = document.querySelectorAll("tr[data-index]"); // 차량 리스트 행 선택

            let cars = Array.from(carElements).map(row => {
                let name = row.querySelector("td.inf a span.cls strong")?.innerText.trim() || "제조사 없음";
                let model = row.querySelector("td.inf a span.cls em")?.innerText.trim() || "모델 없음";
                let fuel = row.querySelector("td.inf a span.dtl strong")?.innerText.trim() || "연료 정보 없음";
                let spec = row.querySelector("td.inf a span.dtl em")?.innerText.trim() || "세부 모델 없음";
                let year = row.querySelector("td.inf span.detail span.yer")?.innerText.trim() || "연식 없음";
                let km = row.querySelector("td.inf span.detail span.km")?.innerText.trim() || "주행거리 없음";
                let location = row.querySelector("td.inf span.detail span.loc")?.innerText.trim() || "지역 정보 없음";
                let price = row.querySelector("td.prc_hs strong")?.innerText.trim() || "가격 없음";

                return `🚗 ${name} ${model} - ${fuel} ${spec} \n📅 ${year} | 🚗 ${km} | 📍 ${location} \n💰 ${price}만원`;
            });

            content = cars.length > 0 ? cars.join("\n\n") : "엔카 차량 정보를 찾을 수 없습니다.";
        }









        // ✅ 기타 블로그 처리
        else {
            title = document.querySelector('meta[property="og:title"]')?.content || document.title;
            let contentElement = document.querySelector(".se-main-container") || document.querySelector(".post-view");
            content = contentElement ? contentElement.innerText.trim() : "본문을 찾을 수 없습니다.";
        }

        return { title, content };
    } catch (error) {
        console.error("❌ 상세 에러:", error);
        return {
            title: "오류 발생",
            content: `콘텐츠를 가져오는 중 오류가 발생했습니다: ${error.message}`,
            error: true
        };
    }
}













/* ✅ 모달 표시 함수 */
function showModal() {
    let modal = document.getElementById("geminiModal");
    if (!modal) return;

    modal.style.display = "block"; // ✅ 모달을 다시 표시할 때 `display: block;` 설정
    setTimeout(() => {
        modal.classList.add("show");
        modal.classList.remove("hide");
    }, 10); // ✅ 애니메이션 적용을 위해 약간의 지연 추가
}

/* ✅ 모달 숨김 함수 */
function hideModal() {
    let modal = document.getElementById("geminiModal");
    if (!modal) return;

    modal.classList.add("hide");
    modal.classList.remove("show");
    
    setTimeout(() => {
        modal.style.display = "none"; // ✅ 완전히 숨김
    }, 500); // ✅ 0.5초 후 숨김
}




// ✅popup.js - 모델 선택 변경 시 이벤트 추가
document.getElementById("modelSelect").addEventListener("change", function() {
const modelNameMap = {
    gemini: "Gemini",
    deepseek: "DeepSeek",
    deepseek_v3: "DeepSeek AI V3",
    qwen: "Qwen",
    "gpt-4o": "OpenAI GPT-4o",         // ✅ 따옴표 필수
    "gpt-4o-mini": "OpenAI GPT-4o Mini", // ✅ 따옴표 필수
    "gpt-4-turbo": "OpenAI GPT-4 Turbo", // ✅ 따옴표 필수
    "gpt-3.5-turbo": "OpenAI GPT-3.5 Turbo" // ✅ 따옴표 필수
};
    document.getElementById("modelName").textContent = modelNameMap[this.value];
});







// ✅ 언어 모델 실행
function generateModelResponse() {
    let blogTitle = document.getElementById("blogTitle").value.trim();
    let blogContent = document.getElementById("blogContent").value.trim();
    let userPrompt = document.getElementById("userPrompt").value.trim();
    const model = document.getElementById("modelSelect").value; // 모델 선택 값 가져오기

    console.log("🚀 선택된 모델:", model); // ✅ 모델 값 확인용 로그

    if (!blogContent) {
        alert("네이버 블로그 글을 먼저 가져오세요!");
        hideModal();
        return;
    }

    showModal();

    let fullPrompt = `블로그 제목: "${blogTitle}"\n\n블로그 글: "${blogContent}"\n\n사용자 추가 프롬프트: "${userPrompt}"`;

    chrome.runtime.sendMessage({ 
        action: "generateText", 
        prompt: fullPrompt,
        model: model // ✅ 모델 선택 값 전달
    }, (response) => {
        if (response && response.success) {
            document.getElementById("responseOutput").value = response.text;
        } else {
            document.getElementById("responseOutput").value = "오류 발생: 응답이 없습니다(API키 확인 하세요!)";
        }
        hideModal();
    });
}








// ✅ Markdown → HTML 변환
function convertMarkdownToHTML() {
    let markdownText = document.getElementById("responseOutput").value.trim();
    if (!markdownText) {
        alert("🚨 변환할 Markdown 내용이 없습니다.");
        return;
    }

    let htmlText = markdownToHTML(markdownText);
    document.getElementById("htmlPreview").innerHTML = htmlText;
    document.getElementById("htmlOutput").value = htmlText;
    document.getElementById("htmlContainer").style.display = "block";
}

// ✅ Markdown을 HTML로 변환하는 함수
function markdownToHTML(markdown) {
    return markdown
        .replace(/###### (.*?)\n/g, '<h6>$1</h6>') // H6
        .replace(/##### (.*?)\n/g, '<h5>$1</h5>') // H5
        .replace(/#### (.*?)\n/g, '<h4>$1</h4>') // H4
        .replace(/### (.*?)\n/g, '<h3>$1</h3>') // H3
        .replace(/## (.*?)\n/g, '<h2>$1</h2>') // H2
        .replace(/# (.*?)\n/g, '<h1>$1</h1>') // H1
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // 굵은 글씨
        .replace(/\*(.*?)\*/g, '<i>$1</i>') // 기울임 글씨
        .replace(/`(.*?)`/g, '<code>$1</code>') // 코드 블록
        .replace(/\n/g, '<br>'); // 줄바꿈 처리
}

// ✅ HTML 복사
function copyHTMLToClipboard() {
    let htmlText = document.getElementById("htmlOutput").value;
    navigator.clipboard.writeText(htmlText).then(() => {
        alert("✅ HTML이 클립보드에 복사되었습니다!");
    });
}



// ✅ 글자수 조회 기능 추가
document.addEventListener("DOMContentLoaded", () => {
    const responseOutput = document.getElementById("responseOutput");
    const charCount = document.getElementById("charCount");
    const checkCharCountButton = document.getElementById("checkCharCount");

    // ✅ 글자수 계산 함수 (모든 공백 제거)
    function updateCharCount() {
        const text = responseOutput.value.replace(/\s/g, ""); // 모든 공백 제거
        charCount.textContent = `${text.length}자 (공백 제외)`;
    }

    // ✅ "글자수 조회" 버튼 클릭 시 글자수 업데이트
    checkCharCountButton.addEventListener("click", updateCharCount);
});



// ✅ 암호 보기/숨기기 기능 추가
document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKey");
    const toggleApiKey = document.getElementById("toggleApiKey");

    // ✅ 저장된 "보기/숨기기" 상태 불러오기
    chrome.storage.local.get("apiKeyVisibility", (data) => {
        if (data.apiKeyVisibility) {
            toggleApiKey.checked = true;
            apiKeyInput.type = "text"; // ✅ 저장된 상태가 "보기"면 보이게 설정
        } else {
            toggleApiKey.checked = false;
            apiKeyInput.type = "password"; // ✅ 저장된 상태가 "숨김"이면 숨김 설정
        }
    });

    // ✅ 체크박스 변경 시 상태 저장
    toggleApiKey.addEventListener("change", function() {
        apiKeyInput.type = this.checked ? "text" : "password";
        chrome.storage.local.set({ apiKeyVisibility: this.checked }); // ✅ 상태 저장
    });
});


// ✅ 이미지 다운로드
document.addEventListener("DOMContentLoaded", () => {
    let downloadButton = document.getElementById("downloadImages");
    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tabs[0].id },
                        function: extractImagesAndTitle
                    },
                    (results) => {
                        if (results && results[0] && results[0].result) {
                            let { images, title } = results[0].result;
                            chrome.runtime.sendMessage({ action: "downloadImages", images: images, title: title });
                        } else {
                            alert("⚠️ 현재 페이지에서 이미지를 찾을 수 없습니다.");
                        }
                    }
                );
            });
        });
    } else {
        console.error("❌ 'downloadImages' 버튼을 찾을 수 없습니다.");
    }
});






// ✅ 현재 페이지의 이미지 URL과 제목 가져오기_이미지 저장
function extractImagesAndTitle() {
    let images = [];
    let title = document.title || "Untitled"; 
    title = title.replace(/[<>:"\/\\|?*]+/g, ""); // 파일명에 사용할 수 없는 문자 제거

    let iframe = document.querySelector("iframe#mainFrame");
    let doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : document;

    // ✅ 네이버 블로그 이미지 추출
    doc.querySelectorAll("img.se-image-resource").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-lazy-src");
        if (imgSrc && imgSrc.includes("postfiles.pstatic.net")) {
            let originalSrc = imgSrc.replace("postfiles.pstatic.net", "blogfiles.pstatic.net"); 
            images.push(originalSrc.split("?")[0]);
        }
    });

    // ✅ 티스토리 블로그 이미지 추출
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-url") || img.getAttribute("data-phocus");
        if (imgSrc && imgSrc.includes("kakaocdn.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });

    // ✅ 블로그스팟(Blogger) 이미지 추출
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src");
        if (imgSrc && imgSrc.includes("blogger.googleusercontent.com")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });

    // ✅ 브런치스토리(Brunch) 이미지 추출
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src");
        if (imgSrc && imgSrc.includes("daumcdn.net")) {
            let originalSrc = imgSrc.replace("//t1.daumcdn.net/thumb/R1280x0/?fname=", ""); // 원본 URL 추출
            images.push(originalSrc);
        }
    });

    // ✅ 워드프레스(WordPress) 이미지 추출
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src");
        if (imgSrc && (imgSrc.includes("wp-content/uploads") || imgSrc.includes("ctfassets.net"))) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });

    // ✅ 쿠팡(Coupang) 상품 이미지 추출 (상세 이미지 + 본문 이미지)
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");

        if (imgSrc && imgSrc.includes("coupangcdn.com")) {
            if (imgSrc.startsWith("//")) {
                imgSrc = "https:" + imgSrc; // 프로토콜 추가
            }

            // ✅ 저해상도 썸네일을 원본 이미지 URL로 변환
            if (imgSrc.includes("thumbnails/remote/")) {
                imgSrc = imgSrc.replace(/thumbnails\/remote\/q\d+\//, "").replace("thumbnail", "image");
            }

            // ✅ 이미지 크기 검사 (너비 또는 높이가 100px 이하인 경우 제외)
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            if (width > 100 && height > 100) {
                images.push(imgSrc.split("?")[0]); // 원본 URL 추출
            }
        }
    });

    // ✅ 쿠팡(Coupang) 상품 썸네일 포함
    doc.querySelectorAll("img.prod-image__detail, div.subType-IMAGE img, div.prod-image__item img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");

        if (imgSrc && imgSrc.includes("coupangcdn.com")) {
            if (imgSrc.startsWith("//")) {
                imgSrc = "https:" + imgSrc; // 프로토콜 추가
            }

            // ✅ 저해상도 썸네일을 원본 이미지 URL로 변환
            if (imgSrc.includes("thumbnails/remote/")) {
                imgSrc = imgSrc.replace(/thumbnails\/remote\/\d+x\d+ex\//, "").replace("thumbnail", "image");
            }

            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });

    // ✅ 쿠팡(Coupang) 확대 이미지(Zoom Image) 추가
    let zoomImage = doc.querySelector(".zoomWindow");
    if (zoomImage) {
        let bgImage = zoomImage.style.backgroundImage;
        let match = bgImage.match(/url\(["']?(.*?)["']?\)/);
        if (match && match[1].includes("coupangcdn.com")) {
            let highResImg = match[1];
            if (highResImg.startsWith("//")) {
                highResImg = "https:" + highResImg; // 프로토콜 추가
            }
            images.push(highResImg.split("?")[0]); // 원본 URL 추출
        }
    }



    // ✅ 알리익스프레스(AliExpress) 이미지 추출 (상세 + 썸네일 + 상세설명 + 리뷰 영역 + 상품 설명)
    doc.querySelectorAll(`
        img.detail-desc-decorate-image, 
        img.magnifier-image, 
        div.detail-desc-decorate-richtext img, 
        div.list--box--rD0K2Xq img, 
        div.list--itemThumbnail--xc9Oc_A img, 
        div.description--product-description--Mjtql28 img, 
        div.slider--img--K0YbWW2 img, 
        div.magnifier--wrap--cF4cafd img
    `).forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");

        if (imgSrc && (imgSrc.includes("ae01.alicdn.com") || imgSrc.includes("aliexpress-media.com"))) {
            if (imgSrc.startsWith("//")) {
                imgSrc = "https:" + imgSrc;
            }

            // ✅ **불필요한 확장자 제거 (WebP, AVIF 등)**  
            if (imgSrc.includes(".webp") || imgSrc.includes(".avif")) {
                imgSrc = imgSrc.replace(/(_\d+x\d+q\d+\..*?)$/, ".jpg");
            }

            images.push(imgSrc.split("?")[0]);
        }
    });








    // ✅ 네이버 엔터(Naver Enter) 뉴스 이미지 추출
    doc.querySelectorAll("div._article_content img").forEach(img => {
        let imgSrc = img.getAttribute("src");

        if (imgSrc && imgSrc.includes("imgnews.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });

    // ✅ 다음(DAUM) 뉴스 이미지 추출
    doc.querySelectorAll("img.thumb_g_article").forEach(img => {
        let imgSrc = img.getAttribute("data-org-src") || img.getAttribute("src");

        if (imgSrc && imgSrc.includes("daumcdn.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });




    // ✅ 네이트 뉴스 기사 본문 이미지 추출 (중복 제거, 저해상도 필터링 적용)
    doc.querySelectorAll(".articleMedia img, .imgad_area img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("onclick");

        if (imgSrc) {
            // ✅ onclick 속성에서 원본 이미지 URL 추출
            let match = imgSrc.match(/GoImg\(['"]?(.*?)['"]?\)/);
            if (match && match[1].includes("nateimg.co.kr")) {
                imgSrc = match[1];
            }

            // ✅ 원본 이미지 필터링 (썸네일, 광고 제거)
            if (imgSrc.includes("nateimg.co.kr") && imgSrc.includes("orgImg")) {
                if (imgSrc.startsWith("//")) {
                    imgSrc = "https:" + imgSrc; // 프로토콜 추가
                }

                // ✅ 저해상도 (133px 이하) 이미지 필터링
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (width > 133 && height > 133) { 
                    images.push(imgSrc.split("?")[0]); // 원본 URL 추출 후 저장
                }
            }
        }
    });

    
    // ✅ 네이버 뉴스 기사 본문 이미지 추출 (중복 제거 없음)
    doc.querySelectorAll(".nbd_im_w img, .nbd_a img").forEach(img => {
        let imgSrc = img.getAttribute("src");
    
        if (imgSrc && imgSrc.includes("imgnews.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 추출
        }
    });
    


    // ✅ 현재 페이지가 네이버 스마트스토어인지 확인
    try {
        let currentURL = window.location.href;
    
        if (currentURL.includes("smartstore.naver.com")) {
            let iframe = document.querySelector("iframe");
            if (iframe && iframe.contentDocument) {
                doc = iframe.contentDocument || iframe.contentWindow.document;
            } else {
                doc = document;
            }
        } else {
            doc = document;
        }
    } catch (e) {
        console.warn("iframe 접근 차단됨 (CORS 문제 가능). 스마트스토어에서만 `iframe` 접근을 시도합니다.");
        doc = document; // 접근 불가 시 기본 document 사용
    }
    // ✅ 스마트스토어 대표 이미지(meta 태그)
    doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => {
        let imgSrc = meta.getAttribute("content");
        if (imgSrc && imgSrc.includes("shop-phinf.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 저장
        }
    });

    // ✅ 스마트스토어 상세 이미지 추출 (iframe 내부 포함)
    doc.querySelectorAll("img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");
        
        if (imgSrc && imgSrc.includes("shop-phinf.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 저장
        }
    });
    
    

    // ✅ 네이버 스마트스토어 & 라이브 쇼핑 대표 이미지 (HTML 요소 기반)
    document.querySelectorAll(".bd_1uFKu img, .bd_2DO68 img").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");

        if (imgSrc && imgSrc.includes("shop-phinf.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 저장
        }
    });

    // ✅ 네이버 스마트스토어 & 라이브 쇼핑 추가 이미지 추출 (썸네일 포함)
    document.querySelectorAll(".bd_2YVUb img, .bd_1Niq0, img.se-image-resource").forEach(img => {
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");

        if (imgSrc && imgSrc.includes("shop-phinf.pstatic.net")) {
            images.push(imgSrc.split("?")[0]); // 원본 URL 저장
        }
    });

    // ✅ 네이버 스마트스토어 상세 정보 내 이미지 추출 (공지사항, 제품 스펙, 배송 정책 등)
    document.querySelectorAll(".E-N5zuAehq.detail_viewer img.se-image-resource").forEach(img => {
        // 제외해야 하는 부모 요소 (_1StKGTsRkj, gF6FftZfgj 내부 이미지는 제외)
        if (img.closest("._1StKGTsRkj, .gF6FftZfgj, ._3ebPKmwfY_")) {
            return; // 해당 요소 내부의 이미지라면 스킵
        }
    
        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src");
    
        if (imgSrc) {
            images.push(imgSrc.split("?")[0]); // URL에서 불필요한 쿼리스트링 제거
        }
    });






    // ✅ 중복 이미지 제거
    images = [...new Set(images)];


    return { images: [...new Set(images)], title };
}




// ✅ 선택한 이미지를 FileReader()로 읽고 변환 후 다시 저장
// ✅ 선택한 파일을 가공 후 다시 저장 가능
document.getElementById("processImages").addEventListener("click", () => {
    const files = document.getElementById("imageInput").files;
    if (files.length === 0) {
        alert("가공할 이미지를 선택하세요.");
        return;
    }

    Array.from(files).forEach(file => {
        processLocalImage(file).then(blob => {
            saveProcessedImage(blob, "processed_" + file.name);
        }).catch(error => {
            console.error("❌ 이미지 가공 실패:", error);
        });
    });
});



// ✅ 이미지 크롭 + 회전 + 필터 적용 후 변환 (EXIF 메타데이터 삭제 포함)
function processLocalImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = () => {
            const img = new Image();
            img.src = reader.result;

            img.onload = () => {
                const cropAmount = 20; // ✅ 크롭할 크기
                const croppedWidth = img.width - cropAmount * 2;
                const croppedHeight = img.height - cropAmount * 2;

                // ✅ 캔버스 설정
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;

                // ✅ 랜덤 회전 (±2도)
                const rotateAngle = (Math.random() * 4 - 2) * (Math.PI / 180);
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(rotateAngle);
                ctx.translate(-croppedWidth / 2, -croppedHeight / 2);

                // ✅ 필터 적용
                ctx.filter = "brightness(1.05) contrast(1.05)";
                ctx.drawImage(img, cropAmount, cropAmount, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);

                // ✅ 선택된 이모지 가져오기
                const selectedEmoji = document.getElementById("emojiSelector").value;

                // ✅ 이모지가 선택된 경우에만 추가
                if (selectedEmoji) {
                    const fontSize = croppedWidth * 0.08;
                    ctx.font = `${fontSize}px Arial`;
                    ctx.textAlign = "right";
                    ctx.textBaseline = "bottom";
                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                    ctx.fillText(selectedEmoji, croppedWidth - 10, croppedHeight - 10);
                }

                // ✅ 변환된 이미지 저장
                canvas.toBlob(blob => resolve(blob), "image/jpeg", 1.0);
            };
        };

        reader.onerror = () => reject("❌ 이미지 읽기 실패");
    });
}





// ✅ 변환된 이미지를 다시 PC에 저장
function saveProcessedImage(blob, filename) {
    const url = URL.createObjectURL(blob);

    // ✅ 확장자를 무조건 `.jpg`로 변경하여 저장
    const finalFilename = filename.replace(/\.[^/.]+$/, ".jpg");

    // ✅ 자동 저장 (saveAs: false → 사용자 확인 없이 바로 다운로드)
    chrome.downloads.download({
        url: url,
        filename: finalFilename, // ✅ 파일명 자동 설정
        saveAs: false // ✅ 자동 저장 (사용자 확인 창 없이 저장)
    });
}









//✅ 중복 단어 개수 확인 기능 추가
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("checkDuplicateButton").addEventListener("click", checkDuplicateWordCount);
});

// ✅ 중복 단어 개수 확인 함수
function checkDuplicateWordCount() {
    let findWord = document.getElementById("duplicateWordInput").value.trim();
    let responseOutput = document.getElementById("responseOutput").value;

    if (!findWord) {
        alert("🚨 찾을 단어를 입력하세요!");
        return;
    }

    // ✅ 특수문자와 줄바꿈을 제거하여 순수한 텍스트로 변환
    let cleanText = responseOutput
        .replace(/[\n\r]/g, " ") // 줄바꿈 제거
        .replace(/[^\wㄱ-ㅎ가-힣\s]/g, ""); // 특수문자 제거

    // ✅ 단어 개수 세기 (공백 기준으로 단어 분리)
    let wordsArray = cleanText.split(/\s+/);
    let count = wordsArray.filter(word => word === findWord).length;

    document.getElementById("duplicateCount").textContent = count;
    alert(`✅ '${findWord}' 단어는 ${count}번 등장합니다.`);
}



//✅입력한 개수만큼 단어를 변경하도록 개선
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("replaceButton").addEventListener("click", replaceWordInText);
});

// ✅ 단어 교체 함수 (정확한 개수 유지)
function replaceWordInText() {
    let findWord = document.getElementById("findWord").value.trim();
    let replaceWord = document.getElementById("replaceWord").value.trim();
    let replaceCount = parseInt(document.getElementById("replaceCount").value, 10); // ✅ 원래 입력값 유지
    let responseOutput = document.getElementById("responseOutput");

    if (!findWord || !replaceWord) {
        alert("🚨 변경할 단어를 입력하세요!");
        return;
    }

    if (!replaceCount || replaceCount < 1) {
        alert("🚨 올바른 교체 개수를 입력하세요!");
        return;
    }

    let text = responseOutput.value;
    let regex = new RegExp(findWord, "g"); // ✅ 전체 텍스트에서 단어 검색
    let matches = [...text.matchAll(regex)]; // ✅ 모든 일치하는 단어 찾기

    if (matches.length === 0) {
        alert(`⚠️ '${findWord}' 단어를 찾을 수 없습니다.`);
        return;
    }

    let maxReplacements = Math.min(replaceCount + 1, matches.length); // ✅ 내부적으로는 1개 더 변경
    let counter = 0;

    let replacedText = text.replace(regex, (match) => {
        if (counter < maxReplacements) {
            counter++;
            return replaceWord;
        }
        return match;
    });

    responseOutput.value = replacedText;

    // ✅ 팝업창에는 사용자가 입력한 값 표시
    alert(`✅ '${findWord}' → '${replaceWord}' (${replaceCount}회 변경 완료!)`);
}




// ✅ChatGPT 자동 실행 + 블로그 제목/본문/사용자 프롬프트 복사 붙혀넣기 기능 추가
document.getElementById("sendToChatGPT").addEventListener("click", () => {
    const blogTitle = document.getElementById("blogTitle").value.trim();
    const blogContent = document.getElementById("blogContent").value.trim();
    const userPrompt = document.getElementById("userPrompt").value.trim();

    if (!blogTitle || !blogContent) {
        alert("블로그 내용을 먼저 가져오세요!");
        return;
    }

    const fullPrompt = `[블로그 제목] ${blogTitle}\n\n[본문 내용]\n${blogContent}\n\n[사용자 요청 프롬프트]\n${userPrompt}`;

    chrome.runtime.sendMessage({
        action: "openChatGPT",
        prompt: fullPrompt
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("전송 실패:", chrome.runtime.lastError);
        }
    });

    window.close();
});





// ✅ 저장된 네이버 & 티스토리 ID 불러오기
document.addEventListener("DOMContentLoaded", function () {
    const naverInput = document.getElementById("naverIdInput");
    const tistoryInput = document.getElementById("tistoryIdInput");
    const naverSaveButton = document.getElementById("Naver_Save_Button");
    const tistorySaveButton = document.getElementById("Tistory_Save_Button");
    const showRealIdCheckbox = document.getElementById("showRealIdCheckbox"); // ✅ 체크박스 추가

    // ✅ 저장된 ID 불러와서 마스킹 적용 (초기 실행)
    function loadStoredIds() {
        chrome.storage.local.get(["savedNaverId", "savedTistoryId", "showRealId"], (data) => {
            if (data.savedNaverId) {
                naverInput.dataset.realValue = data.savedNaverId; // 실제 ID 저장
                naverInput.value = data.showRealId ? data.savedNaverId : "XXXXXXX"; // 체크박스 상태에 따라 표시
            }
            if (data.savedTistoryId) {
                tistoryInput.dataset.realValue = data.savedTistoryId; // 실제 ID 저장
                tistoryInput.value = data.showRealId ? data.savedTistoryId : "XXXXXXX"; // 체크박스 상태에 따라 표시
            }

            // ✅ 체크박스 상태 유지
            showRealIdCheckbox.checked = data.showRealId || false;
        });
    }

    loadStoredIds(); // ✅ 페이지 로딩 후 저장된 ID 불러오기

    // ✅ 입력 필드 클릭 시 실제 ID 표시
    function revealId(event) {
        const inputField = event.target;
        if (inputField.dataset.realValue) {
            inputField.value = inputField.dataset.realValue;
        }
    }

    naverInput.addEventListener("focus", revealId);
    tistoryInput.addEventListener("focus", revealId);

    // ✅ 네이버 ID 저장 버튼 클릭 이벤트
    naverSaveButton.addEventListener("click", function () {
        const newNaverId = naverInput.value.trim();
        if (newNaverId) {
            chrome.storage.local.set({ savedNaverId: newNaverId }, () => {
                console.log("✅ 네이버 ID 저장 완료:", newNaverId);
                loadStoredIds(); // ✅ 저장 후 ID 불러오기
                alert("네이버 ID가 저장되었습니다!");
            });
        }
    });

    // ✅ 티스토리 ID 저장 버튼 클릭 이벤트
    tistorySaveButton.addEventListener("click", function () {
        const newTistoryId = tistoryInput.value.trim();
        if (newTistoryId) {
            chrome.storage.local.set({ savedTistoryId: newTistoryId }, () => {
                console.log("✅ 티스토리 ID 저장 완료:", newTistoryId);
                loadStoredIds(); // ✅ 저장 후 ID 불러오기
                alert("티스토리 ID가 저장되었습니다!");
            });
        }
    });

    // ✅ 체크박스 클릭 시 ID 표시 여부 변경
    showRealIdCheckbox.addEventListener("change", function () {
        const showRealId = showRealIdCheckbox.checked;
        chrome.storage.local.set({ showRealId }, () => {
            console.log("✅ ID 표시 상태 변경:", showRealId);
            loadStoredIds(); // ✅ 체크박스 상태 변경 후 다시 ID 로드
        });
    });
});






//✅ 챗GPTS 드롭다운 방식 
document.addEventListener("DOMContentLoaded", () => {
    const chatGPTDropdown = document.getElementById("chatGPTDropdown");
    const chatGPTInput = document.getElementById("chatGPTInput");
    const saveChatGPTButton = document.getElementById("saveChatGPT");
    const deleteChatGPTButton = document.getElementById("deleteChatGPT"); // 🗑 삭제 버튼 추가

    // ✅ 저장된 ChatGPT 목록 불러오기
    function loadChatGPTs() {
        chrome.storage.local.get(["savedChatGPTs", "selectedChatGPT"], (data) => {
            chatGPTDropdown.innerHTML = '<option value="" disabled selected>챗GPTS를 선택하세요</option>';
            let chatGPTs = data.savedChatGPTs || [];

            chatGPTs.forEach((url) => {
                const option = document.createElement("option");
                option.value = url;
                option.textContent = url;
                if (url === data.selectedChatGPT) {
                    option.selected = true;
                }
                chatGPTDropdown.appendChild(option);
            });
        });
    }

    loadChatGPTs(); // ✅ 팝업 로드 시 저장된 ChatGPT 목록 불러오기

    // ✅ 저장 버튼 클릭 이벤트
    saveChatGPTButton.addEventListener("click", () => {
        const url = chatGPTInput.value.trim();
        if (url) {
            chrome.storage.local.get(["savedChatGPTs"], (data) => {
                let chatGPTs = data.savedChatGPTs || [];

                // 최대 5개 제한
                if (chatGPTs.length >= 5) {
                    chatGPTs.shift(); // 오래된 항목 제거
                }

                chatGPTs.push(url);
                chrome.storage.local.set({ savedChatGPTs: chatGPTs, selectedChatGPT: url }, () => {
                    console.log("✅ ChatGPT URL 저장 완료!", chatGPTs);
                    loadChatGPTs(); // ✅ 저장 후 드롭다운 갱신
                    chatGPTInput.value = ""; // 입력 필드 초기화
                });
            });
        }
    });

    // ✅ 드롭다운에서 선택 시 URL 변경
    chatGPTDropdown.addEventListener("change", () => {
        const selectedUrl = chatGPTDropdown.value;
        chrome.storage.local.set({ selectedChatGPT: selectedUrl }, () => {
            console.log("✅ 선택된 ChatGPT URL 변경 완료:", selectedUrl);
        });
    });

    // ✅ 삭제 버튼 클릭 이벤트 (선택한 URL 삭제)
    deleteChatGPTButton.addEventListener("click", () => {
        const selectedUrl = chatGPTDropdown.value;
        if (!selectedUrl) {
            alert("⚠️ 삭제할 URL을 선택하세요!");
            return;
        }

        chrome.storage.local.get(["savedChatGPTs"], (data) => {
            let chatGPTs = data.savedChatGPTs || [];
            let updatedChatGPTs = chatGPTs.filter(url => url !== selectedUrl);

            chrome.storage.local.set({ savedChatGPTs: updatedChatGPTs }, () => {
                console.log("🗑 삭제 완료:", selectedUrl);
                loadChatGPTs(); // ✅ 삭제 후 드롭다운 갱신
            });
        });
    });
});

// 디바운스 함수 추가
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
