"use client";

import { CopyAnalysis } from "@/lib/openai";
import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { ScreenshotViewer } from "../ui/screenshot-viewer";

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  base64: string;
}

interface WebsiteUrl {
  id: string;
  url: string;
  title?: string;
  status: "loading" | "success" | "error";
}

interface WebsiteUrl {
  id: string;
  url: string;
  title?: string;
  status: "loading" | "success" | "error";
}

export function CopyAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CopyAnalysis | null>(null);
  const [error, setError] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [websites, setWebsites] = useState<WebsiteUrl[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para converter arquivo para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Função para gerar ID único
  const generateId = () =>
    `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Função para validar URL
  const isValidUrl = (string: string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Função para adicionar URL
  const addWebsite = async () => {
    if (!urlInput.trim()) return;

    let url = urlInput.trim();

    // Adicionar https:// se não tiver protocolo
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    if (!isValidUrl(url)) {
      setError("URL inválida. Por favor, insira uma URL válida.");
      return;
    }

    // Verificar se já existe
    if (websites.some((w) => w.url === url)) {
      setError("Esta URL já foi adicionada.");
      return;
    }

    const websiteId = generateId();
    const newWebsite: WebsiteUrl = {
      id: websiteId,
      url,
      status: "loading",
    };

    setWebsites((prev) => [...prev, newWebsite]);
    setUrlInput("");
    setError("");

    // Validar URL fazendo uma requisição
    try {
      const response = await fetch("/api/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      setWebsites((prev) =>
        prev.map((w) =>
          w.id === websiteId
            ? {
                ...w,
                status: response.ok ? "success" : "error",
                title: data.title || url,
              }
            : w
        )
      );
    } catch {
      setWebsites((prev) =>
        prev.map((w) => (w.id === websiteId ? { ...w, status: "error" } : w))
      );
    }
  };

  // Função para remover website
  const removeWebsite = (websiteId: string) => {
    setWebsites((prev) => prev.filter((w) => w.id !== websiteId));
  };

  // Função para processar imagens
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: UploadedImage[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        setError("Apenas arquivos de imagem são permitidos");
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Imagem muito grande. Máximo 5MB por imagem");
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const url = URL.createObjectURL(file);
        const id = generateId();

        newImages.push({
          id,
          file,
          url,
          base64,
        });
      } catch {
        setError("Erro ao processar imagem");
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    return newImages;
  };

  // Função para inserir imagem no editor
  const insertImageIntoEditor = (imageId: string, imageUrl: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);

    if (range) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "inline-block relative m-2 max-w-xs";
      imgContainer.setAttribute("data-image-id", imageId);

      const img = document.createElement("img");
      img.src = imageUrl;
      img.className = "rounded-lg shadow-md max-h-40 w-auto";
      img.setAttribute("data-image-id", imageId);

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "✕";
      removeBtn.className =
        "absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600 flex items-center justify-center";
      removeBtn.onclick = (e) => {
        e.preventDefault();
        removeImage(imageId);
      };

      imgContainer.appendChild(img);
      imgContainer.appendChild(removeBtn);

      range.deleteContents();
      range.insertNode(imgContainer);

      range.setStartAfter(imgContainer);
      range.setEndAfter(imgContainer);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  // Função para remover imagem
  const removeImage = (imageId: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter((img) => img.id !== imageId);
    });

    const editor = editorRef.current;
    if (editor) {
      const imgElement = editor.querySelector(`[data-image-id="${imageId}"]`);
      if (imgElement) {
        imgElement.remove();
      }
    }
  };

  // Handle paste (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file) => file !== null) as File[];

    if (imageFiles.length > 0) {
      e.preventDefault();
      const newImages = await processFiles(imageFiles);

      newImages.forEach((image) => {
        insertImageIntoEditor(image.id, image.url);
      });
    }
  };

  // Handle drag and drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length > 0) {
      const newImages = await processFiles(imageFiles);

      newImages.forEach((image) => {
        insertImageIntoEditor(image.id, image.url);
      });
    }
  };

  // Handle file input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages = await processFiles(files);

      newImages.forEach((image) => {
        insertImageIntoEditor(image.id, image.url);
      });
    }
  };

  // Extrair texto do editor
  const extractTextFromEditor = () => {
    const editor = editorRef.current;
    if (!editor) return "";

    const clone = editor.cloneNode(true) as HTMLElement;
    const images = clone.querySelectorAll("[data-image-id]");
    images.forEach((img) => img.remove());

    return clone.textContent || "";
  };

  // Função para analisar copy
  const handleAnalyze = async () => {
    const textContent = extractTextFromEditor();

    // Validações
    if (!textContent.trim() && images.length === 0 && websites.length === 0) {
      setError(
        "Por favor, insira uma copy, adicione imagens ou URLs para análise."
      );
      return;
    }

    if (textContent.length > 0 && textContent.length < 50) {
      setError("A copy deve ter pelo menos 50 caracteres.");
      return;
    }

    // Verificar se há websites com erro
    const errorWebsites = websites.filter((w) => w.status === "error");
    if (errorWebsites.length > 0) {
      setError(
        "Algumas URLs estão com erro. Remova-as ou corrija antes de continuar."
      );
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);
    setLoadingStage("Preparando análise...");
    setLoadingProgress(10);

    try {
      // Simular progresso durante a análise
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev < 90) return prev + 2;
          return prev;
        });
      }, 500);

      setLoadingStage("Aguardando carregamento completo da página...");
      setLoadingProgress(30);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          copyText: textContent,
          images: images.map((img) => ({
            name: img.file.name,
            base64: img.base64,
          })),
          websites: websites
            .filter((w) => w.status === "success")
            .map((w) => ({ url: w.url, title: w.title })),
        }),
      });

      setLoadingStage("Analisando conteúdo com IA...");
      setLoadingProgress(70);

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Erro ${response.status}: ${response.statusText}`
        );
      }

      setLoadingStage("Finalizando análise...");
      setLoadingProgress(95);

      const data = await response.json();

      setLoadingProgress(100);
      setAnalysis(data.analysis);
    } catch (err) {
      console.error("Erro na análise:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro ao analisar a copy. Tente novamente."
      );
    } finally {
      setLoading(false);
      setLoadingStage("");
      setLoadingProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Formulário de Input */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Analisar Copy</h2>

        <div className="space-y-6">
          {/* Editor de texto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cole sua copy aqui (texto + imagens):
            </label>

            <div
              ref={editorRef}
              contentEditable
              className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              style={{ whiteSpace: "pre-wrap" }}
              aria-placeholder="Cole seu texto aqui e use Ctrl+V para colar imagens ou arraste e solte imagens diretamente no texto..."
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onInput={() => {
                extractTextFromEditor();
              }}
              suppressContentEditableWarning={true}
            />

            <div className="mt-2 flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Adicionar Imagem
              </Button>

              <span className="text-xs text-gray-500">
                Ou use Ctrl+V para colar imagens, ou arraste e solte
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Seção de URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URLs para análise (opcional):
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://exemplo.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWebsite();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addWebsite}
                disabled={!urlInput.trim()}
                className="px-4"
              >
                Adicionar
              </Button>
            </div>

            {/* Lista de websites */}
            {websites.length > 0 && (
              <div className="mt-3 space-y-2">
                {websites.map((website) => (
                  <div
                    key={website.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {website.status === "loading" && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {website.status === "success" && (
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-2 h-2 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      {website.status === "error" && (
                        <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-2 h-2 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {website.title || website.url}
                        </p>
                        {website.title && (
                          <p className="text-xs text-gray-500">{website.url}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeWebsite(website.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-500 space-x-4">
            <span>{extractTextFromEditor().length} caracteres</span>
            {images.length > 0 && (
              <span>
                {images.length} imagem{images.length !== 1 ? "s" : ""}
              </span>
            )}
            {websites.length > 0 && (
              <span>
                {websites.length} site{websites.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <Button
            onClick={handleAnalyze}
            loading={loading}
            disabled={
              !extractTextFromEditor().trim() &&
              images.length === 0 &&
              websites.filter((w) => w.status === "success").length === 0
            }
            size="lg"
          >
            {loading ? "Analisando..." : "Analisar Copy"}
          </Button>
        </div>
      </div>

      {/* Loading Aprimorado */}
      {loading && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Analisando sua página...
              </h3>

              <p className="text-gray-600 mb-6">
                {loadingStage || "Preparando análise..."}
              </p>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-500 mb-6">
              <span>Progresso</span>
              <span>{loadingProgress}%</span>
            </div>

            {/* Dicas durante o carregamento */}
            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                💡 Enquanto você espera...
              </h4>
              <div className="text-sm text-blue-700 space-y-2">
                <p>
                  • Nossa IA aguarda o carregamento COMPLETO da página (imagens,
                  fontes, scripts)
                </p>
                <p>
                  • Detecta automaticamente quando todos os elementos estão
                  prontos
                </p>
                <p>
                  • Analisando tanto o conteúdo textual quanto os elementos
                  visuais
                </p>
                <p>• Identificando gatilhos mentais e pontos de melhoria</p>
                <p>• Gerando observações específicas para cada seção</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {analysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-6">Resultado da Análise</h3>

          {/* Score */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Score Geral</span>
              <span className="text-2xl font-bold text-blue-600">
                {analysis.score}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${analysis.score}%` }}
              />
            </div>
          </div>

          {/* Grid de Resultados */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pontos Fortes */}
            <div>
              <h4 className="font-semibold text-green-700 mb-3 flex items-center">
                ✅ Pontos Fortes
              </h4>
              <ul className="space-y-2">
                {analysis.strengths.map((strength, index) => (
                  <li
                    key={index}
                    className="text-sm bg-green-50 p-2 rounded border-l-4 border-green-500"
                  >
                    {strength}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pontos Fracos */}
            <div>
              <h4 className="font-semibold text-red-700 mb-3 flex items-center">
                ❌ Pontos Fracos
              </h4>
              <ul className="space-y-2">
                {analysis.weaknesses.map((weakness, index) => (
                  <li
                    key={index}
                    className="text-sm bg-red-50 p-2 rounded border-l-4 border-red-500"
                  >
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sugestões */}
            <div>
              <h4 className="font-semibold text-blue-700 mb-3 flex items-center">
                💡 Sugestões de Melhoria
              </h4>
              <ul className="space-y-2">
                {analysis.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="text-sm bg-blue-50 p-2 rounded border-l-4 border-blue-500"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>

            {/* Gatilhos Mentais */}
            <div>
              <h4 className="font-semibold text-purple-700 mb-3 flex items-center">
                🧠 Gatilhos Mentais Identificados
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.mentalTriggers.map((trigger, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Info Adicional */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-gray-700">
                  Tom Emocional:
                </span>
                <p className="text-gray-600">{analysis.emotionalTone}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">
                  Público-alvo Sugerido:
                </span>
                <p className="text-gray-600">{analysis.targetAudience}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot e Observações Visuais */}
      {analysis && analysis.websiteScreenshot && (
        <ScreenshotViewer
          screenshot={analysis.websiteScreenshot}
          visualObservations={analysis.visualObservations}
        />
      )}
    </div>
  );
}
