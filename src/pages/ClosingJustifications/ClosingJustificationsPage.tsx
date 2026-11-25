import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { CompanyId } from '../../types';
import { CompanyPortal } from '../../components/CompanyPortal';

interface ClosingJustificationsPageProps {
  onSelectCompany: (companyId: CompanyId) => void;
  savedCounts: Record<CompanyId, number>;
  onBackToHub: () => void;
}

export const ClosingJustificationsPage: React.FC<ClosingJustificationsPageProps> = ({
  onSelectCompany,
  savedCounts,
  onBackToHub,
}) => {
  return (
    <div className="flex-1 flex flex-col w-full">
      <div className="mb-3">
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#52525B] hover:text-[#18181B] transition-colors cursor-pointer group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar à Plataforma Financeira</span>
        </button>
      </div>

      <CompanyPortal
        onSelectCompany={onSelectCompany}
        savedCounts={savedCounts}
        embeddedInClosingPage
      />
    </div>
  );
};

export default ClosingJustificationsPage;
