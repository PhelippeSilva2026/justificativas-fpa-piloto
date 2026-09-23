/**
 * Logomarca Oficial NIO
 * Baseada com máxima fidelidade na imagem "Nio_IASTUDIO.png":
 * - Ícone em Squircle com fundo Verde Neon Oficial (#22E600)
 * - Tipografia minúscula "nio" em verde escuro corporativo (#0F351D)
 * - Letra 'i' com haste em cápsula luminosa (gradiente verde luminoso) e ponto circular superior perfeitamente alinhado
 * - Letra 'o' em círculo geométrico perfeito
 */

export const NIO_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="nio-export-i-stem" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F351D" />
      <stop offset="25%" stop-color="#124322" />
      <stop offset="65%" stop-color="#2F8E3F" />
      <stop offset="85%" stop-color="#1E652F" />
      <stop offset="100%" stop-color="#0F351D" />
    </linearGradient>
  </defs>

  <!-- Fundo Squircle Verde Neon Oficial (#22E600) -->
  <rect width="512" height="512" rx="115" ry="115" fill="#22E600" />

  <!-- Letra 'n' -->
  <g fill="#0F351D">
    <rect x="98" y="222" width="28" height="90" />
    <path d="M 126 222 
             C 126 222, 142 200, 175 200 
             C 208 200, 222 222, 222 248 
             L 222 312 
             L 194 312 
             L 194 250 
             C 194 232, 187 222, 172 222 
             C 156 222, 148 232, 148 250 
             L 148 312 
             L 126 312 
             Z" />
  </g>

  <!-- Letra 'i': Haste em cápsula luminosa -->
  <rect x="237" y="230" width="38" height="82" rx="19" ry="19" fill="url(#nio-export-i-stem)" />

  <!-- Letra 'i': Ponto circular superior -->
  <circle cx="256" cy="219" r="19" fill="#0F351D" />

  <!-- Letra 'o': Círculo geométrico perfeito -->
  <path fill="#0F351D" fill-rule="evenodd" d="M 358 200 
           C 388.93 200, 414 225.07, 414 256 
           C 414 286.93, 388.93 312, 358 312 
           C 327.07 312, 302 286.93, 302 256 
           C 302 225.07, 327.07 200, 358 200 
           Z 
           M 358 225 
           C 340.88 225, 327 238.88, 327 256 
           C 327 273.12, 340.88 287, 358 287 
           C 375.12 287, 389 273.12, 389 256 
           C 389 238.88, 375.12 225, 358 225 
           Z" />
</svg>
`;

/**
 * Renderiza o logo oficial NIO em alta resolução (PNG Data URL) para PowerPoint e slides
 */
export async function getNioLogoPngDataUrl(width: number = 512, height: number = 512): Promise<string> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const scaleX = width / 512;
      const scaleY = height / 512;
      ctx.scale(scaleX, scaleY);

      // Fundo Squircle Verde Neon Oficial (#22E600)
      ctx.fillStyle = '#22E600';
      ctx.beginPath();
      const r = 115;
      ctx.moveTo(r, 0);
      ctx.lineTo(512 - r, 0);
      ctx.quadraticCurveTo(512, 0, 512, r);
      ctx.lineTo(512, 512 - r);
      ctx.quadraticCurveTo(512, 512, 512 - r, 512);
      ctx.lineTo(r, 512);
      ctx.quadraticCurveTo(0, 512, 0, 512 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // 1. Letra 'n' em Verde Escuro (#0F351D)
      ctx.fillStyle = '#0F351D';
      ctx.fillRect(98, 222, 28, 90);

      ctx.beginPath();
      ctx.moveTo(126, 222);
      ctx.bezierCurveTo(126, 222, 142, 200, 175, 200);
      ctx.bezierCurveTo(208, 200, 222, 222, 222, 248);
      ctx.lineTo(222, 312);
      ctx.lineTo(194, 312);
      ctx.lineTo(194, 250);
      ctx.bezierCurveTo(194, 232, 187, 222, 172, 222);
      ctx.bezierCurveTo(156, 222, 148, 232, 148, 250);
      ctx.lineTo(148, 312);
      ctx.lineTo(126, 312);
      ctx.closePath();
      ctx.fill();

      // 2. Letra 'i'
      // Haste cápsula com gradiente luminoso
      const grad = ctx.createLinearGradient(0, 230, 0, 312);
      grad.addColorStop(0, '#0F351D');
      grad.addColorStop(0.25, '#124322');
      grad.addColorStop(0.65, '#2F8E3F');
      grad.addColorStop(0.85, '#1E652F');
      grad.addColorStop(1, '#0F351D');

      ctx.beginPath();
      const rx = 19;
      const x = 237;
      const y = 230;
      const w = 38;
      const h = 82;
      ctx.moveTo(x + rx, y);
      ctx.lineTo(x + w - rx, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rx);
      ctx.lineTo(x + w, y + h - rx);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
      ctx.lineTo(x + rx, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rx);
      ctx.lineTo(x, y + rx);
      ctx.quadraticCurveTo(x, y, x + rx, y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Ponto circular superior em Verde Escuro
      ctx.beginPath();
      ctx.arc(256, 219, 19, 0, Math.PI * 2);
      ctx.fillStyle = '#0F351D';
      ctx.fill();

      // 3. Letra 'o' em Verde Escuro (#0F351D)
      ctx.fillStyle = '#0F351D';
      ctx.beginPath();
      ctx.arc(358, 256, 56, 0, Math.PI * 2, false);
      ctx.arc(358, 256, 31, 0, Math.PI * 2, true);
      ctx.fill();

      resolve(canvas.toDataURL('image/png'));
    } catch {
      resolve('');
    }
  });
}
