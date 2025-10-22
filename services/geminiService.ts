import { GoogleGenAI, Type } from "@google/genai";
import { Chapter, ScriptConfig, AnalysisResult, ImagePromptResult, ImagePromptConfig, DialogueAnalysisResult } from '../types';

const modelFlash = "gemini-2.5-flash";
const modelPro = "gemini-2.5-pro";

const outlineSchema = {
    vi: {
        type: Type.OBJECT,
        properties: {
            chapters: {
                type: Type.ARRAY,
                description: 'Một mảng các đối tượng, mỗi đối tượng đại diện cho một chương của dàn ý.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        chapter: { type: Type.NUMBER, description: 'Số thứ tự của chương.' },
                        summary: { type: Type.STRING, description: 'Bản tóm tắt chi tiết cho chương này.' }
                    },
                    required: ['chapter', 'summary']
                }
            }
        },
        required: ['chapters']
    },
    en: {
        type: Type.OBJECT,
        properties: {
            chapters: {
                type: Type.ARRAY,
                description: 'An array of objects, each representing an outline chapter.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        chapter: { type: Type.NUMBER, description: 'The chapter number.' },
                        summary: { type: Type.STRING, description: 'A detailed summary for this chapter.' }
                    },
                    required: ['chapter', 'summary']
                }
            }
        },
        required: ['chapters']
    }
};

const ideaSuggestionSchema = {
    vi: {
        type: Type.OBJECT,
        properties: {
            ideas: {
                type: Type.ARRAY,
                description: 'Một danh sách gồm 3 ý tưởng câu chuyện sáng tạo và ngắn gọn.',
                items: { type: Type.STRING }
            }
        },
        required: ['ideas']
    },
    en: {
        type: Type.OBJECT,
        properties: {
            ideas: {
                type: Type.ARRAY,
                description: 'A list of 3 creative and brief story ideas.',
                items: { type: Type.STRING }
            }
        },
        required: ['ideas']
    }
};

const characterSuggestionSchema = {
    vi: {
        type: Type.OBJECT,
        properties: {
            descriptions: {
                type: Type.STRING,
                description: 'Một chuỗi văn bản đã định dạng mô tả 2-3 nhân vật chính. Mỗi nhân vật trên một dòng mới, theo định dạng "TÊN: Mô tả."'
            }
        },
        required: ['descriptions']
    },
    en: {
        type: Type.OBJECT,
        properties: {
            descriptions: {
                type: Type.STRING,
                description: 'A formatted string describing 2-3 main characters. Each character on a new line, like "NAME: Description."'
            }
        },
        required: ['descriptions']
    }
};


const chapterSchemas = {
    vi: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'Một tiêu đề sáng tạo cho chương/phần này.' },
            content: { type: Type.STRING, description: 'Nội dung chính của phần truyện, tuân thủ số lượng từ yêu cầu. Nếu được yêu cầu, nội dung này phải chứa các thẻ SFX của ElevenLabs.' },
            mainEmotion: { type: Type.STRING, description: 'Tông cảm xúc chính của phần này (ví dụ: "Hồi hộp", "Vui vẻ", "Sợ hãi").' },
            emotionTag: { type: Type.STRING, description: 'Một từ tiếng Anh duy nhất mô tả cảm xúc chính (ví dụ: "tense", "sad", "excited").' },
            keyEvent: { type: Type.STRING, description: 'Tóm tắt ngắn gọn về sự kiện quan trọng nhất xảy ra trong phần này.' },
            endingHook: { type: Type.STRING, description: 'Một câu kết tạo ra tình huống gay cấn hoặc gợi mở cho phần tiếp theo.' },
        },
        required: ['title', 'content', 'mainEmotion', 'emotionTag', 'keyEvent', 'endingHook'],
    },
    en: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'A creative title for this chapter/section.' },
            content: { type: Type.STRING, description: 'The main content of the story part, adhering to the requested word count. If requested, this content must include ElevenLabs SFX tags.' },
            mainEmotion: { type: Type.STRING, description: 'The main emotional tone of this part (e.g., "Suspenseful", "Joyful", "Scared").' },
            emotionTag: { type: Type.STRING, description: 'A single English word describing the main emotion (e.g., "tense", "sad", "excited").' },
            keyEvent: { type: Type.STRING, description: 'A brief summary of the most important event that occurs in this part.' },
            endingHook: { type: Type.STRING, description: 'An ending sentence that creates a cliffhanger or teases the next part.' },
        },
        required: ['title', 'content', 'mainEmotion', 'emotionTag', 'keyEvent', 'endingHook'],
    }
}

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        titles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of 3-5 compelling, SEO-optimized titles.'
        },
        description: {
            type: Type.STRING,
            description: 'A detailed, SEO-rich description of 200-300 words.'
        },
        hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of 15-20 relevant hashtags, without the # symbol.'
        },
    },
    required: ['titles', 'description', 'hashtags'],
};

const dialogueAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        characters: {
            type: Type.ARRAY,
            description: "An array of objects, each representing a character's dialogue analysis.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The character's name." },
                    wordCount: { type: Type.NUMBER, description: "The total number of words spoken by this character." },
                    percentage: { type: Type.NUMBER, description: "The percentage of total dialogue words spoken by this character." },
                    frequentWords: {
                        type: Type.ARRAY,
                        description: "A list of the 5 most frequently used meaningful words by this character (lowercase, excluding common stop words).",
                        items: { type: Type.STRING }
                    }
                },
                required: ['name', 'wordCount', 'percentage', 'frequentWords']
            }
        },
        totalWords: { type: Type.NUMBER, description: "The total number of words in the entire script's dialogue." }
    },
    required: ['characters', 'totalWords']
};


const imagePromptsSchema = {
    type: Type.OBJECT,
    properties: {
        prompts: {
            type: Type.ARRAY,
            description: "An array of generated image prompts, one for each input chunk.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.NUMBER, description: 'The unique ID of the subtitle chunk, matching the input.' },
                    prompt: { type: Type.STRING, description: 'A detailed, cinematic image prompt in English for this text chunk. Should be suitable for AI image generators like Midjourney or DALL-E.' }
                },
                required: ['id', 'prompt']
            }
        }
    },
    required: ['prompts']
};

const getCharacterInstruction = (config: ScriptConfig): string => {
    if (!config.characterDescriptions.trim()) return '';
    if (config.language === 'vi') {
        return `
            HƯỚNG DẪN NHẤT QUÁN NHÂN VẬT (QUAN TRỌNG):
            Luôn tuân thủ các mô tả nhân vật này để duy trì sự nhất quán về hình ảnh và tính cách trong suốt câu chuyện.
            ---
            ${config.characterDescriptions.trim()}
            ---
        `;
    }
    return `
        CHARACTER CONSISTENCY GUIDELINES (IMPORTANT):
        Always adhere to these character descriptions to maintain visual and personality consistency throughout the story.
        ---
        ${config.characterDescriptions.trim()}
        ---
    `;
};

