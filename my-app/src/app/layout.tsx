import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Copy Analyzer IA - Transforme Palavras em Vendas",
  description:
    "Analise suas copies com IA e descubra como aumentar conversões em até 847%",
  keywords: "copy, copywriting, análise, IA, conversão, vendas, marketing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Copy Analyzer IA
              </h1>
              <nav className="space-x-6">
                <a href="/" className="text-gray-600 hover:text-gray-900">
                  Início
                </a>
                <a
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </a>
              </nav>
            </div>
          </div>
        </header>

        {children}

        <footer className="bg-gray-900 text-white py-12">
          <div className="container mx-auto px-4 text-center">
            <p>&copy; 2025 Copy Analyzer IA. Todos os direitos reservados.</p>
            <p className="text-gray-400 mt-2">
              Desenvolvido com Next.js 14 e OpenAI GPT-4
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
