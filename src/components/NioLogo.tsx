import React from 'react';

interface NioLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const NioLogo: React.FC<NioLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-13 h-13 sm:w-14 sm:h-14',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  return (
    <div
      className={`inline-flex items-center justify-center select-none shrink-0 ${sizeClasses[size]} ${className}`}
      title="NIO"
    >
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full object-contain drop-shadow-md transition-transform hover:scale-105"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente luminoso da haste em cápsula do 'i' característico da NIO */}
          <linearGradient id="nio-studio-i-stem" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F351D" />
            <stop offset="25%" stopColor="#124322" />
            <stop offset="65%" stopColor="#2F8E3F" />
            <stop offset="85%" stopColor="#1E652F" />
            <stop offset="100%" stopColor="#0F351D" />
          </linearGradient>
        </defs>

        {/* Fundo do Ícone: Squircle Verde Neon Oficial (#22E600) */}
        <rect
          width="512"
          height="512"
          rx="115"
          ry="115"
          fill="#22E600"
        />

        {/* Letra 'n' em Verde Escuro (#0F351D) */}
        <g fill="#0F351D">
          {/* Perna esquerda */}
          <rect x="98" y="222" width="28" height="90" />
          {/* Arco suave com proporções harmoniosas */}
          <path
            d="M 126 222 
               C 126 222, 142 200, 175 200 
               C 208 200, 222 222, 222 248 
               L 222 312 
               L 194 312 
               L 194 250 
               C 194 232, 187 222, 172 222 
               C 156 222, 148 232, 148 250 
               L 148 312 
               L 126 312 
               Z"
          />
        </g>

        {/* Letra 'i': Haste em cápsula com gradiente luminoso */}
        <rect
          x="237"
          y="230"
          width="38"
          height="82"
          rx="19"
          ry="19"
          fill="url(#nio-studio-i-stem)"
        />

        {/* Letra 'i': Ponto circular superior no mesmo nível de topo do 'n' e 'o' */}
        <circle cx="256" cy="219" r="19" fill="#0F351D" />

        {/* Letra 'o': Círculo geométrico perfeito em Verde Escuro (#0F351D) */}
        <path
          fill="#0F351D"
          fillRule="evenodd"
          d="M 358 200 
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
             Z"
        />
      </svg>
    </div>
  );
};
