import React, { useEffect, useRef, useState } from 'react';
import { WaterfallConfig, renderWaterfallToCanvas } from '../utils/waterfallGenerator';
import { formatCurrencyShort } from '../utils/formatters';

interface WaterfallCanvasProps {
  config: WaterfallConfig;
  className?: string;
}

export const WaterfallCanvas: React.FC<WaterfallCanvasProps> = ({ config, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      // Garante no mínimo 2x de super-sampling (alta resolução HD/Retina) para eliminar qualquer embaçamento
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      
      const displayWidth = Math.round(rect.width);
      const displayHeight = Math.round(rect.height > 0 ? rect.height : 360);

      // Define tamanho real de buffer ultra-nítido
      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      renderWaterfallToCanvas(canvas, config, {
        scale: dpr,
        activeBarIndex: hoveredBarIndex,
      });
    };

    // Renderização imediata e frame seguinte para garantir dimensões finais do layout
    render();
    const rafId = requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          render();
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [config, hoveredBarIndex]);

  // Interação de Mouse sobre as barras para tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const marginLeft = 40;
    const marginRight = 45;
    const chartW = rect.width - marginLeft - marginRight;
    const totalBars = config.bars.length;
    if (totalBars === 0 || chartW <= 0) return;

    const slotWidth = chartW / totalBars;
    const barIndex = Math.floor((x - marginLeft) / slotWidth);

    if (barIndex >= 0 && barIndex < totalBars) {
      setHoveredBarIndex(barIndex);
    } else {
      setHoveredBarIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredBarIndex(null);
  };

  const hoveredBar = hoveredBarIndex !== null ? config.bars[hoveredBarIndex] : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[340px] flex flex-col ${className}`}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="block rounded-2xl cursor-crosshair shadow-2xs"
      />

      {/* Tooltip Dinâmico */}
      {hoveredBar && (
        <div className="absolute top-3 right-3 bg-[#14412A] text-white text-xs px-3.5 py-2 rounded-xl shadow-lg border border-[#39FF00]/40 pointer-events-none z-10 backdrop-blur-xs">
          <div className="font-bold text-[#39FF00]">{hoveredBar.label}</div>
          <div className="flex items-center gap-2 text-white/90 mt-0.5">
            <span>Impacto: <strong>{formatCurrencyShort(hoveredBar.changeValue)}</strong></span>
            <span>| Pos: <strong>{formatCurrencyShort(hoveredBar.endValue)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};
