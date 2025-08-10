import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL é obrigatória" },
        { status: 400 }
      );
    }

    // Fazer fetch da página
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao acessar URL: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extrair título da página
    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Título não encontrado';

    return NextResponse.json({
      success: true,
      title: title.substring(0, 100), // Limitar tamanho do título
      accessible: true
    });

  } catch (error) {
    console.error("Erro ao validar URL:", error);
    
    return NextResponse.json(
      { error: "Não foi possível acessar a URL" },
      { status: 400 }
    );
  }
}
