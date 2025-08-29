// File validation utilities with security checks

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
] as const;

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif'
] as const;

// Magic numbers for file type validation
const MAGIC_NUMBERS = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  gif: [0x47, 0x49, 0x46, 0x38]
} as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const MAX_FILENAME_LENGTH = 255;

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateFileType(file: File): ValidationResult {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      isValid: false,
      error: 'Tipo de arquivo não permitido. Use apenas JPEG, PNG, WebP ou GIF.'
    };
  }

  // Check file extension
  const extension = getFileExtension(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
    return {
      isValid: false,
      error: 'Extensão de arquivo não permitida.'
    };
  }

  return { isValid: true };
}

export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Arquivo muito grande. Máximo permitido: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: 'Arquivo vazio não é permitido.'
    };
  }

  return { isValid: true };
}

export function validateFileName(fileName: string): ValidationResult {
  // Check length
  if (fileName.length > MAX_FILENAME_LENGTH) {
    return {
      isValid: false,
      error: 'Nome do arquivo muito longo.'
    };
  }

  // Sanitize filename - remove dangerous characters
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
  if (dangerousChars.test(fileName)) {
    return {
      isValid: false,
      error: 'Nome do arquivo contém caracteres não permitidos.'
    };
  }

  // Check for directory traversal attempts
  if (fileName.includes('..') || fileName.startsWith('.')) {
    return {
      isValid: false,
      error: 'Nome do arquivo inválido.'
    };
  }

  return { isValid: true };
}

export async function validateMagicNumbers(file: File): Promise<ValidationResult> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check for known magic numbers
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;

    if (!isJPEG && !isPNG && !isWebP && !isGIF) {
      return {
        isValid: false,
        error: 'Arquivo corrompido ou não é uma imagem válida.'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Erro ao validar o arquivo.'
    };
  }
}

export function sanitizeFileName(fileName: string): string {
  // Remove dangerous characters and normalize
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .slice(0, MAX_FILENAME_LENGTH);
}

export async function validateFile(file: File): Promise<ValidationResult> {
  // Run all validations
  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) return typeValidation;

  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) return sizeValidation;

  const nameValidation = validateFileName(file.name);
  if (!nameValidation.isValid) return nameValidation;

  const magicValidation = await validateMagicNumbers(file);
  if (!magicValidation.isValid) return magicValidation;

  return { isValid: true };
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.slice(lastDotIndex) : '';
}