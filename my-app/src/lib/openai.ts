import OpenAI from "openai";
import * as cheerio from "cheerio";

// Importação condicional do Puppeteer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  puppeteer = require("puppeteer");
} catch {
  console.warn(
    "Puppeteer não está disponível. Screenshots serão desabilitados."
  );
}

// Configurar cliente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//Interface para o resultado da análise
export interface CopyAnalysis {
  score: number; //0-100
  strengths: string[]; // Pontos fortes identificados
  weaknesses: string[]; // Pontos fracos identificados
  suggestions: string[]; // Sugestões de melhoria
  mentalTriggers: string[]; // Gatilhos mentais presentes
  emotionalTone: string; // Tom emocional identificado
  targetAudience: string; // Público sugerido
  websiteImageCount?: number; // Número de imagens extraídas de websites
  websiteScreenshot?: string; // Screenshot da página para análise visual
  visualObservations?: VisualObservation[]; // Observações visuais específicas
}

export interface VisualObservation {
  section: string; // Nome da seção (Header, Hero, CTA, etc.)
  observation: string; // Observação específica
  type: "positive" | "negative" | "neutral"; // Tipo da observação
  position?: { x: number; y: number }; // Posição aproximada na página (opcional)
}

interface ImageData {
  name: string;
  base64: string;
}

interface WebsiteData {
  url: string;
  title?: string;
}

function cleanJsonResponse(response: string): string {
  // Remove markdown blocks
  let cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");

  // Remove espaços extras no início e fim
  cleaned = cleaned.trim();

  // Se começar com texto antes do JSON, tenta encontrar o JSON
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

// Interface para dados extraídos do website
interface ExtractedWebsiteData {
  textContent: string;
  screenshot?: string; // Screenshot em base64
  images: ImageData[];
}

// Função para encontrar executável do Chrome no sistema
function findChromeExecutable(): string | undefined {
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const path of possiblePaths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (require("fs").existsSync(path)) {
        console.log(`Chrome encontrado: ${path}`);
        return path;
      }
    } catch {
      continue;
    }
  }

  console.warn("Chrome não encontrado no sistema");
  return undefined;
}

