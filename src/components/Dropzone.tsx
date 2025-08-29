import React from 'react';
import { validateFile, sanitizeFileName } from '@/utils/fileValidation';
import { useToast } from '@/hooks/use-toast';

const UploadIcon: React.FC = () => (
  <svg
    className="w-16 h-16 text-muted-foreground group-hover:text-primary transition-colors duration-300"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);

interface DropzoneProps {
  onDrop: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onDrop, isDragging, setIsDragging }) => {
  const { toast } = useToast();
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      // Validate file security
      const validation = await validateFile(file);
      if (!validation.isValid) {
        toast({
          title: "Arquivo inválido",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      // Sanitize filename for additional security
      const sanitizedFile = new File([file], sanitizeFileName(file.name), {
        type: file.type,
        lastModified: file.lastModified
      });

      onDrop(sanitizedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleClick = () => {
    const input = document.getElementById('file-input');
    input?.click();
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`group w-full h-80 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer bg-card shadow-card
        ${isDragging ? 'border-primary bg-primary/5 tech-glow' : 'border-border hover:border-primary hover:bg-primary/5'}`}
    >
      <div className="text-center pointer-events-none float">
        <UploadIcon />
        <p className="mt-4 text-xl font-semibold text-foreground">
          Arraste sua imagem para cá ou cole (CTRL+V)
        </p>
        <p className="text-muted-foreground">ou clique para selecionar um arquivo</p>
      </div>
      <input
        id="file-input"
        type="file"
        className="hidden"
        accept="image/*"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            
            // Validate file security
            const validation = await validateFile(file);
            if (!validation.isValid) {
              toast({
                title: "Arquivo inválido", 
                description: validation.error,
                variant: "destructive"
              });
              return;
            }

            // Sanitize filename for additional security
            const sanitizedFile = new File([file], sanitizeFileName(file.name), {
              type: file.type,
              lastModified: file.lastModified
            });

            onDrop(sanitizedFile);
          }
        }}
        onClick={(e) => {
          const element = e.target as HTMLInputElement;
          element.value = '';
        }}
        aria-label="File selector"
      />
    </div>
  );
};

export default Dropzone;