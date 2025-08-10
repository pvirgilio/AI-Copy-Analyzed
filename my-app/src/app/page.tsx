import { CopyAnalyzer } from "@/components/features/copy-analyzer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Sua Copy Vende
            <br />
            ou Apenas Existe?
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Descubra o que separa textos mediocres de copies que convertem
            milhões. Nossa IA analisa cada palavra e sugere melhorias precisas.
          </p>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">847%</div>
              <div className="text-blue-200">Aumento Médio</div>
            </div>
            <div>
              <div className="text-3xl font-bold">12s</div>
              <div className="text-blue-200">Análise Rápida</div>
            </div>
            <div>
              <div className="text-3xl font-bold">50k+</div>
              <div className="text-blue-200">Copies Analisadas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Componente Principal */}
      <div className="py-16">
        <CopyAnalyzer />
      </div>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Como Transformamos Palavras em Vendas
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                🧠
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Análise Psicológica
              </h3>
              <p className="text-gray-600">
                Identificamos gatilhos mentais e padrões emocionais que fazem
                seu público tomar ação.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                ⚡
              </div>
              <h3 className="text-xl font-semibold mb-3">Score Preciso</h3>
              <p className="text-gray-600">
                Receba uma nota de 0-100 sobre o potencial de conversão da sua
                copy.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                💡
              </div>
              <h3 className="text-xl font-semibold mb-3">Sugestões Práticas</h3>
              <p className="text-gray-600">
                Receba melhorias específicas para aumentar suas vendas em até
                300%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