const getWritingQualityInstruction = (language: 'vi' | 'en'): string => {
    if (language === 'vi') {
        return `
            HƯỚNG DẪN CHẤT LƯỢNG VIẾT (BẮT BUỘC TUÂN THỦ):
            - **Từ ngữ chính xác và có chủ đích:** Lựa chọn từ ngữ cẩn thận. Mỗi từ phải có ý nghĩa, phù hợp với ngữ cảnh, thể loại và cảm xúc của cảnh. Tránh dùng từ sáo rỗng, từ thừa, mơ hồ hoặc sai nghĩa.
            - **Câu văn mạch lạc, logic:** Xây dựng câu văn có cấu trúc rõ ràng. Mỗi câu phải phục vụ một mục đích cụ thể: thúc đẩy cốt truyện, hé lộ thông tin, phát triển nhân vật, hoặc xây dựng không khí. Không viết những câu vô nghĩa.
            - **Ngôn ngữ giàu hình ảnh:** Sử dụng lối văn miêu tả sống động để người đọc có thể hình dung rõ ràng về bối cảnh, nhân vật và hành động. Lời văn phải khơi gợi được cảm xúc đã định.
            - **Duy trì giọng văn nhất quán:** Giữ vững một giọng văn (tone of voice) phù hợp với phong cách đã chọn (ví dụ: giọng văn điện ảnh sẽ khác giọng văn tiểu thuyết).
        `;
    }
    return `
        WRITING QUALITY GUIDELINES (MUST BE FOLLOWED):
        - **Precise and Intentional Vocabulary:** Choose words carefully. Every word must be meaningful, contextually appropriate for the genre and scene's emotion. Avoid clichés, filler words, ambiguity, or incorrect usage.
        - **Coherent and Logical Sentences:** Construct sentences with clear structure. Each sentence must serve a specific purpose: advancing the plot, revealing information, developing a character, or building atmosphere. Do not write meaningless sentences.
        - **Vivid and Sensory Language:** Use descriptive prose so the reader can clearly visualize the setting, characters, and actions. The writing must evoke the intended emotions.
        - **Maintain a Consistent Tone:** Uphold a consistent tone of voice that aligns with the selected writing style (e.g., a cinematic style will differ from a novelistic one).
    `;
};


