import React from 'react';
import { HardHat } from 'lucide-react';
import { PlaceholderModulePage } from '../../components/PlaceholderModulePage';

interface EngineeringPageProps {
  onBackToHub: () => void;
}

export const EngineeringPage: React.FC<EngineeringPageProps> = ({ onBackToHub }) => (
  <PlaceholderModulePage
    title="Engenharia"
    description="Projetos, implantação, materiais e acompanhamento financeiro."
    icon={<HardHat className="w-6 h-6" />}
    onBackToHub={onBackToHub}
  />
);

export default EngineeringPage;
