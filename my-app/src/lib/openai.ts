import OpenAI from "openai";
import * as cheerio from "cheerio";

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

// Função para extrair conteúdo de websites
async function extractWebsiteContent(websites: WebsiteData[]): Promise<string> {
  let websiteContent = "";

  for (const website of websites) {
    try {
      const response = await fetch(website.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Extrair conteúdo relevante
        $("script").remove();
        $("style").remove();
        $("nav").remove();
        $("footer").remove();
        $("header").remove();

        const title = $("title").text().trim() || website.title || "Sem título";
        const mainContent = $("main").text() || $("body").text() || "";
        const headings = $("h1, h2, h3")
          .map((i, el) => $(el).text())
          .get()
          .join(" ");

        websiteContent += `\n\nSITE: ${title} (${website.url})\n`;
        websiteContent += `TÍTULOS: ${headings}\n`;
        websiteContent += `CONTEÚDO: ${mainContent.substring(0, 2000)}...\n`;
      }
    } catch (error) {
      console.error(`Erro ao extrair conteúdo de ${website.url}:`, error);
      websiteContent += `\n\nSITE: ${website.url} - Erro ao acessar conteúdo\n`;
    }
  }

  return websiteContent;
}

export async function analyzeCopyWithAI(
  copytext?: string,
  images?: ImageData[],
  websites?: WebsiteData[]
): Promise<CopyAnalysis> {
  try {
    // Extrair conteúdo dos websites se fornecidos
    let websiteContent = "";
    if (websites && websites.length > 0) {
      websiteContent = await extractWebsiteContent(websites);
    }

    // Construir prompt baseado no que foi fornecido
    let prompt = `Analise o conteúdo de marketing digital como um especialista.

`;

    if (copytext) {
      prompt += `COPY PARA ANÁLISE:
"${copytext}"

`;
    }

    if (websiteContent) {
      prompt += `CONTEÚDO DOS WEBSITES:
${websiteContent}

`;
    }

    if (images && images.length > 0) {
      prompt += `IMAGENS ENVIADAS: ${images.length} imagem(ns) para análise

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
  "targetAudience": "descrição do público-alvo ideal"
}

CRITÉRIOS DE AVALIAÇÃO:
- Clareza da proposta de valor (25 pontos)
- Urgência e escassez (20 pontos)  
- Prova social e credibilidade (20 pontos)
- Call-to-action efetivo (15 pontos)
- Conexão emocional (10 pontos)
- Estrutura e fluência (10 pontos)

${
  websites && websites.length > 0
    ? `ANÁLISE ESPECÍFICA PARA SITES: Compare o conteúdo fornecido com boas práticas de copy para websites, identifique elementos ausentes que poderiam melhorar a conversão.`
    : ""
}`;

    // Preparar mensagens para a API
    const messages: any[] = [{ role: "user", content: prompt }];

    // Se há imagens, usar GPT-4 Vision
    if (images && images.length > 0) {
      const imageMessages = images.map((image) => ({
        type: "image_url",
        image_url: {
          url: image.base64,
          detail: "high",
        },
      }));

      messages[0].content = [{ type: "text", text: prompt }, ...imageMessages];
    }

    const completion = await openai.chat.completions.create({
      model: images && images.length > 0 ? "gpt-4.1-mini" : "gpt-4.1-mini",
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