const getSfxInstruction = (config: ScriptConfig) => {
    if (!config.enableSfx) {
        if (config.language === 'vi') {
            return 'YÊU CẦU QUAN TRỌNG: Kịch bản không được chứa bất kỳ thẻ hiệu ứng âm thanh (SFX) nào, ví dụ: [laughs], [sound: ...], hoặc [pause=...]. Nội dung phải là văn bản thuần túy.';
        }
        return 'CRITICAL REQUIREMENT: The script must not contain any sound effect (SFX) tags, for example: [laughs], [sound: ...], or [pause=...]. The content must be plain text only.';
    }

    if (config.language === 'vi') {
        return `
           HƯỚNG DẪN SFX ELEVENLABS v3
            Một yêu cầu quan trọng: Bạn PHẢI chèn các audio tag (tiếng Anh, trong ngoặc vuông) trực tiếp vào nội dung để tăng cảm xúc khi TTS bằng ElevenLabs v3. 
            Các tag này được model hiểu như “chỉ đạo diễn xuất” và KHÔNG bị đọc thành tiếng. 

            QUAN TRỌNG VỀ NGẮT NGHỈ:
            - CHỈ SỬ DỤNG: Thẻ [pause=x.x] cho ngắt nghỉ (ví dụ: [pause=0.5]).
            - TUYỆT ĐỐI KHÔNG DÙNG: Cú pháp SSML kiểu <break time="1.0s" />. Hệ thống sẽ không nhận dạng được.

            1) Prosody & Pacing (nhịp – ngắt – nhấn)
               - Ngắt nghỉ (chuẩn): [pause=0.5] … [pause=3.0]
               - Nhấn & nhịp tự nhiên: dùng dấu câu, …, !, ?, IN HOA một vài chữ để nhấn.
               - Gợi ý tag hơi thở/nhịp: [breath], [sighs], [exhales]
               * Tránh: [pitch=low], [cadence=slow] (không phải cú pháp chính thức).
               * Lạm dụng quá nhiều [pause] có thể gây hiện tượng đọc nhanh/lạ.

            2) Emotions (cảm xúc)
               - Ví dụ (không giới hạn): [excited], [curious], [angry], [sad], [crying], [mischievously], [sarcastic], [snorts]
               - Đặt tag ngay trước câu cần ảnh hưởng hoặc ngay sau câu để “hạ màn” cảm xúc.
               - Hiệu quả phụ thuộc chất giọng đã chọn.

            3) Delivery Direction (cách nói)
               - Ví dụ: [whispers], [shouts], [deadpan], [urgent]
               - Đừng kỳ vọng giọng “rất thì thầm” có thể hét hoàn hảo chỉ bằng tag—tùy vào voice.

            4) Human Reactions (phản ứng vô ngôn)
               - Ví dụ: [laughs], [laughs harder], [starts laughing], [chuckles], [clears throat], [sighs], [gasps], [wheezing], [exhales]
               - Dùng tiết chế, đặt tại chỗ tự nhiên của câu.

            5) Sound Effects (âm thanh sự kiện/môi trường)
               - Ví dụ: [gunshot], [applause], [clapping], [explosion], [swallows], [gulps]
               - Đây là SFX ngắn gọn bằng tiếng Anh. V3 hiểu và có thể tái hiện dạng âm thanh/phản xạ. 
               - Lưu ý: Nút “Enhance” trong Studio chỉ tự thêm tag giọng nói, KHÔNG tự thêm SFX—hãy chèn SFX thủ công.

            6) Character / Accent (giọng – phong cách)
               - Ví dụ: [strong French accent], [sings], [woo], [fart]
               - Tag dạng “strong X accent” (thay X = ngôn ngữ/giọng) là khuyến nghị.

            7) Dialogue (đa nhân vật / hội thoại)
               - V3 hỗ trợ thoại đa giọng (Dialogue mode). Hãy định danh rõ người nói:
                   NARRATOR: ...
                   KHAI: ...
                   MORGRA: ...
               - “Chồng lời/overlap” là dàn dựng bằng cấu trúc & thời gian; không có tag chuẩn kiểu [overlapping].

            CƯỜNG ĐỘ HIỆU ỨNG SFX — ${config.sfxIntensity}
               - 'light' (Nhẹ): chèn rất tiết kiệm, chỉ những điểm nhấn lớn.
               - 'natural' (Tự nhiên): phân bổ cân bằng nhiều danh mục (prosody + 1–2 emotion/reaction mỗi đoạn).
               - 'strong' (Mạnh): dùng tag thường xuyên, sáng tạo; vẫn ưu tiên rõ nghĩa và dễ nghe.

            QUY TẮC ĐẶT TAG
               - Đặt tag ngay TRƯỚC câu/đoạn cần tác động, hoặc NGAY SAU câu nếu là phản ứng (ví dụ kết câu bằng [sighs]).
               - Một câu thường chỉ cần 1–2 tag để giữ tự nhiên.
               - Thẻ [pause] dùng bằng giây (ví dụ [pause=1.2]), tối đa khoảng 3s.

            LƯU Ý VỀ THIẾT LẬP GIỌNG (ảnh hưởng đến hiệu lực tag)
               - Stability: Creative (biểu cảm mạnh), Natural (cân bằng), Robust (ổn định cao nhưng phản ứng tag kém hơn). 
               - Chọn voice phù hợp phong cách bạn muốn; voice “thiền” sẽ khó hét dù dùng [shouts].

            NHỮNG ĐIỀU KHÔNG NÊN
               - Không dùng cú pháp tự chế kiểu [pitch=low], [cadence=slow].
               - Không dùng tag không thính giác như [standing], [pacing], [music] khi dùng tính năng Enhance; nếu cần nhạc nền hãy mix ở audio pipeline.

            VÍ DỤ NGẮN (trước → sau)
               - Trước:  I’m not sure anymore. Maybe we should stop.
               - Sau:    [sighs] I’m not sure anymore. [pause=0.6] Maybe… we should stop.

            BẮT BUỘC: Trường 'content' cuối cùng phải CHỨA các audio tag ở trên. Không gửi phiên bản không có tag.
        `;
    }
    return `
     ELEVENLABS v3 SFX GUIDELINES — FULL VERSION
            Important requirement: You MUST embed ElevenLabs v3 audio tags (English, in square brackets) directly in your script to enhance emotional delivery. 
            These tags are interpreted as performance directions and are NOT spoken aloud.
            
            CRITICAL PAUSE/BREAK SYNTAX:
            - ONLY USE: The [pause=x.x] tag for pauses (e.g., [pause=0.5]).
            - ABSOLUTELY DO NOT USE: SSML syntax like <break time="1.0s" />. The system will not recognize it.

            1) Prosody & Pacing
               - Pauses (standard): [pause=0.3] … [pause=3.0]
               - Natural emphasis via punctuation (… ! ?) and occasional ALL CAPS for stress.
               - Helpful breath/pace tags: [breath], [sighs], [exhales]
               * Avoid: [pitch=low], [cadence=slow] (not official syntax).
               * Overusing [pause] may cause odd rhythm; keep it natural.

            2) Emotions
               - Examples (not exhaustive): [excited], [curious], [angry], [sad], [crying], [mischievously], [sarcastic], [snorts]
               - Place the tag RIGHT BEFORE the line to affect, or RIGHT AFTER to “release” the feeling.
               - Effect depends on the selected voice.

            3) Delivery Direction
               - Examples: [whispers], [shouts], [deadpan], [urgent]
               - Do not expect extreme changes if the voice style resists them (e.g., a very calm voice may not “shout” convincingly).

            4) Human Reactions
               - Examples: [laughs], [laughs harder], [starts laughing], [chuckles], [clears throat], [sighs], [gasps], [wheezing], [exhales]
               - Use sparingly and only where they sound natural.

            5) Sound Effects (environment / events)
               - Examples: [gunshot], [applause], [clapping], [explosion], [swallows], [gulps], [door creaks], [thunder], [crowd murmurs]
               - Keep SFX labels short and in English.
               - Note: The Studio’s “Enhance” button may add voice-expression tags, but it does NOT add background SFX—insert SFX manually.

            6) Character / Accent
               - Examples: [strong French accent], [pirate voice], [robotic], [old storyteller], [sings], [woo], [fart]
               - “strong X accent” (replace X with the language/voice) is a good pattern to follow.

            7) Dialogue (multi-speaker)
               - ElevenLabs can handle multiple speakers. Label them clearly:
                   NARRATOR: ...
                   KHAI: ...
                   MORGRA: ...
               - “Overlapping” speech is arranged by structure and timing; there is no standard [overlapping] tag.

            SFX INTENSITY — ${config.sfxIntensity}
               - 'light': very sparing use; only at major beats.
               - 'natural': balanced distribution across categories (prosody + 1–2 emotion/reaction tags per passage).
               - 'strong': frequent and creative use; still keep clarity and intelligibility the priority.

            TAG PLACEMENT RULES
               - Put the tag immediately BEFORE the sentence/phrase you want to influence, or AFTER the sentence if it’s a reaction (e.g., ending with [sighs]).
               - Aim for 1–2 tags per sentence to keep the read natural.
               - The [pause] tag uses seconds (e.g., [pause=1.2]); keep individual breaks ≤ ~3s.

            VOICE SETTINGS (impact on tag effectiveness)
               - Model/voice settings matter. Stability modes:
                 • Creative (most expressive), • Natural (balanced), • Robust (more stable, reacts less to tags).
               - Choose a voice that fits the style; a meditative voice may not “shout” well even with [shouts].

            DO NOT
               - Do NOT invent parameters like [pitch=low], [cadence=slow].
               - Do NOT add non-audible stage directions like [standing], [pacing], [music] expecting automatic BGM. If you need music/SFX, mix them in your audio pipeline or use proper SFX tags as above.

            SHORT EXAMPLE (before → after)
               - Before:  I’m not sure anymore. Maybe we should stop.
               - After:   [sighs] I’m not sure anymore. [pause=0.6] Maybe… we should stop.

            MANDATORY: The final 'content' field MUST include these audio tags. Do NOT return a tag-free version.

    `;
};

