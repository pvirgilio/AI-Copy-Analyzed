"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface AnalysisSummary {
  id: string;
  copyText: string;
  score: number;
  createdAt: string;
}

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const response = await fetch("/api/analyze?limit=20");
      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (error) {
      console.error("Erro ao carregar análises:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando análises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Histórico das suas análises de copy</p>
        </div>

        {/* Estatísticas */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">
              Total de Análises
            </h3>
            <p className="text-2xl font-bold text-gray-900">
              {analyses.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Score Médio</h3>
            <p className="text-2xl font-bold text-blue-600">
              {analyses.length > 0
                ? Math.round(
                    analyses.reduce((acc, a) => acc + a.score, 0) /
                      analyses.length
                  )
                : 0}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Melhor Score</h3>
            <p className="text-2xl font-bold text-green-600">
              {analyses.length > 0
                ? Math.max(...analyses.map((a) => a.score))
                : 0}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Esta Semana</h3>
            <p className="text-2xl font-bold text-purple-600">
              {
                analyses.filter((a) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(a.createdAt) > weekAgo;
                }).length
              }
            </p>
          </div>
        </div>

        {/* Lista de Análises */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Análises Recentes
            </h2>
          </div>

          {analyses.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Nenhuma análise encontrada</p>
              <Button onClick={() => (window.location.href = "/")}>
                Criar Primeira Análise
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 mb-2">
                        {analysis.copyText.length > 100
                          ? analysis.copyText.substring(0, 100) + "..."
                          : analysis.copyText}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(analysis.createdAt).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>

                    <div className="ml-4 text-right">
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          analysis.score >= 80
                            ? "bg-green-100 text-green-800"
                            : analysis.score >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {analysis.score}/100
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
