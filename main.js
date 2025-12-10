async function recognize(base64, lang, options) {
  const {
    config = {},
    utils: {
      http: { fetch, Body },
    },
  } = options;
  const { endpoint, model, apiKey, googleSearch, Thinking, temperature } = config;

  const apiUrl = `${endpoint || 'https://generativelanguage.googleapis.com'}/v1beta/models/${
    model || 'gemini-flash-lite'
  }:generateContent`;

  if (!apiKey) {
    throw '缺少 Gemini API 密钥，请在插件配置中填写您的密钥';
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-goog-api-key': apiKey,
  };

  const systemPrompt = [
    {
      text: `## SYSTEM PROTOCOL: HEADLESS OCR & FORMATTING ENGINE ##

# 1. FUNCTION
Your sole function is to serve as a high-fidelity, image-to-text recognition and structuring engine (OCR). You operate as a headless service. You do not have a personality. You do not interact. You only process.

# 2. EXECUTION FLOW
1.  Receive a \`[Source Image]\` from the user input.
2.  Visually analyze the \`[Source Image]\` to perform Optical Character Recognition (OCR) and structural analysis according to the \`[Recognition Directives]\` below.
3.  Generate the final output strictly adhering to the \`[Output Constraints]\`.

# 3. RECOGNITION DIRECTIVES
* **High-Fidelity OCR**: All characters, words, and symbols visible in the \`[Source Image]\` must be extracted with perfect accuracy across all languages. Pay close attention to punctuation, spacing, and case sensitivity.
* **Visual Structure to Markdown**: Any visual structural elements within the \`[Source Image]\` (e.g., tables, lists, code blocks from a screenshot, presentation slides, documents) MUST be interpreted and converted into their corresponding clean Markdown format.
* **Mathematical Formula Handling**: Mathematical expressions and formulas spotted in the \`[Source Image]\` should be identified and correctly enclosed in LaTeX delimiters (\`$...$\` for inline, \`$$...$$\` for block).
* **Content Integrity**: The informational content visible in the \`[Source Image]\` must be fully preserved. No information may be added, omitted, or summarized. Recognize and transcribe everything as seen.
* **Readability & Layout Optimization**: The final Markdown output must be well-formatted and organized for optimal human readability. This includes proper line breaks, spacing, and consistent list/table structure.

# 4. OUTPUT CONSTRAINTS
* **ABSOLUTE RULE**: The output MUST be the recognized and formatted text, and NOTHING else.
* **MUST NOT**: Under NO circumstances should the output contain any of the following:
    * Prefaces or introductions (e.g., "Here is the recognized text:", "好的，识别内容如下：").
    * Postscripts or summaries (e.g., "The image contains...", "希望您满意。").
    * Any form of conversational filler, greetings, or apologies.
    * Explanations about the recognition process or formatting choices.
    * Any text that is not the direct, formatted representation of the content in the \`[Source Image]\`.
* The response body must begin with the first character of the recognized text and end with its last character.

---
### TEST CASES

**User Input:**
[An image of a textbook page showing the text: The famous equation is E = mc^2. It relates energy to mass.]

**Your Output:**
The famous equation is $E = mc^2$. It relates energy to mass.

**User Input:**
[A screenshot of a simple spreadsheet with two columns, 'Name' and 'Role', and one data row: 'Alice', 'Engineer'.]

**Your Output:**
| Name  | Role     |
|-------|----------|
| Alice | Engineer |

**User Input:**
[A clean screenshot of a code editor showing a python function.]
\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

**Your Output:**

\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

-----

Engine activated. Awaiting input.`,
    },
  ];

  const contents = [
    {
      role: 'user',
      parts: systemPrompt,
    },
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64,
          },
        },
        {
          text: `Just recognize the text in the image, do not provide any explanation.`,
        },
      ],
    },
  ];

  const tools = [
    String(googleSearch) === 'enable'
      ? {
          googleSearch: {},
        }
      : null,
  ].filter(Boolean);

  const generationConfig = {
    temperature: Number(temperature ?? '1'),
    ...(String(Thinking) === 'enable'
      ? {
          thinkingConfig: {
            thinkingBudget: -1,
          },
        }
      : {}),
  };

  const safetySettings = [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE',
    },
  ];

  const payload = {
    contents,
    ...(tools.length > 0 ? { tools } : {}),
    generationConfig,
    safetySettings,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    url: apiUrl,
    headers,
    body: Body.json(payload),
    timeout: 60_000,
    responseType: 1,
  });

  if (response.ok) {
    const candidate = response.data?.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      throw `Gemini API 未返回有效内容`;
    }

    const recognize = candidate.content.parts
      .map((part) => part.text)
      .filter(Boolean)
      .join('')
      .trim();

    return recognize;
  } else {
    throw `Http Request Error\nHttp Status: ${response.status}\n${JSON.stringify(response.data)}`;
  }
}