const getRatingInstruction = (config: ScriptConfig): string => {
    const { rating, language } = config;
    if (language === 'vi') {
        switch (rating) {
            case 'teen':
                return 'HƯỚNG DẪN XẾP HẠNG: Kịch bản phải phù hợp với đối tượng Teen. Nội dung có thể gợi sự sợ hãi hoặc căng thẳng nhưng tránh bạo lực máu me, ngôn ngữ tục tĩu nặng, và các chủ đề người lớn phức tạp. Giữ mức độ nhẹ nhàng.';
            case 'pg13':
                return 'HƯỚNG DẪN XẾP HẠNG: Kịch bản hướng đến đối tượng PG-13, phù hợp với tiêu chuẩn chung của YouTube. Có thể có bạo lực hành động, một chút ngôn ngữ chửi thề nhẹ, và các chủ đề trưởng thành hơn nhưng không đi sâu vào chi tiết đồ họa hoặc tình dục. Đây là mức độ cân bằng.';
            case 'r18':
                return 'HƯỚNG DẪN XẾP HẠNG: Kịch bản dành cho đối tượng 18+ (Xếp hạng R). Cho phép khám phá các chủ đề tâm lý nặng, bạo lực đồ họa (gore), ngôn ngữ tục tĩu mạnh, và các tình huống người lớn phức tạp. Không có giới hạn về sự sáng tạo trong các chủ đề này.';
            default:
                return '';
        }
    } else { // English
        switch (rating) {
            case 'teen':
                return 'RATING GUIDELINE: The script must be suitable for a Teen audience. Content can be suggestive of horror or tension but must avoid graphic violence, strong profanity, and complex adult themes. Keep it mild.';
            case 'pg13':
                return 'RATING GUIDELINE: The script is for a PG-13 audience, suitable for general YouTube standards. It can contain action violence, some mild profanity, and more mature themes, but without delving into graphic or sexual detail. This is a balanced rating.';
            case 'r18':
                return 'RATING GUIDELINE: The script is for an 18+ (R-rated) audience. You are free to explore heavy psychological themes, graphic violence (gore), strong profanity, and complex adult situations. There are no restrictions on creativity within these themes.';
            default:
                return '';
        }
    }
};

const getOutlinePrompt = (config: ScriptConfig) => {
    const ratingInstruction = getRatingInstruction(config);
    const characterInstruction = getCharacterInstruction(config);
    if (config.language === 'vi') {
        return `
            Bạn là một nhà kể chuyện bậc thầy và kiến trúc sư kịch bản. Nhiệm vụ của bạn là tạo ra một dàn ý hấp dẫn, chi tiết cho từng chương của một câu chuyện.
            
            CHI TIẾT CÂU CHUYỆN:
            Tên kịch bản: ${config.title}
            Thể loại: ${config.genre}
            Phong cách viết: ${config.style}
            Tổng số phần: ${config.totalChapters}
            Ý tưởng ban đầu: ${config.idea}

            ${ratingInstruction}
            ${characterInstruction}

            NHIỆM VỤ:
            Viết một bản tóm tắt cho mỗi chương trong tổng số ${config.totalChapters} chương. Mỗi bản tóm tắt cần nêu chi tiết các sự kiện chính, sự phát triển của nhân vật, và cung bậc cảm xúc cho chương đó. Sử dụng ngôn ngữ súc tích, chính xác và giàu hình ảnh để mô tả các sự kiện. Đảm bảo mỗi ý trong dàn ý đều rõ ràng và có mục đích, tạo thành một câu chuyện hoàn chỉnh, có nhịp độ tốt.

            TRẢ VỀ:
            Chỉ trả về một đối tượng JSON tuân thủ schema đã chỉ định, chứa một mảng các chương.
        `;
    }
    return `
        You are a master storyteller and script architect. Your task is to create a compelling, chapter-by-chapter outline for a story.
        
        STORY DETAILS:
        Script Title: ${config.title}
        Genre: ${config.genre}
        Writing Style: ${config.style}
        Total Chapters: ${config.totalChapters}
        Initial Idea: ${config.idea}

        ${ratingInstruction}
        ${characterInstruction}

        TASK:
        Write a summary for each of the ${config.totalChapters} chapters. Each summary should detail the key events, character developments, and emotional arc for that chapter. Use concise, precise, and evocative language to describe the events. Ensure every point in the outline is clear and purposeful, forming a complete, well-paced story.

        RETURN:
        Only return a JSON object that adheres to the specified schema, containing an array of chapters.
    `;
};

const getIdeaSuggestionPrompt = (config: ScriptConfig) => {
    if (config.language === 'vi') {
        return `
            Bạn là một AI chuyên gia sáng tạo ý tưởng. Dựa trên các thông tin sau:
            - Thể loại: ${config.genre}
            - Phong cách viết: ${config.style}

            Nhiệm vụ:
            Tạo ra 3 ý tưởng/cảnh mở đầu độc đáo và hấp dẫn. Mỗi ý tưởng phải ngắn gọn (1-2 câu) và khơi gợi sự tò mò.

            Chỉ trả về một đối tượng JSON tuân thủ schema đã chỉ định.
        `;
    }
    return `
        You are a creative idea-generation expert AI. Based on the following information:
        - Genre: ${config.genre}
        - Writing Style: ${config.style}

        Task:
        Generate 3 unique and compelling story ideas or opening scenes. Each idea must be concise (1-2 sentences) and spark curiosity.

        Only return a JSON object that adheres to the specified schema.
    `;
};

const getCharacterSuggestionPrompt = (config: ScriptConfig) => {
    if (config.language === 'vi') {
        return `
            Bạn là một AI chuyên thiết kế nhân vật. Dựa trên ý tưởng câu chuyện sau đây:
            - Thể loại: ${config.genre}
            - Ý tưởng: ${config.idea}

            Nhiệm vụ:
            Tạo ra 2-3 nhân vật chính phù hợp với câu chuyện. Cung cấp một mô tả ngắn gọn cho mỗi người (ví dụ: tên, ngoại hình, đặc điểm cốt lõi). Định dạng đầu ra là một chuỗi văn bản duy nhất, với mỗi nhân vật trên một dòng mới.

            Ví dụ định dạng:
            TÊN NHÂN VẬT: Mô tả ngắn gọn về nhân vật.

            Chỉ trả về một đối tượng JSON tuân thủ schema đã chỉ định.
        `;
    }
    return `
        You are an expert character designer AI. Based on the following story idea:
        - Genre: ${config.genre}
        - Idea: ${config.idea}

        Task:
        Create 2-3 main characters that fit the story. Provide a brief description for each (e.g., name, appearance, core trait). Format the output as a single string, with each character on a new line.

        Example format:
        CHARACTER NAME: A brief description of the character.

        Only return a JSON object that adheres to the specified schema.
    `;
};


