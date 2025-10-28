export interface ProdutoRequisicao {
  nome?: string;
  descricao?: string;
  preco?: number;
  estoque?: number;
  categoria?: string;
  cor?: string;
  modelo?: string;
  peso?: number;         // Peso do produto (em kg)
  largura?: number;      // Largura do produto (em cm)
  altura?: number;       // Altura do produto (em cm)
  comprimento?: number;  // Comprimento do produto (em cm)
}