# Documentação: Web Scraping Completo

## 🚀 Novas Funcionalidades Implementadas

### 1. **Extração Completa de Websites**

Agora o sistema analisa sites por COMPLETO, extraindo tanto texto quanto imagens:

#### **Texto Extraído:**

- ✅ Título da página
- ✅ Meta descrição
- ✅ Todos os headings (H1, H2, H3)
- ✅ Textos de botões e CTAs
- ✅ Conteúdo principal (main, article, body)
- ✅ Labels de formulários e placeholders
- ✅ Análise de elementos visuais (cores, design)

#### **Imagens Extraídas:**

- ✅ Imagens relevantes (> 100px de largura/altura)
- ✅ Filtro automático (remove ícones, logos pequenos, pixels)
- ✅ Conversão automática para base64
- ✅ Máximo de 5 imagens por site (otimização)
- ✅ Alt text descritivo obrigatório

### 2. **Análise Visual Inteligente**

A IA agora analisa as imagens extraídas considerando:

- 🎨 **Coerência Visual**: Como as imagens complementam o texto
- 🎯 **Público-Alvo**: Se as imagens estão alinhadas com o público
- 💼 **Profissionalismo**: Qualidade visual das imagens
- 🔥 **Gatilhos Mentais**: Se as imagens reforçam os gatilhos
- 🛡️ **Credibilidade**: Elementos visuais que geram confiança
- 📈 **Conversão**: Elementos que podem melhorar resultados

### 3. **Banco de Dados Atualizado**

Novos campos no modelo `Analysis`:

```prisma
model Analysis {
  // ... campos existentes
  imageCount Int @default(0)        // Total de imagens analisadas
  websiteImageCount Int @default(0) // Imagens extraídas de sites
}
```

### 4. **API Response Melhorada**

A resposta da API agora inclui estatísticas das imagens:

```json
{
  "success": true,
  "analysis": {
    /* análise completa */
  },
  "id": "análise_id",
  "imageStats": {
    "totalImages": 8,
    "userImages": 3,
    "websiteImages": 5
  }
}
```

## 🔧 Como Funciona

### **Fluxo de Extração:**

1. **URL Recebida** → Sistema faz fetch da página
2. **HTML Parsing** → Cheerio processa o conteúdo
3. **Limpeza** → Remove scripts, styles, nav, footer
4. **Extração de Texto** → Coleta todos os elementos textuais
5. **Extração de Imagens** → Filtra e baixa imagens relevantes
6. **Conversão** → Converte imagens para base64
7. **IA Analysis** → GPT-4 Vision analisa texto + imagens
8. **Salvamento** → Dados salvos no banco com estatísticas

### **Filtros de Imagem:**

```typescript
// Critérios para imagens válidas:
- src não contém 'icon', 'logo', 'pixel'
- largura > 100px (se especificada)
- altura > 100px (se especificada)
- alt text com mais de 5 caracteres
- máximo 5 imagens por site
```

### **Otimizações Implementadas:**

- 🚀 Limite de imagens por site (evita sobrecarga)
- 🎯 Filtros inteligentes (só imagens relevantes)
- 💾 Compressão automática base64
- 🛡️ Error handling robusto
- 📊 Logging detalhado

## 🎯 Benefícios

### **Para Análise de Copy:**

- Análise mais precisa com contexto visual
- Identificação de inconsistências texto/imagem
- Sugestões visuais para melhorar conversão
- Análise de profissionalismo geral

### **Para Análise de Sites:**

- Visão completa da página (não só texto)
- Análise de UX visual
- Identificação de elementos ausentes
- Benchmarking visual com concorrentes

## 🔍 Exemplo de Uso

```typescript
// Frontend envia URL
const response = await fetch("/api/analyze", {
  method: "POST",
  body: JSON.stringify({
    copyText: "texto opcional",
    websites: [{ url: "https://exemplo.com" }],
  }),
});

// Sistema extrai automaticamente:
// - Todo o texto do site
// - Todas as imagens relevantes
// - Analisa tudo junto com IA
```

## 📈 Próximos Passos Sugeridos

1. **Cache de Imagens** → Evitar re-download de imagens já processadas
2. **Análise de Performance** → Métricas de velocidade do site
3. **OCR em Imagens** → Extrair texto de imagens
4. **Análise de Cores** → Psicologia das cores na conversão
5. **Comparação de Concorrentes** → Análise comparativa automática

---

**✨ Agora seu sistema analisa websites de forma COMPLETA, considerando todos os elementos visuais e textuais para uma análise muito mais precisa e valiosa!**
