import React from 'react';
import { CompanyId } from '../types';

interface CompanyLogoProps {
  companyId: CompanyId;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  companyId,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-13 h-13 sm:w-14 sm:h-14',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const logoPaths: Record<CompanyId, string> = {
    nio: '/Logos/nio.png',
    vtal: '/Logos/vtal.png',
    tecto: '/Logos/tecto.png',
  };

  const companyNames: Record<CompanyId, string> = {
    nio: 'NIO Fibra',
    vtal: 'V.tal',
    tecto: 'Tecto Data Centers',
  };

  return (
    <img
      src={logoPaths[companyId]}
      alt={`Logo ${companyNames[companyId]}`}
      title={companyNames[companyId]}
      className={`inline-block select-none shrink-0 object-contain ${sizeClasses[size]} ${className} drop-shadow-md transition-transform hover:scale-105`}
      draggable={false}
    />
  );
};
