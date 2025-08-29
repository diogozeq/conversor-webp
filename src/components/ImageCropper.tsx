
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
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, crop: { x: 0, y: 0, width: 0, height: 0 } });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = () => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setImageSize({ width: rect.width, height: rect.height });
      
      // Center the initial crop
      const initialSize = Math.min(rect.width, rect.height) * 0.6;
      setCrop({
        x: (rect.width - initialSize) / 2,
        y: (rect.height - initialSize) / 2,
        width: initialSize,
        height: initialSize
      });
    }
  };

  const makeSquare = () => {
    if (!imgRef.current) return;
    
    const minDimension = Math.min(crop.width, crop.height);
    const maxX = imageSize.width - crop.x;
    const maxY = imageSize.height - crop.y;
    const maxSize = Math.min(minDimension, maxX, maxY);
    
    setCrop(prev => ({ ...prev, width: maxSize, height: maxSize }));
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

    // Use high-quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setResizeStart({
        x: mouseX,
        y: mouseY,
        crop: { ...crop }
      });
    } else {
      setIsDragging(true);
      setDragStart({
        x: mouseX - crop.x,
        y: mouseY - crop.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || (!isDragging && !isResizing)) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      const newX = Math.max(0, Math.min(mouseX - dragStart.x, imageSize.width - crop.width));
      const newY = Math.max(0, Math.min(mouseY - dragStart.y, imageSize.height - crop.height));
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      const deltaX = mouseX - resizeStart.x;
      const deltaY = mouseY - resizeStart.y;
      const startCrop = resizeStart.crop;
      
      let newCrop = { ...startCrop };
      const minSize = 30;

      switch (resizeHandle) {
        case 'top-left':
          newCrop.width = Math.max(minSize, startCrop.width - deltaX);
          newCrop.height = Math.max(minSize, startCrop.height - deltaY);
          newCrop.x = startCrop.x + (startCrop.width - newCrop.width);
          newCrop.y = startCrop.y + (startCrop.height - newCrop.height);
          break;
        case 'top-right':
          newCrop.width = Math.max(minSize, startCrop.width + deltaX);
          newCrop.height = Math.max(minSize, startCrop.height - deltaY);
          newCrop.y = startCrop.y + (startCrop.height - newCrop.height);
          break;
        case 'bottom-left':
          newCrop.width = Math.max(minSize, startCrop.width - deltaX);
          newCrop.height = Math.max(minSize, startCrop.height + deltaY);
          newCrop.x = startCrop.x + (startCrop.width - newCrop.width);
          break;
        case 'bottom-right':
          newCrop.width = Math.max(minSize, startCrop.width + deltaX);
          newCrop.height = Math.max(minSize, startCrop.height + deltaY);
          break;
        case 'top':
          newCrop.height = Math.max(minSize, startCrop.height - deltaY);
          newCrop.y = startCrop.y + (startCrop.height - newCrop.height);
          break;
        case 'bottom':
          newCrop.height = Math.max(minSize, startCrop.height + deltaY);
          break;
        case 'left':
          newCrop.width = Math.max(minSize, startCrop.width - deltaX);
          newCrop.x = startCrop.x + (startCrop.width - newCrop.width);
          break;
        case 'right':
          newCrop.width = Math.max(minSize, startCrop.width + deltaX);
          break;
      }

      // Constrain to image bounds
      newCrop.x = Math.max(0, Math.min(newCrop.x, imageSize.width - newCrop.width));
      newCrop.y = Math.max(0, Math.min(newCrop.y, imageSize.height - newCrop.height));
      newCrop.width = Math.min(newCrop.width, imageSize.width - newCrop.x);
      newCrop.height = Math.min(newCrop.height, imageSize.height - newCrop.y);

      setCrop(newCrop);
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
              {/* Corner handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle => (
                <div
                  key={handle}
                  className="absolute w-4 h-4 bg-primary border-2 border-background cursor-nw-resize hover:bg-primary/80 transition-colors z-10 rounded-full"
                  style={{
                    ...(handle.includes('top') ? { top: -8 } : { bottom: -8 }),
                    ...(handle.includes('left') ? { left: -8 } : { right: -8 }),
                    ...(handle === 'top-right' || handle === 'bottom-left' ? { cursor: 'ne-resize' } : {}),
                  }}
                  onMouseDown={(e) => handleMouseDown(e, handle)}
                />
              ))}
              
              {/* Edge handles */}
              {['top', 'bottom', 'left', 'right'].map(handle => {
                const isVertical = handle === 'top' || handle === 'bottom';
                return (
                  <div
                    key={handle}
                    className={`absolute bg-primary border border-background hover:bg-primary/80 transition-colors z-10 ${
                      isVertical ? 'w-8 h-2 cursor-ns-resize' : 'w-2 h-8 cursor-ew-resize'
                    }`}
                    style={{
                      ...(handle === 'top' ? { top: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
                      ...(handle === 'bottom' ? { bottom: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
                      ...(handle === 'left' ? { left: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
                      ...(handle === 'right' ? { right: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
                    }}
                    onMouseDown={(e) => handleMouseDown(e, handle)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground text-center max-w-md">
        Arraste para mover a área de seleção. Use os pontos e bordas para redimensionar livremente.
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
          onClick={makeSquare}
          variant="outline"
          className="w-full sm:w-auto"
        >
          📐 Tornar 1:1
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
