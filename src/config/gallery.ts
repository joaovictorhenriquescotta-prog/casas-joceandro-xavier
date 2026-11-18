// Galeria da tela inicial. Arquivos em public/galeria/ (NN.webp = imagem grande, NN-mini.webp = miniatura).
// Para trocar ou acrescentar imagens: gere os dois arquivos e edite esta lista.
export interface GalleryImage {
  file: string;
  caption: string;
}

export const GALLERY: GalleryImage[] = [
  { file: '01', caption: 'As duas casas na esquina ao entardecer' },
  { file: '02', caption: 'Vista da esquina pela rua' },
  { file: '03', caption: 'Vista frontal do muro e dos portões' },
  { file: '04', caption: 'Vista aérea das duas casas' },
  { file: '05', caption: 'Garagem e fachada vistas de perto' },
  { file: '06', caption: 'Garagem por outro ângulo' },
  { file: '07', caption: 'Garagem e canteiro lateral' },
  { file: '08', caption: 'Planta humanizada das duas casas' },
  { file: '09', caption: 'Planta humanizada em detalhe' },
  { file: '10', caption: 'Opção de cores: Azul-marinho' },
  { file: '11', caption: 'Opção de cores: Bege e neutros' },
  { file: '12', caption: 'Opção de cores: Cinza e preto' },
  { file: '13', caption: 'Opção de cores: Marrom cacau' },
  { file: '14', caption: 'Opção de cores: Terracota rosada' },
  { file: '15', caption: 'Opção de cores: Verde-oliva' },
];

export const galleryUrl = (file: string, mini = false) => `/galeria/${file}${mini ? '-mini' : ''}.webp`;