const getInitialPrompt = (config: ScriptConfig, outline: string) => {
    const sfxInstruction = getSfxInstruction(config);
    const ratingInstruction = getRatingInstruction(config);
    const writingQualityInstruction = getWritingQualityInstruction(config.language);
    const characterInstruction = getCharacterInstruction(config);
    if (config.language === 'vi') {
        return `
            Bạn là một AI chuyên viết kịch bản chuyên nghiệp. Nhiệm vụ của bạn là bắt đầu một câu chuyện mới dựa trên các chi tiết và dàn ý đã được cung cấp.
            Tên kịch bản: ${config.title}
            Thể loại: ${config.genre}
            Phong cách viết: ${config.style}
            Tổng số phần dự kiến: ${config.totalChapters}
            Số từ cho phần này: Khoảng ${config.wordCount} từ.
            Ý tưởng ban đầu/Mở đầu: ${config.idea}

            DÀN Ý CÂU CHUYỆN (Kim chỉ nam cho toàn bộ câu chuyện):
            ---
            ${outline}
            ---

            ${writingQualityInstruction}
            ${characterInstruction}
            ${ratingInstruction}
            ${sfxInstruction}

            Hãy viết chương đầu tiên (chương 1 trong tổng số ${config.totalChapters} chương) của câu chuyện này bằng Tiếng Việt. Chương này cần phải hấp dẫn, thiết lập tông giọng và bối cảnh, và TUÂN THỦ NGHIÊM NGẶT kế hoạch đã đề ra cho Phần 1 trong dàn ý.
            Chỉ trả về phản hồi dưới dạng một đối tượng JSON tuân thủ schema đã chỉ định. Không bao gồm bất kỳ văn bản, giải thích hay định dạng markdown nào khác.
        `;
    }
    return `
        You are a professional scriptwriting AI. Your task is to start a new story based on the following details and the provided outline.
        Script Title: ${config.title}
        Genre: ${config.genre}
        Writing Style: ${config.style}
        Total Chapters Planned: ${config.totalChapters}
        Word count for this part: Around ${config.wordCount} words.
        Initial Idea/Opening: ${config.idea}

        STORY OUTLINE (Your guide for the entire story):
        ---
        ${outline}
        ---

        ${writingQualityInstruction}
        ${characterInstruction}
        ${ratingInstruction}
        ${sfxInstruction}

        Write the first chapter (chapter 1 of ${config.totalChapters}) of this story in English. It must be engaging, establish the tone and setting, and STRICTLY FOLLOW the plan laid out for Chapter 1 in the outline.
        Only return a response in the form of a JSON object that adheres to the specified schema. Do not include any other text, explanations, or markdown formatting.
    `;
};

const getContinuationPrompt = (config: ScriptConfig, previousContent: string, currentChapter: number, outline: string) => {
    const sfxInstruction = getSfxInstruction(config);
    const ratingInstruction = getRatingInstruction(config);
    const writingQualityInstruction = getWritingQualityInstruction(config.language);
    const characterInstruction = getCharacterInstruction(config);
    if (config.language === 'vi') {
        return `
            Bạn là một AI chuyên viết kịch bản chuyên nghiệp đang tiếp tục một câu chuyện đã bắt đầu, dựa trên một dàn ý có sẵn.
            
            CHI TIẾT CÂU CHUYỆN:
            Tên kịch bản: ${config.title}
            Thể loại: ${config.genre}
            Tổng số phần: ${config.totalChapters}
            Phần hiện tại: Bạn đang viết phần ${currentChapter} trong tổng số ${config.totalChapters} phần.
            Số từ cho phần mới này: Khoảng ${config.wordCount} từ.

            DÀN Ý TỔNG THỂ (BẮT BUỘC PHẢI THEO):
            ---
            ${outline}
            ---

            CỐT TRUYỆN TÍNH ĐẾN HIỆN TẠI:
            ---
            ${previousContent}
            ---
            
            ${writingQualityInstruction}
            ${characterInstruction}
            ${ratingInstruction}
            ${sfxInstruction}

            Dựa trên câu chuyện đã có và dàn ý tổng thể, hãy viết chương TIẾP THEO bằng Tiếng Việt. TUÂN THỦ NGHIÊM NGẶT kế hoạch cho Phần ${currentChapter} từ dàn ý. Giới thiệu các diễn biến mới phù hợp với mạch truyện và nhịp độ đã thiết lập.
            Chỉ trả về phản hồi dưới dạng một đối tượng JSON tuân thủ schema đã chỉ định.
        `;
    }
    return `
        You are a professional scriptwriting AI continuing an existing story, following a provided outline.
        
        STORY DETAILS:
        Script Title: ${config.title}
        Genre: ${config.genre}
        Total Chapters: ${config.totalChapters}
        Current Part: You are writing part ${currentChapter} of ${config.totalChapters}.
        Word count for this new part: Around ${config.wordCount} words.

        OVERALL OUTLINE (MUST BE FOLLOWED):
        ---
        ${outline}
        ---

        STORY SO FAR:
        ---
        ${previousContent}
        ---

        ${writingQualityInstruction}
        ${characterInstruction}
        ${ratingInstruction}
        ${sfxInstruction}

        Based on the existing story and the overall outline, write the NEXT chapter in English. STRICTLY follow the plan for Chapter ${currentChapter} from the outline. Introduce new developments that fit the established narrative and pacing.
        Only return a response in the form of a JSON object that adheres to the specified schema.
    `;
};

