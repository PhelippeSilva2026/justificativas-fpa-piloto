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
      <img
        src="/Logos/Nio_IASTUDIO-1.png"
        alt="NIO Fibra"
        className="w-full h-full object-contain drop-shadow-md transition-transform hover:scale-105"
        draggable={false}
      />
    </div>
  );
};