// Função para capturar screenshot da página completa
async function captureFullPageScreenshot(url: string): Promise<string | null> {
  // Verificar se Puppeteer está disponível
  if (!puppeteer) {
    console.warn("Puppeteer não disponível. Pulando captura de screenshot.");
    return null;
  }

  let browser;
  try {
    console.log(`Iniciando captura de screenshot de: ${url}`);

    // Configuração robusta com anti-detecção
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const launchOptions: any = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-blink-features=AutomationControlled",
        "--disable-plugins-discovery",
        "--disable-default-apps",
        "--no-default-browser-check",
        "--disable-sync",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
      ],
    };

    // Tentar usar Chrome do sistema primeiro
    const chromeExecutable = findChromeExecutable();
    if (chromeExecutable) {
      launchOptions.executablePath = chromeExecutable;
      console.log(`Usando Chrome do sistema: ${chromeExecutable}`);
    }

    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (error) {
      console.error("Erro ao iniciar com Chrome do sistema:", error);
      console.log("Tentando usar Chrome interno do Puppeteer...");

      // Tentar sem especificar executável
      delete launchOptions.executablePath;
      try {
        browser = await puppeteer.launch(launchOptions);
      } catch (secondError) {
        console.error("Erro ao usar Chrome interno do Puppeteer:", secondError);
        console.warn("Screenshots não disponíveis - Chrome não encontrado");
        return null;
      }
    }

    const page = await browser.newPage();

    // Configurações anti-detecção
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      delete (window as unknown as { navigator: { webdriver?: unknown } })
        .navigator.webdriver;

      // Override the plugin array
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override the languages property
      Object.defineProperty(navigator, "languages", {
        get: () => ["pt-BR", "pt", "en"],
      });
    });

    // Configurar viewport para desktop
    await page.setViewport({
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
    });

    // Headers mais realistas
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    // User agent mais atual
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Múltiplas tentativas com estratégias diferentes
    let screenshot = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Tentativa ${attempt}/${maxAttempts} para acessar: ${url}`);

        // Navegar para a página com configurações menos restritivas
        await page.goto(url, {
          waitUntil: "networkidle2", // Espera até não haver requisições por 500ms
          timeout: 30000,
        });

        // Aguardar carregamento completo com estratégias inteligentes
        console.log(`Aguardando carregamento completo da página...`);

        // 1. Aguardar elementos essenciais carregarem
        await page
          .waitForFunction(
            () => {
              return (
                (document.readyState === "complete" &&
                  document.images.length === 0) ||
                Array.from(document.images).every((img) => img.complete)
              );
            },
            { timeout: 10000 }
          )
          .catch(() =>
            console.log("Timeout aguardando imagens, continuando...")
          );

        // 2. Aguardar fontes carregarem
        await page
          .waitForFunction(() => document.fonts && document.fonts.ready, {
            timeout: 5000,
          })
          .catch(() =>
            console.log("Timeout aguardando fontes, continuando...")
          );

        // 3. Aguardar possíveis animações/transições CSS
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 4. Tentar aguardar lazy loading e conteúdo dinâmico
        await page.evaluate(() => {
          // Scroll para ativar lazy loading
          window.scrollTo(0, document.body.scrollHeight);
          return new Promise((resolve) => setTimeout(resolve, 1000));
        });

        // 5. Voltar ao topo para o screenshot
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          return new Promise((resolve) => setTimeout(resolve, 500));
        });

        // 6. Aguardar elementos visuais específicos carregarem
        await page
          .waitForFunction(
            () => {
              // Verificar se há elementos de loading ou spinners
              const loadingElements = document.querySelectorAll(
                '[class*="loading"], [class*="spinner"], [class*="loader"], .loading, .spinner'
              );
              return (
                loadingElements.length === 0 ||
                Array.from(loadingElements).every(
                  (el) =>
                    getComputedStyle(el).display === "none" ||
                    getComputedStyle(el).visibility === "hidden"
                )
              );
            },
            { timeout: 5000 }
          )
          .catch(() =>
            console.log(
              "Alguns elementos de loading ainda visíveis, continuando..."
            )
          );

        // 7. Aguardar vídeos/iframes carregarem
        await page
          .waitForFunction(
            () => {
              const videos = document.querySelectorAll("video");
              const iframes = document.querySelectorAll("iframe");
              return (
                (Array.from(videos).every((video) => video.readyState >= 3) &&
                  Array.from(iframes).length === 0) ||
                Array.from(iframes).every((iframe) => iframe.src !== "")
              );
            },
            { timeout: 3000 }
          )
          .catch(() =>
            console.log("Timeout aguardando vídeos/iframes, continuando...")
          );

        // 8. Aguardar execução de JavaScript e renderização final
        await page
          .waitForFunction(
            () => {
              // Verificar se não há requisições pendentes
              const navigationEntry = performance.getEntriesByType(
                "navigation"
              )[0] as PerformanceNavigationTiming;
              return navigationEntry && navigationEntry.loadEventEnd > 0;
            },
            { timeout: 2000 }
          )
          .catch(() =>
            console.log(
              "Timeout aguardando finalização completa, continuando..."
            )
          );

        // 9. Delay final pequeno para garantir renderização
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verificar se a página carregou
        const title = await page.title();
        console.log(`Página completamente carregada: ${title}`);

        // Capturar screenshot
        screenshot = await page.screenshot({
          fullPage: attempt <= 2,
          type: "png",
          encoding: "base64",
        });

        console.log(
          `Screenshot capturado com sucesso para: ${url} (tentativa ${attempt})`
        );
        break;
      } catch (attemptError) {
        console.warn(`Tentativa ${attempt} falhou:`, attemptError);

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (screenshot) {
      return `data:image/png;base64,${screenshot}`;
    } else {
      console.warn("Todas as tentativas falharam");
      return null;
    }
  } catch (error) {
    console.error(`Erro geral ao capturar screenshot de ${url}:`, error);
    console.warn("Screenshot não disponível - continuando análise sem imagem");
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Erro ao fechar browser:", closeError);
      }
    }
  }
}

// Função para converter imagem de URL para base64 (reservada para uso futuro)
/* eslint-disable @typescript-eslint/no-unused-vars */
async function urlToBase64(
  imageUrl: string,
  baseUrl: string
): Promise<string | null> {
  try {
    // Converter URL relativa para absoluta
    const absoluteUrl = new URL(imageUrl, baseUrl).href;

    const response = await fetch(absoluteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Erro ao converter imagem ${imageUrl} para base64:`, error);
    return null;
  }
}

