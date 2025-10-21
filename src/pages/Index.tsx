import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Dropzone from '@/components/Dropzone';
import ImagePreview from '@/components/ImagePreview';
import ImageCropper from '@/components/ImageCropper';
import Spinner from '@/components/Spinner';
import { saveImageToDB, generateImageURL, cleanupOldImages } from '@/utils/indexeddb';
import { registerServiceWorker, isServiceWorkerActive } from '@/utils/serviceWorkerManager';

type AppStep = 'idle' | 'converting' | 'finished' | 'cropping';

// Web Worker code for image processing
const imageWorkerCode = `
const blobToDataUrl = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const generateOptimizedWebP = async (canvas) => {
    const TARGET_MIN_BYTES = 50 * 1024; // 50KB
    const TARGET_MAX_BYTES = 100 * 1024; // 100KB
    const ITERATIONS = 15;

    const getWebpBlob = (quality) => canvas.convertToBlob({ type: 'image/webp', quality });

    // Teste inicial com qualidade muito alta para verificar se a imagem é pequena
    let testBlob = await getWebpBlob(0.98);
    
    // Se mesmo com qualidade alta está abaixo de 50KB, retorna com qualidade máxima
    if (testBlob.size < TARGET_MIN_BYTES) {
        return { blob: testBlob, size: testBlob.size };
    }

    // Se está acima de 100KB mesmo com qualidade baixa, precisa otimizar mais
    let lowQualityTest = await getWebpBlob(0.5);
    if (lowQualityTest.size > TARGET_MAX_BYTES) {
        // Busca uma qualidade ainda menor
        let minQuality = 0.1;
        let maxQuality = 0.5;
        
        for (let i = 0; i < ITERATIONS; i++) {
            const currentQuality = (minQuality + maxQuality) / 2;
            const blob = await getWebpBlob(currentQuality);
            
            if (blob.size <= TARGET_MAX_BYTES) {
                return { blob, size: blob.size };
            }
            maxQuality = currentQuality;
        }
    }

    // Busca binária normal entre 0.5 e 0.98
    let minQuality = 0.5;
    let maxQuality = 0.98;
    let bestBlob = testBlob;
    let closestToTarget = Math.abs(testBlob.size - ((TARGET_MIN_BYTES + TARGET_MAX_BYTES) / 2));

    for (let i = 0; i < ITERATIONS; i++) {
        const currentQuality = (minQuality + maxQuality) / 2;
        const blob = await getWebpBlob(currentQuality);
        const distanceToTarget = Math.abs(blob.size - ((TARGET_MIN_BYTES + TARGET_MAX_BYTES) / 2));
        
        // Se está no range perfeito, retorna imediatamente
        if (blob.size >= TARGET_MIN_BYTES && blob.size <= TARGET_MAX_BYTES) {
            if (distanceToTarget < closestToTarget) {
                bestBlob = blob;
                closestToTarget = distanceToTarget;
            }
        }
        
        if (blob.size > TARGET_MAX_BYTES) {
            maxQuality = currentQuality;
        } else {
            minQuality = currentQuality;
            // Sempre manter o melhor blob encontrado
            if (distanceToTarget < closestToTarget || blob.size >= TARGET_MIN_BYTES) {
                bestBlob = blob;
                closestToTarget = distanceToTarget;
            }
        }
    }
    
    if (!bestBlob) {
        throw new Error("Falha ao gerar o blob da imagem.");
    }

    return { blob: bestBlob, size: bestBlob.size };
};

self.onmessage = async (event) => {
    const { type, imageDataUrl } = event.data;

    // Health check response
    if (type === 'HEALTH_CHECK') {
        self.postMessage({ status: 'health' });
        return;
    }

    try {
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        
        const canvas = new OffscreenCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Não foi possível obter o contexto do OffscreenCanvas.');
        }

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const { width: imgWidth, height: imgHeight } = imageBitmap;

        if (type === 'CONVERT') {
            const canvasAspectRatio = 1;
            const imgAspectRatio = imgWidth / imgHeight;
            let sx = 0, sy = 0, sWidth = imgWidth, sHeight = imgHeight;

            if (imgAspectRatio > canvasAspectRatio) {
                sWidth = imgHeight * canvasAspectRatio;
                sx = (imgWidth - sWidth) / 2;
            } else if (imgAspectRatio < canvasAspectRatio) {
                sHeight = imgWidth / canvasAspectRatio;
                sy = (imgHeight - sHeight) / 2;
            }
            
            ctx.drawImage(imageBitmap, sx, sy, sWidth, sHeight, 0, 0, 1000, 1000);
        } else {
            ctx.drawImage(imageBitmap, 0, 0, 1000, 1000);
        }

        imageBitmap.close();

        const result = await generateOptimizedWebP(canvas);
        
        self.postMessage({ status: 'success', ...result });

    } catch (error) {
        self.postMessage({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Um erro desconhecido ocorreu no worker.' 
        });
    }
};
`;

