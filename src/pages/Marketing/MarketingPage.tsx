import React from 'react';
import { Megaphone } from 'lucide-react';
import { PlaceholderModulePage } from '../../components/PlaceholderModulePage';

interface MarketingPageProps {
  onBackToHub: () => void;
}

export const MarketingPage: React.FC<MarketingPageProps> = ({ onBackToHub }) => (
  <PlaceholderModulePage
    title="Marketing"
    description="Campanhas, mídia, fornecedores e retorno dos investimentos."
    icon={<Megaphone className="w-6 h-6" />}
    onBackToHub={onBackToHub}
  />
);

export default MarketingPage;