// Função para extrair conteúdo COMPLETO de websites (texto + screenshot)
async function extractWebsiteContent(
  websites: WebsiteData[]
): Promise<ExtractedWebsiteData> {
  let textContent = "";
  let mainScreenshot: string | null = null;

  for (const website of websites) {
    try {
      // ===== CAPTURA DE SCREENSHOT COMPLETO =====
      console.log(`Tentando capturar screenshot completo de ${website.url}...`);

      if (puppeteer) {
        const screenshot = await captureFullPageScreenshot(website.url);

        if (screenshot && !mainScreenshot) {
          mainScreenshot = screenshot;
          console.log(`Screenshot capturado com sucesso para ${website.url}`);
        }
      } else {
        console.log("Puppeteer não disponível, pulando screenshot");
      }

      // ===== EXTRAÇÃO DE TEXTO PARA CONTEXTO =====
      const response = await fetch(website.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove elementos desnecessários
        $("script").remove();
        $("style").remove();
        $("nav").remove();
        $("footer").remove();
        $("header").remove();
        $("noscript").remove();

        const title = $("title").text().trim() || website.title || "Sem título";

        // Extrair meta descrição
        const metaDescription =
          $('meta[name="description"]').attr("content") ||
          $('meta[property="og:description"]').attr("content") ||
          "";

        // Extrair headings principais
        const headings = $("h1, h2, h3")
          .map((i, el) => $(el).text().trim())
          .get()
          .filter((h) => h.length > 0)
          .join(" | ");

        // Extrair textos de botões e CTAs
        const buttons = $(
          "button, .btn, .cta, a[class*='button'], input[type='submit']"
        )
          .map((i, el) => $(el).text().trim() || $(el).attr("value") || "")
          .get()
          .filter((btn) => btn.length > 0)
          .join(" | ");

        // Extrair conteúdo principal
        const mainContent =
          $("main").text() ||
          $("article").text() ||
          $(".content").text() ||
          $("body").text() ||
          "";

        // Extrair textos de formulários
        const formLabels = $(
          "label, .form-label, input[placeholder], textarea[placeholder]"
        )
          .map((i, el) => {
            const text = $(el).text().trim();
            const placeholder = $(el).attr("placeholder");
            return text || placeholder || "";
          })
          .get()
          .filter((label) => label.length > 0)
          .join(" | ");

        // Extrair informações de preços
        const priceElements = $(
          "[class*='price'], [class*='valor'], [id*='price'], [id*='valor']"
        )
          .map((i, el) => $(el).text().trim())
          .get()
          .filter(
            (price) => price.length > 0 && /[R$€$£¥]|\d+[.,]\d+/.test(price)
          )
          .join(" | ");

        textContent += `\n\n=== ANÁLISE TEXTUAL DO SITE: ${title} (${website.url}) ===\n`;
        if (metaDescription)
          textContent += `META DESCRIÇÃO: ${metaDescription}\n`;
        if (headings) textContent += `TÍTULOS PRINCIPAIS: ${headings}\n`;
        if (buttons) textContent += `BOTÕES E CTAs: ${buttons}\n`;
        if (formLabels)
          textContent += `ELEMENTOS DE FORMULÁRIO: ${formLabels}\n`;
        if (priceElements)
          textContent += `PREÇOS IDENTIFICADOS: ${priceElements}\n`;
        textContent += `CONTEÚDO RESUMIDO: ${mainContent
          .substring(0, 4000)
          .replace(/\s+/g, " ")
          .trim()}...\n`;

        if (mainScreenshot) {
          textContent += `STATUS: Screenshot da página completa capturado para análise visual detalhada.\n`;
        } else {
          textContent += `STATUS: Análise baseada apenas no conteúdo textual (screenshot não disponível).\n`;
        }
      }
    } catch (error) {
      console.error(`Erro ao processar ${website.url}:`, error);
      textContent += `\n\nSITE: ${website.url} - Erro ao processar conteúdo\n`;
    }
  }

  return {
    textContent,
    screenshot: mainScreenshot || undefined,
    images: [], // Não usamos mais imagens individuais, apenas o screenshot completo
  };
}

