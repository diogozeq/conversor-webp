import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BatchImage {
  id: string;
  file: File;
  preview: string;
  converted?: string;
  fileName?: string;
  size?: number;
  status: 'pending' | 'processing' | 'done';
}

interface BatchModeProps {
  onBack: () => void;
  workerRef: React.RefObject<Worker | null>;
}

const BatchMode: React.FC<BatchModeProps> = ({ onBack, workerRef }) => {
  const [images, setImages] = useState<BatchImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const addImages = useCallback((files: File[]) => {
    const newImages: BatchImage[] = files
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const
      }));

    if (newImages.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhuma imagem válida encontrada.",
        variant: "destructive"
      });
      return;
    }

    setImages(prev => [...prev, ...newImages]);
  }, [toast]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.preview);
        if (img.converted) URL.revokeObjectURL(img.converted);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const processImages = useCallback(async () => {
    if (!workerRef.current || images.length === 0) return;

    setIsProcessing(true);

    for (const image of images) {
      if (image.status === 'done') continue;

      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'processing' } : img
      ));

      try {
        const reader = new FileReader();
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(image.file);
        });

        const result = await new Promise<{ blob: Blob; size: number }>((resolve, reject) => {
          const handler = (event: MessageEvent) => {
            const { status, blob, size, message } = event.data;
            if (status === 'success' && blob && size !== undefined) {
              workerRef.current?.removeEventListener('message', handler);
              resolve({ blob, size });
            } else if (status === 'error') {
              workerRef.current?.removeEventListener('message', handler);
              reject(new Error(message));
            }
          };
          
          workerRef.current?.addEventListener('message', handler);
          workerRef.current?.postMessage({ type: 'CONVERT', imageDataUrl });
        });

        const convertedUrl = URL.createObjectURL(result.blob);
        const originalName = image.file.name.replace(/\.[^/.]+$/, '');
        const fileName = `${originalName}.webp`;

        setImages(prev => prev.map(img =>
          img.id === image.id
            ? { ...img, status: 'done', converted: convertedUrl, fileName, size: result.size }
            : img
        ));
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        setImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, status: 'pending' } : img
        ));
      }
    }

    setIsProcessing(false);
    toast({
      title: "✨ Concluído!",
      description: `${images.length} imagens convertidas com sucesso.`
    });
  }, [images, workerRef, toast]);

  const downloadImage = useCallback((image: BatchImage) => {
    if (!image.converted || !image.fileName) return;

    const link = document.createElement('a');
    link.href = image.converted;
    link.download = image.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadAll = useCallback(() => {
    images.filter(img => img.status === 'done').forEach(img => {
      setTimeout(() => downloadImage(img), 100);
    });
  }, [images, downloadImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  }, [addImages]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addImages(files);
    }
  }, [addImages]);

  const pendingCount = images.filter(img => img.status === 'pending').length;
  const doneCount = images.filter(img => img.status === 'done').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Modo em Lote</h2>
          <p className="text-muted-foreground">
            {images.length === 0 
              ? 'Adicione suas imagens' 
              : `${images.length} imagens (${doneCount} convertidas)`}
          </p>
        </div>
        <Button onClick={onBack} variant="outline">
          ← Voltar
        </Button>
      </div>

      {images.length === 0 ? (
        <div
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('batch-file-input')?.click()}
          className={`w-full h-80 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer bg-card shadow-card
            ${isDragging ? 'border-primary bg-primary/5 tech-glow' : 'border-border hover:border-primary hover:bg-primary/5'}`}
        >
          <div className="text-center pointer-events-none">
            <p className="text-xl font-semibold text-foreground mb-2">
              Arraste suas imagens aqui
            </p>
            <p className="text-muted-foreground">ou clique para selecionar múltiplos arquivos</p>
          </div>
          <input
            id="batch-file-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            <Button
              onClick={() => document.getElementById('batch-file-input')?.click()}
              variant="outline"
              disabled={isProcessing}
            >
              + Adicionar Mais
            </Button>
            <input
              id="batch-file-input"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
            
            {pendingCount > 0 && (
              <Button
                onClick={processImages}
                disabled={isProcessing}
                className="bg-gradient-primary hover:opacity-90"
              >
                {isProcessing ? '⏳ Convertendo...' : `🚀 Converter ${pendingCount} Imagens`}
              </Button>
            )}
            
            {doneCount > 0 && (
              <Button onClick={downloadAll} variant="secondary">
                📥 Baixar Todas ({doneCount})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map(image => (
              <div
                key={image.id}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  image.status === 'done'
                    ? 'border-primary shadow-glow'
                    : image.status === 'processing'
                    ? 'border-primary animate-pulse'
                    : 'border-border'
                }`}
              >
                <div className="aspect-square relative">
                  <img
                    src={image.converted || image.preview}
                    alt={image.file.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {image.status === 'processing' && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  )}
                  
                  {image.status === 'done' && (
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => downloadImage(image)}
                        className="bg-gradient-primary"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div className="p-2 bg-card">
                  <p className="text-xs truncate">{image.fileName || image.file.name}</p>
                  {image.size && (
                    <p className="text-xs text-muted-foreground">
                      {(image.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BatchMode;
