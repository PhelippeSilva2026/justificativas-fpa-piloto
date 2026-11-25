import React from 'react';
import { Settings2 } from 'lucide-react';
import { PlaceholderModulePage } from '../../components/PlaceholderModulePage';

interface OperationsPageProps {
  onBackToHub: () => void;
}

export const OperationsPage: React.FC<OperationsPageProps> = ({ onBackToHub }) => (
  <PlaceholderModulePage
    title="Operações"
    description="Indicadores operacionais, custos e eficiência."
    icon={<Settings2 className="w-6 h-6" />}
    onBackToHub={onBackToHub}
  />
);

export default OperationsPage;
