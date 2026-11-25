import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { CompanyId } from '../types';
import { FinancialModuleId, PlatformPageId } from '../config/modules';
import { PlatformShell } from './PlatformShell';
import { FinancialHubPage } from '../pages/FinancialHub';

const ClosingJustificationsPage = lazy(() => import('../pages/ClosingJustifications'));
const EnergyPage = lazy(() => import('../pages/Energy'));
const RealEstatePage = lazy(() => import('../pages/RealEstate'));
const LegalPage = lazy(() => import('../pages/Legal'));
const TravelPage = lazy(() => import('../pages/Travel'));
const EngineeringPage = lazy(() => import('../pages/Engineering'));
const OperationsPage = lazy(() => import('../pages/Operations'));
const MarketingPage = lazy(() => import('../pages/Marketing'));
const CentralPlanoFimPage = lazy(() => import('../pages/CentralPlanoFim'));

interface PlatformPageRouterProps {
  activePage: PlatformPageId;
  savedCounts: Record<CompanyId, number>;
  onSelectModule: (moduleId: FinancialModuleId) => void;
  onSelectCompany: (companyId: CompanyId) => void;
  onBackToHub: () => void;
}

const ModuleLoadingFallback: React.FC = () => (
  <div className="flex-1 w-full text-[#242424] flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-7 h-7 animate-spin text-[#242424]" />
    <span className="text-xs font-bold tracking-wide">Carregando módulo...</span>
  </div>
);

export const PlatformPageRouter: React.FC<PlatformPageRouterProps> = ({
  activePage,
  savedCounts,
  onSelectModule,
  onSelectCompany,
  onBackToHub,
}) => {
  return (
    <PlatformShell
      activePage={activePage}
      onSelectModule={onSelectModule}
      onBackToHub={onBackToHub}
    >
      {activePage === 'hub' ? (
        <FinancialHubPage onSelectCompany={onSelectCompany} />
      ) : (
        <Suspense fallback={<ModuleLoadingFallback />}>
          {activePage === 'closing-justifications' && (
            <ClosingJustificationsPage
              onSelectCompany={onSelectCompany}
              savedCounts={savedCounts}
              onBackToHub={onBackToHub}
            />
          )}
          {activePage === 'energy' && <EnergyPage onBackToHub={onBackToHub} />}
          {activePage === 'real-estate' && <RealEstatePage onBackToHub={onBackToHub} />}
          {activePage === 'legal' && <LegalPage onBackToHub={onBackToHub} />}
          {activePage === 'travel' && <TravelPage onBackToHub={onBackToHub} />}
          {activePage === 'engineering' && <EngineeringPage onBackToHub={onBackToHub} />}
          {activePage === 'operations' && <OperationsPage onBackToHub={onBackToHub} />}
          {activePage === 'marketing' && <MarketingPage onBackToHub={onBackToHub} />}
          {activePage === 'central-plano-fim' && <CentralPlanoFimPage onBackToHub={onBackToHub} />}
        </Suspense>
      )}
    </PlatformShell>
  );
};
