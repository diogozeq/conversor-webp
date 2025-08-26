import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Spinner from './Spinner';

interface ImageCropperProps {
  imageSrc: string;
  onSave: (croppedCanvas: HTMLCanvasElement) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onSave, onCancel }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 300, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = () => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setImageSize({ width: rect.width, height: rect.height });
      
      // Center the initial crop
      const initialSize = Math.min(rect.width, rect.height) * 0.8;
      setCrop({
        x: (rect.width - initialSize) / 2,
        y: (rect.height - initialSize) / 2,
        width: initialSize,
        height: initialSize
      });
    }
  };

  const getCroppedCanvas = (): HTMLCanvasElement => {
    if (!imgRef.current) throw new Error('Image not loaded');
    
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context.');

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    
    return canvas;
  };

  const handleSaveCrop = () => {
    if (!imgRef.current) return;
    setIsSaving(true);
    try {
      const canvas = getCroppedCanvas();
      onSave(canvas);
    } catch (e) {
      console.error("Error processing crop:", e);
      setIsSaving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
    } else {
      setIsDragging(true);
    }
    
    setDragStart({
      x: e.clientX - rect.left - crop.x,
      y: e.clientY - rect.top - crop.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const newX = Math.max(0, Math.min(x - dragStart.x, imageSize.width - crop.width));
      const newY = Math.max(0, Math.min(y - dragStart.y, imageSize.height - crop.height));
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      const minSize = 50;
      let newWidth = crop.width;
      let newHeight = crop.height;
      let newX = crop.x;
      let newY = crop.y;

      if (resizeHandle.includes('right')) {
        newWidth = Math.max(minSize, Math.min(x - crop.x, imageSize.width - crop.x));
      }
      if (resizeHandle.includes('bottom')) {
        newHeight = Math.max(minSize, Math.min(y - crop.y, imageSize.height - crop.y));
      }
      if (resizeHandle.includes('left')) {
        const maxWidth = crop.x + crop.width;
        newWidth = Math.max(minSize, maxWidth - x);
        newX = Math.max(0, x);
      }
      if (resizeHandle.includes('top')) {
        const maxHeight = crop.y + crop.height;
        newHeight = Math.max(minSize, maxHeight - y);
        newY = Math.max(0, y);
      }

      setCrop({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle('');
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <h2 className="text-2xl font-bold text-center gradient-text">
        Modo de Edição
      </h2>
      
      <div 
        ref={containerRef}
        className="relative bg-card p-4 rounded-xl border border-border shadow-card overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imgRef}
          alt="Imagem para recortar"
          src={imageSrc}
          onLoad={handleImageLoad}
          className="max-w-full max-h-[60vh] object-contain select-none"
          draggable={false}
        />
        
        {/* Crop overlay */}
        {imageSize.width > 0 && (
          <>
            {/* Dark overlay */}
            <div 
              className="absolute inset-0 bg-black/50 pointer-events-none"
              style={{ top: '1rem', left: '1rem', right: '1rem', bottom: '1rem' }}
            />
            
            {/* Crop area */}
            <div
              className="absolute border-2 border-primary bg-transparent cursor-move"
              style={{
                left: crop.x + 16,
                top: crop.y + 16,
                width: crop.width,
                height: crop.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
              }}
              onMouseDown={(e) => handleMouseDown(e)}
            >
              {/* Resize handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle => (
                <div
                  key={handle}
                  className="absolute w-3 h-3 bg-primary border border-primary-foreground cursor-nw-resize"
                  style={{
                    [handle.includes('top') ? 'top' : 'bottom']: -6,
                    [handle.includes('left') ? 'left' : 'right']: -6,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, handle)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground text-center max-w-md">
        Arraste para mover a área de seleção. Use os quadrados nos cantos para redimensionar.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <Button
          onClick={onCancel}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        
        <Button
          onClick={handleSaveCrop}
          disabled={isSaving}
          className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 tech-glow"
        >
          {isSaving && <Spinner />}
          {isSaving ? 'Processando...' : 'Salvar Corte'}
        </Button>
      </div>
    </div>
  );
};

export default ImageCropper;