const getRewritePrompt = (config: ScriptConfig, previousContent: string, chapterToRewriteNumber: number, originalContent: string, outline: string) => {
    const sfxInstruction = getSfxInstruction(config);
    const ratingInstruction = getRatingInstruction(config);
    const writingQualityInstruction = getWritingQualityInstruction(config.language);
    const characterInstruction = getCharacterInstruction(config);
    if (config.language === 'vi') {
        return `
            Bạn là một AI chuyên viết kịch bản chuyên nghiệp. Nhiệm vụ của bạn là VIẾT LẠI một chương cụ thể của câu chuyện, tuân thủ dàn ý.
            
            CHI TIẾT CÂU CHUYỆN:
            Tên kịch bản: ${config.title}
            Thể loại: ${config.genre}
            Phần cần viết lại: Chương ${chapterToRewriteNumber} trong tổng số ${config.totalChapters} chương.
            Số từ: Khoảng ${config.wordCount} từ.

            DÀN Ý TỔNG THỂ (BẮT BUỘC PHẢI THEO CHO CHƯƠNG ${chapterToRewriteNumber}):
            ---
            ${outline}
            ---

            CỐT TRUYỆN TÍNH ĐẾN TRƯỚC CHƯƠNG NÀY:
            ---
            ${previousContent}
            ---

            NỘI DUNG GỐC CỦA CHƯƠNG ${chapterToRewriteNumber} (KHÔNG SỬ DỤNG LẠI):
            ---
            ${originalContent}
            ---

            ${writingQualityInstruction}
            ${characterInstruction}
            ${ratingInstruction}
            ${sfxInstruction}

            Dựa trên cốt truyện trước đó và dàn ý, hãy viết một phiên bản MỚI và KHÁC BIỆT cho chương ${chapterToRewriteNumber} bằng Tiếng Việt. Vẫn phải bám sát các điểm chính của dàn ý cho chương này, nhưng hãy thể hiện chúng theo một cách khác (ví dụ: đối thoại khác, mô tả khác, nhịp độ khác). KHÔNG lặp lại nội dung từ phiên bản gốc.
            Chỉ trả về phản hồi dưới dạng một đối tượng JSON tuân thủ schema đã chỉ định.
        `;
    }
    return `
        You are a professional scriptwriting AI. Your task is to REWRITE a specific chapter of a story, adhering to the outline.
        
        STORY DETAILS:
        Script Title: ${config.title}
        Genre: ${config.genre}
        Part to Rewrite: Chapter ${chapterToRewriteNumber} of ${config.totalChapters}.
        Word count: Around ${config.wordCount} words.

        OVERALL OUTLINE (MUST BE FOLLOWED FOR CHAPTER ${chapterToRewriteNumber}):
        ---
        ${outline}
        ---

        STORY SO FAR (LEADING UP TO THIS CHAPTER):
        ---
        ${previousContent}
        ---

        ORIGINAL CONTENT OF CHAPTER ${chapterToRewriteNumber} (DO NOT REUSE):
        ---
        ${originalContent}
        ---

        ${writingQualityInstruction}
        ${characterInstruction}
        ${ratingInstruction}
        ${sfxInstruction}

        Based on the preceding story and the outline, write a NEW and DIFFERENT version for chapter ${chapterToRewriteNumber} in English. You must still hit the key points of the outline for this chapter, but express them differently (e.g., different dialogue, descriptions, pacing). DO NOT repeat content from the original version.
        Only return a response in the form of a JSON object that adheres to the specified schema.
    `;
};

const getAnalysisPrompt = (config: ScriptConfig, fullScript: string) => {
    if (config.language === 'vi') {
        return `
            Bạn là một chuyên gia SEO và chiến lược gia marketing kỹ thuật số, chuyên về nội dung cho YouTube và TikTok. Nhiệm vụ của bạn là phân tích sâu toàn bộ kịch bản được cung cấp để tạo ra các tiêu đề, mô tả và hashtag có khả năng viral và tối ưu hóa cao cho công cụ tìm kiếm.

            KỊCH BẢN ĐẦY ĐỦ:
            ---
            ${fullScript}
            ---

            Dựa trên kịch bản trên, hãy tạo ra các nội dung sau:
            1.  **Tiêu đề (titles):** Tạo ra 3-5 tiêu đề hấp dẫn, giật gân, khơi gợi sự tò mò và được tối ưu hóa SEO. Sử dụng các từ khóa mạnh, nhắm vào cảm xúc và phù hợp với văn hóa xem của YouTube/TikTok.
            2.  **Mô tả (description):** Viết một đoạn mô tả chi tiết, giàu từ khóa (khoảng 200-300 từ). Mở đầu bằng một câu hook mạnh mẽ, tóm tắt câu chuyện một cách lôi cuốn mà không tiết lộ các tình tiết quan trọng, lồng ghép từ khóa một cách tự nhiên và kết thúc bằng lời kêu gọi hành động (ví dụ: "Đừng quên like và subscribe để theo dõi phần tiếp theo!").
            3.  **Hashtag (hashtags):** Tạo một danh sách 8-15 hashtag liên quan. Bao gồm sự kết hợp của các hashtag rộng (ví dụ: #phimngan), hashtag thịnh hành (ví dụ: #xuhuong), hashtag theo thể loại (ví dụ: #kinhdi, #truyenma) và hashtag cụ thể cho câu chuyện. Không bao gồm ký tự '#' trong kết quả trả về.

            Chỉ trả về phản hồi dưới dạng một đối tượng JSON tuân thủ schema đã chỉ định. Không bao gồm bất kỳ văn bản, giải thích hay định dạng markdown nào khác.
        `;
    }
    return `
        You are an expert SEO and digital marketing strategist specializing in content for YouTube and TikTok. Your task is to deeply analyze the provided full script to generate viral-ready, highly search-engine-optimized titles, descriptions, and hashtags.

        FULL SCRIPT:
        ---
        ${fullScript}
        ---

        Based on the script above, generate the following:
        1.  **Titles (titles):** Create 3-5 compelling, click-worthy, and SEO-optimized titles. Use strong keywords, emotional triggers, and curiosity gaps suitable for YouTube/TikTok culture.
        2.  **Description (description):** Write a detailed, keyword-rich description (around 200-300 words). Start with a strong hook, summarize the story enticingly without giving away spoilers, naturally weave in keywords, and end with a call to action (e.g., "Don't forget to like and subscribe for the next part!").
        3.  **Hashtags (hashtags):** Generate a list of 8-15 relevant hashtags. Include a mix of broad tags (e.g., #shortfilm), trending tags (e.g., #fyp), genre-specific tags (e.g., #horror, #scifistory), and story-specific tags. Do not include the '#' symbol in the returned values.

        Only return a response in the form of a JSON object that adheres to the specified schema. Do not include any other text, explanations, or markdown formatting.
    `;
};

