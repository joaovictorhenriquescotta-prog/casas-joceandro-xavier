/** Informações comerciais do empreendimento exibidas na visita. */
export const PROJECT = {
  name: 'Casas Joceandro Xavier',
  location: 'Lot. Fazenda São Martinho · Anchieta/ES',
  description:
    'Casas térreas contemporâneas, com sala integrada à cozinha, suíte com banheiro, segundo quarto, banheiro social e garagem coberta. Lote de esquina murado, com jardim frontal.',
  highlights: [
    'Duas unidades independentes e espelhadas',
    'Estar, jantar e cozinha integrados (30,32 m²)',
    'Suíte (10,50 m²) com banheiro (4,74 m²)',
    'Quarto (9,00 m²) e banheiro social (3,05 m²)',
    'Garagem coberta (22,27 m²)',
    'Fachada com fitas de LED e muro com faixa decorativa',
  ],
  /** Valor de venda de cada casa (as duas unidades têm o mesmo preço). */
  price: 'R$ 469.000,00',
  priceNote: 'cada casa',
  contact: {
    label: 'Fale conosco pelo WhatsApp',
    /** (27) 99716-4677, no formato internacional exigido pelo wa.me */
    whatsapp: '5527997164677',
    message: 'Olá! Vi a visita virtual das Casas Joceandro Xavier e gostaria de mais informações.',
  },
  disclaimer:
    'Imagens e acabamentos são simulações para fins de apresentação. A disponibilidade de materiais, cores e itens de decoração deve ser confirmada comercialmente. Mobiliário e paisagismo são ilustrativos.',
};

/** Link que abre a conversa no WhatsApp com a mensagem inicial já preenchida. */
export const whatsappUrl = () =>
  `https://wa.me/${PROJECT.contact.whatsapp}?text=${encodeURIComponent(PROJECT.contact.message)}`;
