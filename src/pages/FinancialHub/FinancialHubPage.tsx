import React from 'react';
import { CompanyId } from '../../types';
import { PortalAiChat } from '../../components/PortalAiChat';

interface FinancialHubPageProps {
  onSelectCompany: (companyId: CompanyId) => void;
}

export const FinancialHubPage: React.FC<FinancialHubPageProps> = ({
  onSelectCompany,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#18181B] leading-tight">
          Hub Finanças
        </h1>
        <p className="text-xs sm:text-sm text-[#52525B] mt-1 font-medium">
          Plataforma Financeira · Consulte dados financeiros, analise arquivos e gere relatórios executivos.
        </p>
      </div>

      <div className="flex-1 min-h-[560px] lg:min-h-0 w-full">
        <PortalAiChat onSelectCompany={onSelectCompany} />
      </div>
    </div>
  );
};

export default FinancialHubPage;
