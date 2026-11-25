import React from 'react';
import { Plane } from 'lucide-react';
import { PlaceholderModulePage } from '../../components/PlaceholderModulePage';

interface TravelPageProps {
  onBackToHub: () => void;
}

export const TravelPage: React.FC<TravelPageProps> = ({ onBackToHub }) => (
  <PlaceholderModulePage
    title="Viagens"
    description="Despesas, fornecedores, destinos e aderência às políticas."
    icon={<Plane className="w-6 h-6" />}
    onBackToHub={onBackToHub}
  />
);

export default TravelPage;
