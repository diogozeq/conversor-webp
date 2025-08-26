# Image Converter Pro 🚀

Um conversor de imagens futurista que resolve o problema do nome de arquivo perdido ao arrastar imagens.

## 🎯 Problema Resolvido

Quando você converte uma imagem e ela vira uma Data URL (`data:image/webp;base64,...`), ao arrastá-la para outro site, ela sempre recebe um nome genérico como `download.webp`. 

**Nossa solução:** Service Worker + IndexedDB para simular URLs reais e manter nomes de arquivo perfeitos!

## ✨ Funcionalidades

- 🖼️ **Conversão para WebP 1000x1000** com otimização automática de qualidade (50-100KB)
- 🎯 **Nome de arquivo preservado** ao arrastar para qualquer lugar
- ✂️ **Editor/Recortador** integrado para ajustes precisos
- 📋 **Copiar para clipboard** com conversão automática para PNG
- 🗂️ **Drag & Drop** e **Ctrl+V** para máxima conveniência
- 🧹 **Limpeza automática** de arquivos antigos (>24h)
- 🌟 **Interface futurista** com animações e efeitos visuais

## 🔧 Tecnologias

- **Frontend:** React + TypeScript + Tailwind CSS
- **Storage:** IndexedDB para armazenamento local
- **Worker:** Service Worker para interceptação de requisições
- **Processing:** Web Worker para otimização de imagens
- **UI:** shadcn/ui components com design system customizado

## 🎨 Design System

- **Cores:** Tema tech escuro com acentos cyan (#00d9ff)
- **Gradientes:** Primário, secundário e de background
- **Animações:** Float, pulse-glow, tech-glow effects
- **Responsivo:** Mobile-first design

## 🚀 Como Funciona

1. **Upload:** Arraste uma imagem ou use Ctrl+V
2. **Processamento:** Web Worker otimiza para WebP 1000x1000
3. **Armazenamento:** IndexedDB salva com nome único
4. **URL Falsa:** Gera `/imagens-geradas/nome-unico.webp`
5. **Interceptação:** Service Worker serve o arquivo real
6. **Resultado:** Nome preservado ao arrastar! ✨

## 📱 Como Usar

1. Arraste uma imagem para a área de upload
2. Aguarde a conversão automática
3. Use "Editar/Recortar" se necessário
4. Baixe ou arraste a imagem - o nome será mantido!

**Dica:** Arraste a imagem convertida para o Gmail, Notion, ou qualquer site - o nome correto será preservado!

---

*Construído com Lovable - A solução definitiva para o problema de nomes de arquivo em conversores de imagem.*
