import { NextRequest, NextResponse } from "next/server";
import { analyzeCopyWithAI } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

// Rate limiting simples (em produção, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 5; // 5 requests por minuto

  const current = requestCounts.get(ip);

  if (!current || now > current.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em 1 minuto." },
        { status: 429 }
      );
    }

    // Parse do body com tratamento de erro
    let body;
    try {
      body = await request.json();
      console.log("Body recebido:", body);
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON:", parseError);
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { copyText, images, websites } = body;
    console.log("copyText extraído:", copyText);
    console.log("Tipo do copyText:", typeof copyText);
    console.log("Comprimento do copyText:", copyText?.length);
    console.log("Imagens recebidas:", images?.length || 0);
    console.log("Websites recebidos:", websites?.length || 0);

    // Validações
    if (
      !copyText &&
      (!images || images.length === 0) &&
      (!websites || websites.length === 0)
    ) {
      return NextResponse.json(
        { error: "É necessário fornecer texto, imagens ou URLs para análise" },
        { status: 400 }
      );
    }

    if (copyText && typeof copyText !== "string") {
      return NextResponse.json(
        { error: "Campo 'copyText' deve ser uma string" },
        { status: 400 }
      );
    }

    if (copyText && copyText.trim().length > 0 && copyText.trim().length < 50) {
      return NextResponse.json(
        {
          error: `Copy deve ter pelo menos 50 caracteres. Atual: ${
            copyText.trim().length
          }`,
        },
        { status: 400 }
      );
    }

    if (copyText && copyText.length > 10000) {
      return NextResponse.json(
        {
          error: `Copy não pode ter mais de 10.000 caracteres. Atual: ${copyText.length}`,
        },
        { status: 400 }
      );
    }

    // Analisar com IA
    console.log("Iniciando análise da copy...");
    const analysis = await analyzeCopyWithAI(copyText, images, websites);

    // Calcular contadores de imagens
    const userImageCount = images?.length || 0;
    const totalImages = userImageCount + (analysis.websiteImageCount || 0);

    // Salvar no banco
    const savedAnalysis = await prisma.analysis.create({
      data: {
        copyText,
        score: analysis.score,
        analysis: JSON.parse(JSON.stringify(analysis)),
        imageCount: totalImages,
        websiteImageCount: analysis.websiteImageCount || 0,
        // userId: null // Por enquanto sem usuário
      },
    });

    console.log("Análise salva com ID:", savedAnalysis.id);
    console.log(
      `Total de imagens analisadas: ${totalImages} (${userImageCount} enviadas + ${
        analysis.websiteImageCount || 0
      } extraídas de websites)`
    );

    // Resposta
    return NextResponse.json({
      success: true,
      analysis,
      id: savedAnalysis.id,
      imageStats: {
        totalImages,
        userImages: userImageCount,
        websiteImages: analysis.websiteImageCount || 0,
      },
    });
  } catch (error) {
    console.error("Erro na API de análise:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// Endpoint para buscar análises (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const analyses = await prisma.analysis.findMany({
      take: Math.min(limit, 50), // Máximo 50
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        copyText: true,
        score: true,
        createdAt: true,
        // Não retornar análise completa para economizar dados
      },
    });

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("Erro ao buscar análises:", error);
    return NextResponse.json(
      { error: "Erro ao buscar análises" },
      { status: 500 }
    );
  }
}