const getDialogueAnalysisPrompt = (config: ScriptConfig, fullScript: string) => {
    const langInstructions = config.language === 'vi' ?
    {
        persona: "Bạn là một AI phân tích kịch bản chuyên sâu. Nhiệm vụ của bạn là phân tích toàn bộ lời thoại trong kịch bản được cung cấp để cung cấp các số liệu thống kê chi tiết về từng nhân vật.",
        task: "Phân tích kịch bản sau:",
        instructions: `
Nhiệm vụ:
1.  **Xác định người nói:** Tìm tất cả các nhân vật có lời thoại. Lời thoại thường được định dạng là \`TÊN NHÂN VẬT: Lời thoại...\`. Bao gồm cả "Người dẫn chuyện" (Narrator) nếu có.
2.  **Đếm từ:** Với mỗi nhân vật, đếm tổng số từ họ nói.
3.  **Tính tổng từ:** Tính tổng số từ của tất cả lời thoại trong kịch bản.
4.  **Tính tỷ lệ phần trăm:** Với mỗi nhân vật, tính tỷ lệ phần trăm lời thoại của họ so với tổng số.
5.  **Phân tích từ khóa:** Với mỗi nhân vật, xác định 5 từ có ý nghĩa mà họ sử dụng thường xuyên nhất. Loại bỏ các từ dừng phổ biến (ví dụ: 'là', 'và', 'của', 'trong', 'một') và viết thường tất cả các từ trước khi phân tích.

Chỉ trả về một đối tượng JSON tuân thủ schema đã chỉ định.`
    } : {
        persona: "You are an expert script analyst AI. Your task is to analyze all dialogue in the provided script to deliver detailed statistics on each character.",
        task: "Analyze the following script:",
        instructions: `
Task:
1.  **Identify Speakers:** Find all characters with dialogue. Dialogue is typically formatted as \`CHARACTER NAME: Dialogue...\`. Include the "Narrator" if present.
2.  **Count Words:** For each character, count the total number of words they speak.
3.  **Calculate Total Words:** Calculate the grand total of all dialogue words in the script.
4.  **Calculate Percentage:** For each character, calculate their percentage of the total dialogue.
5.  **Analyze Keywords:** For each character, identify the 5 most frequently used meaningful words. Exclude common stop words (e.g., 'the', 'a', 'is', 'in', 'of') and lowercase all words before analysis.

Only return a JSON object that adheres to the specified schema.`
    }

    return `
${langInstructions.persona}
${langInstructions.task}
---
${fullScript}
---
${langInstructions.instructions}
`
};


const getImagePromptsPrompt = (config: ScriptConfig, chunks: { id: number, text: string }[], imageConfig: ImagePromptConfig) => {
    const ratingInstructionText = {
        teen: "Visual tone: Teen-friendly. Avoid graphic violence, gore, or overly mature themes. Focus on atmosphere and suggestion.",
        pg13: "Visual tone: PG-13. Can include action, stylized violence, and dramatic tension. Avoid explicit gore or nudity.",
        r18: "Visual tone: R-rated / 18+. Unrestricted. Can be graphic, contain gore, nudity, and intense psychological horror imagery.",
    }
    const visualRatingInstruction = ratingInstructionText[config.rating];
    
    const characterConsistency = imageConfig.characterDescriptions.trim() ?
`CHARACTER CONSISTENCY (IMPORTANT):
Always adhere to these character descriptions to maintain visual consistency across all images.
---
${imageConfig.characterDescriptions.trim()}
---` : '';

    const artisticInfluence = imageConfig.artisticInfluence.trim() ? `, ${imageConfig.artisticInfluence.trim()}` : '';

    const promptIntro = config.language === 'vi' ?
        `Bạn là một AI đạo diễn hình ảnh và nghệ sĩ concept. Nhiệm vụ của bạn là phân tích sâu từng phân đoạn phụ đề của một kịch bản và tạo ra một "image prompt" (câu lệnh tạo ảnh) chi tiết, sống động và đầy tính điện ảnh cho mỗi đoạn. Prompt này sẽ được dùng để tạo hình ảnh minh họa cho video.

YÊU CẦU CHO MỖI PROMPT:
- **Phong cách:** ${imageConfig.style}${artisticInfluence}.
- **Yêu cầu tỉ lệ:** Mọi prompt PHẢI kết thúc bằng \`--ar ${imageConfig.aspectRatio}\`.
- **Chi tiết:** Mô tả rõ bối cảnh, nhân vật (nếu có), hành động, cảm xúc trên khuôn mặt, ánh sáng, và góc máy.
- **Từ khóa:** Sử dụng các từ khóa mạnh như "cinematic lighting", "dramatic angle", "hyperrealistic", "8k", "epic composition".
- **Ngôn ngữ:** Prompt phải bằng tiếng Anh để tương thích với các mô hình tạo ảnh AI.

${characterConsistency}

THÔNG TIN KỊCH BẢN:
- Thể loại: ${config.genre}
- Phong cách viết: ${config.style}
- Hướng dẫn hình ảnh theo xếp hạng: ${visualRatingInstruction}

CÁC PHÂN ĐOẠN CẦN PHÂN TÍCH:`
        :
        `You are an AI art director and concept artist. Your task is to deeply analyze each subtitle segment of a script and generate a detailed, vivid, and cinematic "image prompt" for each one. This prompt will be used to generate visuals for a video.

REQUIREMENTS FOR EACH PROMPT:
- **Style:** ${imageConfig.style}${artisticInfluence}.
- **Aspect Ratio Requirement:** Every single prompt MUST end with \`--ar ${imageConfig.aspectRatio}\`.
- **Details:** Clearly describe the setting, characters (if any), actions, facial expressions, lighting, and camera angle.
- **Keywords:** Use powerful keywords like "cinematic lighting", "dramatic angle", "hyperrealistic", "8k", "epic composition".
- **Language:** The prompt must be in English to be compatible with AI image generation models.

${characterConsistency}

SCRIPT INFORMATION:
- Genre: ${config.genre}
- Writing Style: ${config.style}
- Rating Visual Guidance: ${visualRatingInstruction}

SEGMENTS TO ANALYZE:`;

    const chunksString = JSON.stringify(chunks, null, 2);
    const closing = config.language === 'vi' ?
        "Chỉ trả về một đối tượng JSON tuân thủ schema đã chỉ định, chứa một mảng các prompt tương ứng với từng ID." :
        "Only return a JSON object that adheres to the specified schema, containing an array of prompts corresponding to each ID.";

    return `${promptIntro}\n---\n${chunksString}\n---\n${closing}`;
};

const parseJsonResponse = (text: string): any => {
    try {
        const jsonText = text.trim().replace(/^```json/, '').replace(/```$/, '');
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse JSON response:", text, e);
        return null;
    }
}

export const generateIdeaSuggestion = async (apiKey: string, config: ScriptConfig): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = getIdeaSuggestionPrompt(config);
    const schema = ideaSuggestionSchema[config.language];

    const response = await ai.models.generateContent({
        model: modelFlash,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });
    
    const parsed = parseJsonResponse(response.text) as { ideas: string[] } | null;
    if (!parsed || !Array.isArray(parsed.ideas)) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ cho gợi ý ý tưởng."
            : "The AI returned an invalid format for idea suggestions.";
        throw new Error(errorMsg);
    }
    return parsed.ideas;
};

