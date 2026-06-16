var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dns = __toESM(require("dns"), 1);
import_dns.default.setDefaultResultOrder("ipv4first");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
async function generateContentWithFallback(aiClient, params) {
  let requestModel = params.model || "gemini-2.5-flash";
  if (requestModel === "gemini-3.5-flash") {
    requestModel = "gemini-2.5-flash";
  }
  const fallbackModel = "gemini-2.0-flash-lite";
  try {
    return await aiClient.models.generateContent({
      ...params,
      model: requestModel
    });
  } catch (err) {
    const errorStr = typeof err === "object" ? JSON.stringify(err) : String(err);
    const isTemporary = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand") || errorStr.includes("busy") || errorStr.includes("rate limit") || errorStr.includes("Rate limit") || err.status === 503 || err.status === 429;
    if (!isTemporary) {
      throw err;
    }
    console.warn(`[Gemini] ${requestModel} est\xE1 temporariamente indispon\xEDvel devido a alta demanda (Erro: ${err.message || err}). Tentando fallback para ${fallbackModel} ap\xF3s 1 segundo...`);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    try {
      return await aiClient.models.generateContent({
        ...params,
        model: fallbackModel
      });
    } catch (fallbackErr) {
      console.warn(`[Gemini] Fallback ${fallbackModel} tamb\xE9m falhou. Tentando uma \xFAltima vez com o modelo principal ${requestModel} ap\xF3s 1.5s...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        return await aiClient.models.generateContent({
          ...params,
          model: requestModel
        });
      } catch (retryErr) {
        console.error(`[Gemini] Todas as tentativas falharam.`);
        throw retryErr;
      }
    }
  }
}
app.get("/api/github/repos", async (req, res) => {
  const { username, token } = req.query;
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "O nome de usu\xE1rio do GitHub \xE9 obrigat\xF3rio." });
    return;
  }
  try {
    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Sites-Hub-AI-Studio"
    };
    if (token && typeof token === "string" && token.trim() !== "") {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const githubUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
    const response = await fetch(githubUrl, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({ error: `Usu\xE1rio do GitHub "${username}" n\xE3o encontrado.` });
        return;
      }
      if (response.status === 403) {
        res.status(403).json({
          error: "Limite de requisi\xE7\xF5es do GitHub atingido para este IP. Insira um Token de Acesso Pessoal (PAT) nas configura\xE7\xF5es para continuar ou tente mais tarde."
        });
        return;
      }
      throw new Error(`GitHub API returned state: ${response.status} ${response.statusText}`);
    }
    const repos = await response.json();
    res.json(repos);
  } catch (error) {
    console.error("Erro ao buscar reposit\xF3rios do GitHub:", error);
    res.status(500).json({ error: error.message || "Falha ao conectar com a API do GitHub." });
  }
});
app.get("/api/github/readme", async (req, res) => {
  const { owner, repo, defaultBranch } = req.query;
  if (!owner || !repo) {
    res.status(400).json({ error: "Par\xE2metros 'owner' e 'repo' s\xE3o obrigat\xF3rios." });
    return;
  }
  const branch = defaultBranch || "main";
  const readmeUrls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/readme.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/readme.md`
  ];
  for (const url of readmeUrls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        res.json({ readme: text.substring(0, 4e3) });
        return;
      }
    } catch (e) {
    }
  }
  res.json({ readme: "" });
});
app.post("/api/github/analyze", async (req, res) => {
  const { repoName, description, homepage, topics, readme, language } = req.body;
  if (!repoName) {
    res.status(400).json({ error: "O nome do reposit\xF3rio \xE9 obrigat\xF3rio para an\xE1lise." });
    return;
  }
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: "Chave de API do Gemini n\xE3o configurada no servidor. Cadastre-a nas configura\xE7\xF5es."
      });
      return;
    }
    const prompt = `Analise as informa\xE7\xF5es do seguinte reposit\xF3rio do GitHub e seu respectivo site anunciado para criar metadados ricos em Portugu\xEAs (Brasil) para exibi\xE7\xE3o em um painel central de portf\xF3lio.

Reposit\xF3rio: ${repoName}
Descri\xE7\xE3o fornecida no GitHub: ${description || "Sem descri\xE7\xE3o"}
URL do Site Deployed: ${homepage || "Sem homepage listada"}
T\xF3picos/Tags: ${Array.isArray(topics) ? topics.join(", ") : "Nenhum"}
Linguagem Principal: ${language || "N\xE3o especificada"}

Conte\xFAdo resumido do README.md do projeto:
${readme || "Nenhum README dispon\xEDvel."}

Instru\xE7\xF5es:
1. Com base no nome, descri\xE7\xE3o, tags e README, determine DO QUE SE TRATA o projeto. Crie uma descri\xE7\xE3o elegante, atrativa e profissional em Portugu\xEAs, ideal para um card de portf\xF3lio de alta categoria. (M\xE1ximo de 3 frases curtas e impactantes).
2. Categorize-o em uma das seguintes categorias padr\xE3o ou similar relevante: Portf\xF3lio, Landing Page, E-commerce, Dashboard/Painel, Jogo, Utilit\xE1rio/Ferramenta, Blog, Aplicativo Web, Landing Page Produto, API/Backend.
3. Extraia o stack de tecnologias usadas relevantes (ex: React, Tailwind CSS, TypeScript, Vite, Node.js, CSS3, etc.).
4. Identifique at\xE9 3 recursos/destaques principais do projeto (funcionalidades inovadoras ou diferenciais).
5. Sugira at\xE9 2 dicas inteligentes de melhoria ou pr\xF3ximo passo para o projeto.
6. Forne\xE7a uma nota de portf\xF3lio criativa de 50 a 100 baseado na completeza do projeto (quantidade de informa\xE7\xF5es, readme estruturado, etc).`;
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Voc\xEA \xE9 um especialista em desenvolvimento web, avalia\xE7\xE3o de UI/UX e escrita t\xE9cnica. Seu trabalho \xE9 analisar reposit\xF3rios e gerar respostas estruturadas extremamente profissionais e em portugu\xEAs.",
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["description", "category", "techStack", "highlights", "tips", "portfolioScore"],
          properties: {
            description: {
              type: import_genai.Type.STRING,
              description: "Nova descri\xE7\xE3o polida de alta qualidade em portugu\xEAs (Brasil) para o card do portf\xF3lio."
            },
            category: {
              type: import_genai.Type.STRING,
              description: "Categoria ideal do site (ex: Portf\xF3lio, E-commerce, Landing Page, Jogo, Utilit\xE1rio, etc.)"
            },
            techStack: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "Lista de tecnologias proeminentes detectadas."
            },
            highlights: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "At\xE9 3 pontos fortes/funcionalidades de destaque do projeto."
            },
            tips: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "At\xE9 2 sugest\xF5es inteligentes de melhoria."
            },
            portfolioScore: {
              type: import_genai.Type.INTEGER,
              description: "Uma pontua\xE7\xE3o de 50 a 100 para o projeto com base no n\xEDvel de documenta\xE7\xE3o e escopo."
            }
          }
        }
      }
    });
    const parsedData = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedData);
  } catch (error) {
    console.error("Erro na an\xE1lise do Gemini:", error);
    res.status(500).json({ error: error.message || "Falha na an\xE1lise de IA com o Gemini." });
  }
});
app.post("/api/gemini/validate", async (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== "string" || key.trim() === "") {
    res.status(400).json({ success: false, error: "Chave n\xE3o informada." });
    return;
  }
  try {
    const tempAi = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const response = await generateContentWithFallback(tempAi, {
      model: "gemini-3.5-flash",
      contents: "Diga apenas a palavra 'OK' em mai\xFAsculo."
    });
    if (response.text && response.text.trim().includes("OK")) {
      res.json({ success: true });
    } else {
      res.json({ success: true, warning: "Chave v\xE1lida, mas formato de resposta inesperado." });
    }
  } catch (err) {
    console.error("Erro ao validar chave Gemini:", err);
    res.status(400).json({ success: false, error: err.message || "Chave inv\xE1lida ou erro na valida\xE7\xE3o." });
  }
});
app.post("/api/theme/customize", async (req, res) => {
  const { prompt, image, mimeType, userKey, scope = "layout" } = req.body;
  const activeApiKey = userKey && typeof userKey === "string" && userKey.trim() !== "" ? userKey : process.env.GEMINI_API_KEY;
  if (!activeApiKey) {
    res.status(400).json({
      error: "Para personalizar o tema usando IA, \xE9 necess\xE1rio configurar a Chave de API do Gemini no painel de expans\xE3o."
    });
    return;
  }
  try {
    const tempAi = new import_genai.GoogleGenAI({
      apiKey: activeApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    let scopeInstruction = "";
    if (scope === "colors") {
      scopeInstruction = "MODO DE ESCOPO: [SUBSTITUIR APENAS CORES]. Mude estritamente as propriedades de cor (bg, card, border, accent, text, gray, glowHex, gridOverlay) gerando paletas lindas e coerentes com contraste WCAG AA. O campo 'extraCSS' DEVE ser vazio ou conter apenas vari\xE1veis, preservando todo o layout, fontes originais, margens e padding intocados.";
    } else if (scope === "refine") {
      scopeInstruction = "MODO DE ESCOPO: [APENAS REFINAR LAYOUT]. Fa\xE7a pequenos refinamentos cosm\xE9ticos no tema, tipografias e pequenos extras de CSS (bordas, sutis sombras ou transi\xE7\xF5es) baseados no prompt sem causar mudan\xE7as bruscas de estrutura\xE7\xE3o f\xEDsica do app.";
    } else {
      scopeInstruction = "MODO DE ESCOPO: [TODO O LAYOUT]. Voc\xEA est\xE1 plenamente autorizado e incentivado a revolucionar a apar\xEAncia e layout de qualquer componente de forma radical, usando o campo 'extraCSS' para estilizar livremente seletores chaves do app. Garanta que a ess\xEAncia e as funcionalidades (inputs, listas, links de click e bot\xF5es) funcionem com perfei\xE7\xE3o!";
    }
    const runPrompt = `Voc\xEA \xE9 um Designer Web Expert e engenheiro de interfaces ricas. O usu\xE1rio quer redefinir totalmente a cara do seu app HUB de projetos.

${scopeInstruction}

${prompt ? `Solicita\xE7\xE3o do usu\xE1rio: "${prompt}"` : "Crie um estilo inovador baseado na refer\xEAncia de imagem anexada."}

DIRETRIZES DE ESTILO, REARRANJO DE ELEMENTOS E USO MULTIMODAL DE IMAGEM:
1. REARRANJO DE LAYOUT E MUDAN\xC7A DE POSI\xC7\xC3O:
Se o usu\xE1rio solicitar rearranjos de posi\xE7\xE3o ou modifica\xE7\xF5es gen\xE9ricas (ex: "Mude de posi\xE7\xE3o os cards", "Crie colunas", "Coloque a barra lateral na direita", "Sidebar no topo", "Mude tudo", etc.), voc\xEA tem total autoridade para alterar estruturalmente o layout usando a propriedade CSS 'extraCSS'. Por exemplo:
- Para mover a barra lateral para a direita: '#cyber-app-root { flex-direction: row-reverse !important; }'
- Para colocar a barra lateral no topo (como cabe\xE7alho): '#cyber-app-root { flex-direction: column !important; } #cyber-sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--color-cyber-border) !important; flex-direction: row !important; align-items: center !important; }'
- Para mudar os cards para modo lista vertical ampla: '#cyber-projects-grid { grid-template-columns: 1fr !important; }'
- Voc\xEA tamb\xE9m pode usar as propriedades Flexbox/Grid 'order' para reordenar elementos livremente!

2. INSER\xC7\xC3O DIRETA DA IMAGEM CARREGADA:
Se houver uma imagem carregada pelo usu\xE1rio (voc\xEA a receber\xE1 em formato multimodal), e ele pedir para inseri-la de fato na p\xE1gina ou como elemento visual real (ex: "Insira esta imagem como plano de fundo", "Use como logotipo do app", "Coloque a tela de fundo com esse desenho", etc.), use a vari\xE1vel CSS global '--user-uploaded-image' que exp\xF5e o data-URI no frontend!
Por exemplo: 
- '#cyber-app-root { background-image: var(--user-uploaded-image) !important; background-size: cover !important; background-position: center !important; }'
- Ou usar como logotipo/efeito no sidebar: '#cyber-sidebar::before { content: ""; background-image: var(--user-uploaded-image) !important; ... }'
Isso possibilita a inser\xE7\xE3o limpa e em tempo de execu\xE7\xE3o da imagem fornecida pelo usu\xE1rio, de acordo com o pedido!

DIRETRIZES DE MANIPULA\xC7\xC3O DE COMPONENTES:
O aplicativo HTML e CSS no frontend exp\xF5e os seguintes IDs e classes para estiliza\xE7\xE3o via 'extraCSS' (apenas quando o escopo permitir modifica\xE7\xF5es de layout):
- '#cyber-app-root': O cont\xEAiner pai de toda a tela viewport.
- '#cyber-sidebar': O menu de barra lateral (desktop) / cabe\xE7alho superior (celular). Voc\xEA pode mudar seu background, largura, bordas, sombras ou transforma\xE7\xF5es.
- '#cyber-sidebar-logo-group': Logotipo e t\xEDtulo reduzido na barra lateral.
- '#cyber-sidebar-metrics': Cart\xF5es e m\xE9tricas de monitoramento num\xE9rico.
- '#cyber-sidebar-active-index': Status de indexador e bot\xE3o de acesso ao GitHub.
- '#cyber-content-area': O painel principal \xE0 direita que rola e renderiza os aplicativos.
- '#cyber-filters-header': Painel de filtro de categorias, barra de busca e t\xEDtulo.
- '#cyber-search-controls': Linha com os campos de input, selects e filtros.
- '#cyber-projects-grid': O grid CSS que alinha os cart\xF5es.
- '.repo-card': Os cart\xF5es de reposit\xF3rios individuais. Pode customizar seu padding, border-radius, background, hover triggers, etc.
- '#btn-open-ai-customizer': O bot\xE3o flutuante de IA do design menu.
- '#btn-github-access': O bot\xE3o de credencial GitHub.

Crie um estilo impec\xE1vel em Portugu\xEAs. As cores devem garantir excelente legibilidade. O visual pode ser qualquer coisa que combine com a solicita\xE7\xE3o: vintage, fic\xE7\xE3o cient\xEDfica cyberpunk neon, m\xEDstico, minimalista n\xF3rdico, editorial de alta costura, brutalista moderno ou futurista cintilante. Retorne apenas o JSON no formato requisitado pelo esquema de estilo.`;
    const contentsParts = [];
    if (image && typeof image === "string" && image.trim() !== "") {
      const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
      contentsParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/png"
        }
      });
    }
    contentsParts.push({
      text: runPrompt
    });
    const response = await generateContentWithFallback(tempAi, {
      model: "gemini-3.5-flash",
      contents: { parts: contentsParts },
      config: {
        systemInstruction: "Voc\xEA \xE9 um gerador determinista altamente criativo de temas e estilos de aplica\xE7\xE3o de backend que retorna dados JSON compat\xEDveis com o esquema de estilo.",
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["name", "pageTitle", "description", "sidebarTitle", "theme"],
          properties: {
            name: {
              type: import_genai.Type.STRING,
              description: "Nome customizado para o APP HUB (ex: Lyra Studio - App Hub, ou algo inspirado pelo prompt/estilo)."
            },
            pageTitle: {
              type: import_genai.Type.STRING,
              description: "T\xEDtulo elegante da p\xE1gina para aparecer na aba do navegador (ex: \u{1F680} Lyra Core, \u{1F52E} Cyber Hub, etc)"
            },
            description: {
              type: import_genai.Type.STRING,
              description: "Subt\xEDtulo do HUB sintonizado com o estilo visual definido."
            },
            sidebarTitle: {
              type: import_genai.Type.STRING,
              description: "T\xEDtulo reduzido da marca na barra lateral superior (ex: LYRA STUDIO ou sigla)."
            },
            theme: {
              type: import_genai.Type.OBJECT,
              required: ["bg", "card", "border", "accent", "text", "gray", "gridOverlay", "glowHex", "fontSans", "fontDisplay", "extraCSS", "customIconSVG"],
              properties: {
                bg: { type: import_genai.Type.STRING, description: "Cor hex do fundo principal" },
                card: { type: import_genai.Type.STRING, description: "Cor hex de fundo dos componentes/cards" },
                border: { type: import_genai.Type.STRING, description: "Cor hex de bordas e divisores" },
                accent: { type: import_genai.Type.STRING, description: "Cor hex principal de destaques vibrantes" },
                text: { type: import_genai.Type.STRING, description: "Cor hex do texto principal" },
                gray: { type: import_genai.Type.STRING, description: "Cor hex do texto secund\xE1rio" },
                gridOverlay: { type: import_genai.Type.STRING, description: "F\xF3rmula de background CSS para o fundo do viewport (ex: gradientes, patterns ou grids)." },
                glowHex: { type: import_genai.Type.STRING, description: "Sombra de relevo ou cor brilhante (ex: rgba(x, y, z, 0.25) ou hex)." },
                fontSans: { type: import_genai.Type.STRING, description: "Font-family sans-serif padr\xE3o para o corpo do texto" },
                fontDisplay: { type: import_genai.Type.STRING, description: "Font-family para os headers e logos" },
                extraCSS: { type: import_genai.Type.STRING, description: "Trecho de c\xF3digo CSS adicional se precisar para injetar no container." },
                customIconSVG: {
                  type: import_genai.Type.STRING,
                  description: 'Um \xEDcone vetorizado completo e bel\xEDssimo em formato SVG estruturado dentro de uma tag <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">. Crie gradientes, estrelas de quatro pontas cintilantes, formas abstratas ou letras estilizadas condizentes com o tema solicitado. Use as cores do tema!'
                }
              }
            }
          }
        }
      }
    });
    const parsedTheme = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedTheme);
  } catch (error) {
    console.error("Erro na personaliza\xE7\xE3o com Gemini:", error);
    res.status(500).json({ error: error.message || "Erro para personalizar com a Intelig\xEAncia Artificial." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] rodando com sucesso no endere\xE7o http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