export async function analyzeCopyWithAI(
  copytext?: string,
  images?: ImageData[],
  websites?: WebsiteData[]
): Promise<CopyAnalysis> {
  try {
    // Extrair conteúdo dos websites se fornecidos
    let websiteData: ExtractedWebsiteData = { textContent: "", images: [] };
    if (websites && websites.length > 0) {
      websiteData = await extractWebsiteContent(websites);
    }

    // Combinar imagens: as enviadas pelo usuário + o screenshot do website
    const allImages = [...(images || [])];

    // Adicionar screenshot se disponível
    if (websiteData.screenshot) {
      allImages.push({
        name: "website_full_screenshot",
        base64: websiteData.screenshot,
      });
    }

    // Construir prompt baseado no que foi fornecido
    let prompt = `Analise o conteúdo de marketing digital como um especialista.

`;

    if (copytext) {
      prompt += `COPY PARA ANÁLISE:
"${copytext}"

`;
    }

    if (websiteData.textContent) {
      prompt += `CONTEÚDO DOS WEBSITES:
${websiteData.textContent}

`;
    }

    if (allImages && allImages.length > 0) {
      const screenshotCount = websiteData.screenshot ? 1 : 0;
      const userImageCount = images?.length || 0;
      prompt += `IMAGENS PARA ANÁLISE: ${allImages.length} imagem(ns) total
      - ${userImageCount} imagens enviadas pelo usuário
      - ${screenshotCount} screenshot completo da página${
        screenshotCount > 0 ? " (PÁGINA COMPLETA VISÍVEL)" : ""
      }

`;
    }

    prompt += `IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem explicações extras.

Formato esperado:
{
  "score": [número de 0-100],
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "weaknesses": ["ponto fraco 1", "ponto fraco 2"], 
  "suggestions": ["sugestão específica 1", "sugestão específica 2"],
  "mentalTriggers": ["gatilho 1", "gatilho 2"],
  "emotionalTone": "descrição do tom emocional",
  "targetAudience": "descrição do público-alvo ideal"${
    websiteData.screenshot
      ? `,
  "visualObservations": [
    {
      "section": "Header/Cabeçalho",
      "observation": "observação específica sobre o cabeçalho",
      "type": "positive|negative|neutral"
    },
    {
      "section": "Hero/Seção Principal", 
      "observation": "observação sobre a seção hero",
      "type": "positive|negative|neutral"
    },
    {
      "section": "Call-to-Action",
      "observation": "observação sobre os CTAs",
      "type": "positive|negative|neutral"
    },
    {
      "section": "Layout Geral",
      "observation": "observação sobre o layout",
      "type": "positive|negative|neutral"
    },
    {
      "section": "Elementos Visuais",
      "observation": "observação sobre cores, tipografia, etc",
      "type": "positive|negative|neutral"
    }
  ]`
      : ""
  }
}

CRITÉRIOS DE AVALIAÇÃO:
- Clareza da proposta de valor (25 pontos)
- Urgência e escassez (20 pontos)  
- Prova social e credibilidade (20 pontos)
- Call-to-action efetivo (15 pontos)
- Conexão emocional (10 pontos)
- Estrutura e fluência (10 pontos)

${
  allImages && allImages.length > 0
    ? `ANÁLISE VISUAL COMPLETA: ${
        websiteData.screenshot
          ? "Você tem acesso ao SCREENSHOT COMPLETO da página"
          : "Analise as imagens fornecidas"
      }. Considere:
       ${
         websiteData.screenshot
           ? "- Layout geral da página e hierarquia visual"
           : ""
       }
       ${
         websiteData.screenshot
           ? "- Posicionamento e destaque dos elementos principais"
           : ""
       }
       ${websiteData.screenshot ? "- Cores dominantes e paleta cromática" : ""}
       ${websiteData.screenshot ? "- Tipografia e legibilidade" : ""}
       ${
         websiteData.screenshot
           ? "- Elementos de conversão (botões, formulários, CTAs)"
           : ""
       }
       ${websiteData.screenshot ? "- Espaçamento e organização visual" : ""}
       ${websiteData.screenshot ? "- Profissionalismo geral do design" : ""}
       - Como os elementos visuais complementam ou contradizem a mensagem textual
       - Se os elementos visuais reforçam os gatilhos mentais identificados
       - Qualidade visual e profissionalismo
       - Coerência visual com o público-alvo
       - Se geram credibilidade e confiança
       - Elementos que podem melhorar a conversão
       
       ${
         websiteData.screenshot
           ? `**OBRIGATÓRIO**: Para screenshots de página, SEMPRE inclua o campo "visualObservations" com pelo menos 5 observações específicas sobre diferentes seções da página (Header, Hero, CTAs, Layout, etc.).`
           : ""
       }`
    : ""
}

${
  websites && websites.length > 0
    ? `ANÁLISE COMPLETA DE WEBSITE: ${
        websiteData.screenshot
          ? "Com o screenshot completo da página"
          : "Com o conteúdo extraído"
      }, analise TODO o conteúdo comparando com boas práticas de copy e design para websites. Identifique elementos ausentes que poderiam melhorar a conversão e analise a coerência entre elementos visuais e textuais. ${
        websiteData.screenshot
          ? "Use o screenshot para uma análise visual detalhada do layout, cores, posicionamento e hierarquia."
          : ""
      }`
    : ""
}`;

    // Preparar mensagens para a API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: "user", content: prompt }];

    // Se há imagens, usar GPT-4 Vision
    if (allImages && allImages.length > 0) {
      const imageMessages = allImages.map((image) => ({
        type: "image_url" as const,
        image_url: {
          url: image.base64,
          detail: "high",
        },
      }));

      messages[0].content = [{ type: "text", text: prompt }, ...imageMessages];
    }

    const completion = await openai.chat.completions.create({
      model:
        allImages && allImages.length > 0 ? "gpt-4.1-mini" : "gpt-4.1-mini",
      messages,
      max_tokens: 1500,
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("Resposta vazia da OpenAI");
    }

    console.log("Resposta bruta da OpenAI:", response);

    // Limpar a resposta
    const cleanedResponse = cleanJsonResponse(response);
    console.log("Resposta limpa:", cleanedResponse);

    //Parse da resposta JSON
    const analysis = JSON.parse(cleanedResponse) as CopyAnalysis;

    //Validar se tem todos os campos necessários
    if (
      typeof analysis.score !== "number" ||
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.suggestions)
    ) {
      throw new Error("Resposta incompleta da IA");
    }

    // Adicionar informação sobre screenshot capturado
    analysis.websiteImageCount = websiteData.screenshot ? 1 : 0;

    // Incluir o screenshot para exibição na interface
    if (websiteData.screenshot) {
      analysis.websiteScreenshot = websiteData.screenshot;

      // Se não há observações visuais mas há screenshot, gerar observações padrão
      if (
        !analysis.visualObservations ||
        analysis.visualObservations.length === 0
      ) {
        analysis.visualObservations = [
          {
            section: "Layout Geral",
            observation: "Análise visual não foi fornecida pelo modelo",
            type: "neutral",
          },
        ];
      }
    }

    return analysis;
  } catch (error) {
    console.error("Erro ao analisar copy:", error);

    //Retorno de fallback em caso de erro
    return {
      score: 0,
      strengths: ["Não foi possível analisar"],
      weaknesses: ["Erro na análise"],
      suggestions: ["Tente novamente em alguns minutos"],
      mentalTriggers: [],
      emotionalTone: "Indeterminado",
      targetAudience: "Indeterminado",
    };
  }
}