const Index: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [convertedImageUrl, setConvertedImageUrl] = useState<string | null>(null);
  const [convertedFileName, setConvertedFileName] = useState<string | null>(null);
  const [convertedSize, setConvertedSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [step, setStep] = useState<AppStep>('idle');
  const workerRef = useRef<Worker | null>(null);
  const { toast } = useToast();

  // Initialize Service Worker and Web Worker with double checks
  useEffect(() => {
    const init = async () => {
      // Register Service Worker
      const swRegistered = await registerServiceWorker();
      if (swRegistered) {
        console.log('Service Worker registrado com sucesso');
      } else {
        toast({
          title: "Aviso",
          description: "Service Worker não pôde ser registrado. Algumas funcionalidades podem não funcionar.",
          variant: "destructive"
        });
      }

      // Cleanup old images
      cleanupOldImages().then(count => {
        if (count > 0) {
          console.log(`Limpeza automática: ${count} imagens antigas removidas`);
        }
      });
    };

    init();

    // Initialize Web Worker with double checks
    const createWorker = () => {
      const workerBlob = new Blob([imageWorkerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);
      
      // Double check: verify worker is responsive
      const healthCheck = () => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'HEALTH_CHECK' });
      };
      
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setTimeout(() => {
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = createWorker();
          }
        }, 1000);
      };
      
      // Health check every 30 seconds
      const healthInterval = setInterval(healthCheck, 30000);
      
      worker.onmessage = (event: MessageEvent<{status: 'success' | 'error' | 'health', blob?: Blob, size?: number, message?: string}>) => {
        const { status, blob, size, message } = event.data;
        
        if (status === 'health') {
          return; // Health check response
        }
        
        if (status === 'success' && blob && size !== undefined) {
          // Save to IndexedDB and generate URL
          saveImageToDB(blob).then(filename => {
            const imageUrl = generateImageURL(filename);
            setConvertedImageUrl(imageUrl);
            setConvertedFileName(filename);
            setConvertedSize(size);
            setStep('finished');
            
            toast({
              title: "✨ Sucesso!",
              description: `Imagem convertida: ${filename} (${(size / 1024).toFixed(1)} KB)`
            });
          }).catch(err => {
            console.error('Erro ao salvar imagem:', err);
            setError('Erro ao salvar a imagem processada.');
            setStep('idle');
          });
        } else {
          setError(message || 'Falha ao processar a imagem.');
          setStep('idle');
          toast({
            title: "Erro",
            description: message || 'Falha ao processar a imagem.',
            variant: "destructive"
          });
        }
      };
      
      return worker;
    };
    
    workerRef.current = createWorker();


    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [toast]);

  const convertImage = useCallback((imageDataUrl: string) => {
    if (!workerRef.current) {
      setError('Worker não está disponível.');
      return;
    }
    
    setStep('converting');
    setError(null);
    setOriginalImage(imageDataUrl);
    workerRef.current.postMessage({ type: 'CONVERT', imageDataUrl });
  }, []);

  const handleFileDrop = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('O arquivo não é uma imagem. Por favor, solte um arquivo de imagem válido.');
      toast({
        title: "Erro",
        description: "O arquivo não é uma imagem válida.",
        variant: "destructive"
      });
      return;
    }
    
    handleReset();
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        convertImage(event.target.result);
      } else {
        setError('Falha ao ler o arquivo.');
      }
    };
    reader.onerror = () => setError('Ocorreu um erro ao ler o arquivo.');
    reader.readAsDataURL(file);
  }, [convertImage]);

  // Handle paste events
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (step !== 'idle' || !event.clipboardData) return;
      
      for (const item of Array.from(event.clipboardData.items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            handleFileDrop(file);
            return;
          }
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileDrop, step]);

  const handleReset = () => {
    setOriginalImage(null);
    setConvertedImageUrl(null);
    setConvertedFileName(null);
    setConvertedSize(null);
    setError(null);
    setStep('idle');
  };

  const handleEdit = () => {
    if (originalImage) {
      setStep('cropping');
    }
  };

  const handleSaveCrop = async (croppedCanvas: HTMLCanvasElement, forceSquare: boolean) => {
    setStep('converting');
    
    const finalCanvas = document.createElement('canvas');
    
    if (forceSquare) {
      // Force to 1000x1000 square
      finalCanvas.width = 1000;
      finalCanvas.height = 1000;
    } else {
      // Keep the cropped dimensions
      finalCanvas.width = croppedCanvas.width;
      finalCanvas.height = croppedCanvas.height;
    }
    
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      setError('Não foi possível obter o contexto do canvas para redimensionar.');
      setStep('finished');
      return;
    }
    
    if (forceSquare) {
      ctx.drawImage(croppedCanvas, 0, 0, 1000, 1000);
    } else {
      ctx.drawImage(croppedCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    }
    
    const imageDataUrl = finalCanvas.toDataURL();
    workerRef.current?.postMessage({ type: 'OPTIMIZE_CROPPED', imageDataUrl });
  };

  const handleFinishedDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.[0]) {
        handleFileDrop(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
      }
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'idle':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-4">
                Image Converter Pro
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Converta suas imagens para WebP 1000x1000 com qualidade otimizada e 
                <span className="text-primary font-semibold"> NUNCA perca o nome do arquivo</span> ao arrastar!
              </p>
            </div>
            
            <div className="w-full max-w-2xl">
              <Dropzone 
                onDrop={handleFileDrop}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
              />
            </div>
            
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-w-md text-center">
                <p className="text-destructive font-medium">{error}</p>
              </div>
            )}
          </div>
        );

      case 'converting':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="pulse-glow">
              <Spinner />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold gradient-text mb-2">
                Processando sua imagem...
              </h2>
              <p className="text-muted-foreground">
                Otimizando qualidade e preparando para nunca perder o nome do arquivo
              </p>
            </div>
          </div>
        );

      case 'cropping':
        return originalImage ? (
          <ImageCropper
            imageSrc={originalImage}
            onSave={handleSaveCrop}
            onCancel={() => setStep('finished')}
          />
        ) : null;

      case 'finished':
        return convertedImageUrl && convertedFileName && convertedSize !== null ? (
          <div 
            className={`flex flex-col items-center gap-8 ${isDragging ? 'opacity-50' : ''}`}
            {...handleFinishedDragEvents}
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold gradient-text mb-2">
                Conversão Concluída!
              </h2>
              <p className="text-muted-foreground">
                Sua imagem foi otimizada e está pronta para uso
              </p>
            </div>
            
            <ImagePreview
              imageSrc={convertedImageUrl}
              fileName={convertedFileName}
              fileSize={convertedSize}
              originalImageSrc={originalImage}
            />
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleEdit} variant="secondary">
                ✂️ Editar/Recortar
              </Button>
              <Button onClick={handleReset} className="bg-gradient-primary hover:opacity-90">
                🔄 Nova Conversão
              </Button>
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg tech-glow" />
            <span className="font-bold text-xl gradient-text">ImageConverter Pro</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Service Worker: 
            <span className={`font-medium ${isServiceWorkerActive() ? 'text-primary' : 'text-destructive'}`}>
              {isServiceWorkerActive() ? '✅ Ativo' : '❌ Inativo'}
            </span>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderContent()}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">
            Tecnologia: Service Worker + IndexedDB para nomes de arquivo perfeitos 🚀
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;