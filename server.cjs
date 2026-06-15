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
    const response = await ai.models.generateContent({
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