export const generateCharacterSuggestion = async (apiKey: string, config: ScriptConfig): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = getCharacterSuggestionPrompt(config);
    const schema = characterSuggestionSchema[config.language];

    const response = await ai.models.generateContent({
        model: modelFlash,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    const parsed = parseJsonResponse(response.text) as { descriptions: string } | null;
    if (!parsed || typeof parsed.descriptions !== 'string') {
        const errorMsg = config.language === 'vi'
            ? "AI đã trả về định dạng không hợp lệ cho gợi ý nhân vật."
            : "The AI returned an invalid format for character suggestions.";
        throw new Error(errorMsg);
    }
    return parsed.descriptions;
};

export const generateOutline = async (
    apiKey: string,
    config: ScriptConfig,
    onStream: (text: string) => void
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = getOutlinePrompt(config);
    const schema = outlineSchema[config.language];
    const model = config.aiModel === 'pro' ? modelPro : modelFlash;

    const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as { chapters: { chapter: number; summary: string }[] } | null;
    if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ cho dàn ý."
            : "The AI returned an invalid format for the outline.";
        throw new Error(errorMsg);
    }
    
    const prefix = config.language === 'vi' ? 'Phần' : 'Chapter';
    return parsed.chapters
        .sort((a, b) => a.chapter - b.chapter) // Ensure correct order
        .map(c => `${prefix} ${c.chapter}: ${c.summary}`)
        .join('\n');
};

export const generateInitialChapter = async (
    apiKey: string,
    config: ScriptConfig, 
    outline: string,
    onStream: (text: string) => void
): Promise<Chapter> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = getInitialPrompt(config, outline);
    const schema = chapterSchemas[config.language];
    const model = config.aiModel === 'flash' ? modelFlash : modelPro;

    const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });
    
    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as Chapter | null;
    if (!parsed) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ cho chương đầu tiên."
            : "The AI returned an invalid format for the first chapter.";
        throw new Error(errorMsg);
    }
    return parsed;
};

export const generateNextChapter = async (
    apiKey: string,
    config: ScriptConfig, 
    previousChapters: Chapter[],
    outline: string,
    onStream: (text: string) => void
): Promise<Chapter> => {
    const ai = new GoogleGenAI({ apiKey });
    const previousContent = previousChapters.map((c, i) => `${config.language === 'vi' ? 'Chương' : 'Chapter'} ${i+1}: ${c.title}\n${c.content}`).join('\n\n---\n\n');
    const currentChapter = previousChapters.length + 1;
    const prompt = getContinuationPrompt(config, previousContent, currentChapter, outline);
    const schema = chapterSchemas[config.language];
    const model = config.aiModel === 'flash' ? modelFlash : modelPro;

    const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as Chapter | null;
    if (!parsed) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ cho chương tiếp theo."
            : "The AI returned an invalid format for the next chapter.";
        throw new Error(errorMsg);
    }
    return parsed;
};

export const rewriteChapter = async (
    apiKey: string,
    config: ScriptConfig, 
    allChapters: Chapter[], 
    chapterIndexToRewrite: number,
    outline: string,
    onStream: (text: string) => void
): Promise<Chapter> => {
    const ai = new GoogleGenAI({ apiKey });
    const chapterNumber = chapterIndexToRewrite + 1;
    const contextChapters = allChapters.slice(0, chapterIndexToRewrite);
    const originalChapter = allChapters[chapterIndexToRewrite];

    const previousContent = contextChapters.length > 0
        ? contextChapters.map((c, i) => `${config.language === 'vi' ? 'Chương' : 'Chapter'} ${i + 1}: ${c.title}\n${c.content}`).join('\n\n---\n\n')
        : (config.language === 'vi' ? 'Đây là chương đầu tiên, không có nội dung trước đó.' : 'This is the first chapter, there is no preceding content.');

    const originalContent = `${originalChapter.title}\n${originalChapter.content}`;

    const prompt = getRewritePrompt(config, previousContent, chapterNumber, originalContent, outline);
    const schema = chapterSchemas[config.language];
    const model = config.aiModel === 'flash' ? modelFlash : modelPro;

    const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as Chapter | null;
    if (!parsed) {
        const errorMsg = config.language === 'vi'
            ? "AI đã trả về định dạng không hợp lệ khi viết lại chương."
            : "The AI returned an invalid format when rewriting the chapter.";
        throw new Error(errorMsg);
    }
    return parsed;
};

export const analyzeScriptForSEO = async (
    apiKey: string,
    config: ScriptConfig, 
    chapters: Chapter[],
    onStream: (text: string) => void
): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey });
    const fullScript = chapters.map((c, i) => `${config.language === 'vi' ? 'Chương' : 'Chapter'} ${i+1}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
    const prompt = getAnalysisPrompt(config, fullScript);
    
    const responseStream = await ai.models.generateContentStream({
        model: modelFlash,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        }
    });

    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as AnalysisResult | null;
    if (!parsed) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ cho phân tích SEO."
            : "The AI returned an invalid format for the SEO analysis.";
        throw new Error(errorMsg);
    }
    return parsed;
};

export const analyzeDialogue = async (
    apiKey: string,
    config: ScriptConfig,
    chapters: Chapter[],
    onStream: (text: string) => void
): Promise<DialogueAnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey });
    const fullScript = chapters.map((c, i) => `${config.language === 'vi' ? 'Chương' : 'Chapter'} ${i + 1}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
    const prompt = getDialogueAnalysisPrompt(config, fullScript);

    const responseStream = await ai.models.generateContentStream({
        model: modelPro, // Use Pro for better analysis
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: dialogueAnalysisSchema,
        }
    });

    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onStream(accumulatedText);
        }
    }

    const parsed = parseJsonResponse(accumulatedText) as DialogueAnalysisResult | null;
    if (!parsed) {
        const errorMsg = config.language === 'vi'
            ? "AI đã trả về định dạng không hợp lệ cho phân tích thoại."
            : "The AI returned an invalid format for the dialogue analysis.";
        throw new Error(errorMsg);
    }
    return parsed;
};

export const generateImagePromptsForScript = async (apiKey: string, config: ScriptConfig, chunks: { id: number, text: string }[], imageConfig: ImagePromptConfig): Promise<ImagePromptResult[]> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = getImagePromptsPrompt(config, chunks, imageConfig);
    
    const response = await ai.models.generateContent({
        model: modelFlash,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: imagePromptsSchema,
        }
    });
    
    const parsed = parseJsonResponse(response.text) as { prompts: ImagePromptResult[] } | null;
    if (!parsed || !parsed.prompts) {
        const errorMsg = config.language === 'vi' 
            ? "AI đã trả về định dạng không hợp lệ khi tạo prompt ảnh."
            : "The AI returned an invalid format for image prompt generation.";
        throw new Error(errorMsg);
    }
    return parsed.prompts;
};