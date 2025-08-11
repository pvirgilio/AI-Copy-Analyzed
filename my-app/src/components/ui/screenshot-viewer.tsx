"use client";

import { VisualObservation } from "@/lib/openai";
import { useState } from "react";
import Image from "next/image";

interface ScreenshotViewerProps {
  screenshot: string;
  visualObservations?: VisualObservation[];
}

export function ScreenshotViewer({
  screenshot,
  visualObservations = [],
}: ScreenshotViewerProps) {
  const [selectedObservation, setSelectedObservation] = useState<number | null>(
    null
  );

  const getObservationIcon = (type: VisualObservation["type"]) => {
    switch (type) {
      case "positive":
        return "✅";
      case "negative":
        return "❌";
      case "neutral":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        🖼️ Screenshot da Página
        {visualObservations.length > 0 && (
          <span className="text-sm font-normal text-gray-600">
            ({visualObservations.length} observações)
          </span>
        )}
      </h3>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Screenshot */}
        <div className="relative">
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <Image
              src={screenshot}
              alt="Screenshot da página"
              width={800}
              height={600}
              className="w-full h-auto"
              style={{ maxHeight: "600px", objectFit: "contain" }}
            />
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Screenshot completo da página analisada
          </p>
        </div>

        {/* Observações Visuais */}
        {visualObservations.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 mb-3">
              Observações Visuais Detalhadas
            </h4>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {visualObservations.map((obs, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 cursor-pointer transition-all duration-200 ${
                    selectedObservation === index
                      ? "bg-gray-50 shadow-md"
                      : "bg-white hover:bg-gray-50"
                  } ${
                    obs.type === "positive"
                      ? "border-l-green-500 bg-green-50"
                      : obs.type === "negative"
                      ? "border-l-red-500 bg-red-50"
                      : "border-l-blue-500 bg-blue-50"
                  }`}
                  onClick={() =>
                    setSelectedObservation(
                      selectedObservation === index ? null : index
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">
                      {getObservationIcon(obs.type)}
                    </span>

                    <div className="flex-1">
                      <h5 className="font-medium text-gray-800 mb-1">
                        {obs.section}
                      </h5>

                      <p className="text-sm text-gray-600 leading-relaxed">
                        {obs.observation}
                      </p>

                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            obs.type === "positive"
                              ? "bg-green-100 text-green-800"
                              : obs.type === "negative"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {obs.type === "positive"
                            ? "Ponto Forte"
                            : obs.type === "negative"
                            ? "Ponto de Melhoria"
                            : "Observação"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                💡 <strong>Dica:</strong> Clique em cada observação para
                destacá-la. As observações são baseadas na análise visual
                completa da página.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
