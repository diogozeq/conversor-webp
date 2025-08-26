import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ImagePreviewProps {
  imageSrc: string;
  fileName: string;
  fileSize: number;
  originalImageSrc?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imageSrc, fileName, fileSize, originalImageSrc }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  
  const formatFileSize = (bytes: number): string => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleCopy = async () => {
    setCopyStatus('copying');
    try {
      // Convert the WebP image to PNG for clipboard compatibility
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context for copying.');
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) {
            throw new Error('Failed to create blob for copying.');
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
          } catch (clipErr) {
            console.error('Failed to write to clipboard: ', clipErr);
            setCopyStatus('failed');
            setTimeout(() => setCopyStatus('idle'), 2000);
          }
        }, 'image/png');
      };
      img.onerror = () => {
        setCopyStatus('failed');
        setTimeout(() => setCopyStatus('idle'), 2000);
      };
      img.src = imageSrc;
    } catch (err) {
      console.error('Failed to start the image copy process: ', err);
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    // This provides a filename hint for drag and drop
    e.dataTransfer.setData('DownloadURL', `image/webp:${fileName}:${imageSrc}`);
  };

  const getCopyButtonText = () => {
    switch(copyStatus) {
      case 'copying': return 'Copiando...';
      case 'copied': return 'Copiado!';
      case 'failed': return 'Falhou!';
      default: return 'Copiar Imagem';
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Comparação Antes/Depois */}
      <div className="w-full max-w-4xl">
        <h3 className="text-xl font-semibold gradient-text mb-4 text-center">
          Comparação: Antes vs Depois
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Original */}
          {originalImageSrc && (
            <div className="bg-card rounded-xl p-4 shadow-card border border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                Original
              </h4>
              <img
                src={originalImageSrc}
                alt="Imagem original"
                className="rounded-lg shadow-lg max-w-full h-auto max-h-48 object-contain mx-auto"
              />
            </div>
          )}
          
          {/* Convertida */}
          <div className="bg-card rounded-xl p-4 shadow-card border border-border">
            <h4 className="text-sm font-medium text-primary mb-3 text-center">
              Convertida ({formatFileSize(fileSize)})
            </h4>
            <img
              src={imageSrc}
              alt="Imagem convertida"
              draggable="true"
              onDragStart={handleDragStart}
              className="cursor-grab rounded-lg shadow-lg max-w-full h-auto max-h-48 object-contain mx-auto tech-glow"
              title={`Arraste para salvar como ${fileName}`}
            />
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-primary font-semibold text-lg">{fileName}</p>
        <p className="text-muted-foreground">{formatFileSize(fileSize)}</p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <Button asChild variant="default" className="bg-gradient-primary hover:opacity-90 tech-glow">
          <a
            href={imageSrc}
            download={fileName}
            className="w-full sm:w-auto text-center"
          >
            Baixar Imagem
          </a>
        </Button>
        
        <Button
          onClick={handleCopy}
          disabled={copyStatus !== 'idle'}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {getCopyButtonText()}
        </Button>
      </div>
      
      <div className="bg-card border border-border rounded-lg p-4 max-w-md text-center">
        <h3 className="text-primary font-semibold mb-2">✨ Problema Resolvido!</h3>
        <p className="text-sm text-muted-foreground">
          Agora quando você arrastar esta imagem para outro site, ela manterá o nome correto: <span className="text-primary font-mono">{fileName}</span>
        </p>
      </div>
    </div>
  );
};

export default ImagePreview;