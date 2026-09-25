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
    sm: 'w-7 h-7 sm:w-8 sm:h-8',
    md: 'w-10 h-10 sm:w-11 sm:h-11',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
    xl: 'w-16 h-16 sm:w-18 sm:h-18',
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
