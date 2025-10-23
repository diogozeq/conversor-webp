import React from 'react';
import { Button } from '@/components/ui/button';
import { Image, Images } from 'lucide-react';

interface ModeSelectorProps {
  onSelectMode: (mode: 'individual' | 'batch') => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-4">
          Image Converter Pro
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Escolha o modo de conversão
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        <button
          onClick={() => onSelectMode('individual')}
          className="group p-8 rounded-xl border-2 border-border hover:border-primary transition-all duration-300 bg-card shadow-card hover:shadow-glow cursor-pointer"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Image className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Modo Individual</h3>
            <p className="text-muted-foreground text-center">
              Converta uma imagem por vez com controle total de edição e corte
            </p>
          </div>
        </button>

        <button
          onClick={() => onSelectMode('batch')}
          className="group p-8 rounded-xl border-2 border-border hover:border-primary transition-all duration-300 bg-card shadow-card hover:shadow-glow cursor-pointer"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Images className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Modo em Lote</h3>
            <p className="text-muted-foreground text-center">
              Adicione múltiplas imagens e converta todas de uma vez
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ModeSelector;
