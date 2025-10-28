import mongoose, { Schema, Document } from 'mongoose';

export interface IProduto extends Document {
  _id: mongoose.Types.ObjectId; // Explicitamente definir _id como ObjectId
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  imagem?: string;
  categoria: string;
  cor: string;
  modelo: string;
  peso?: number; // Peso do produto (em kg)
  largura?: number; // Largura do produto (em cm)
  altura?: number; // Altura do produto (em cm)
  comprimento?: number; // Comprimento do produto (em cm)
}

const ProdutoSchema = new Schema<IProduto>({
  nome: { type: String, required: true },
  descricao: { type: String, required: true },
  preco: { type: Number, required: true },
  estoque: { type: Number, required: true },
  imagem: { type: String },
  categoria: { type: String, required: true },
  cor: { type: String, required: true },
  modelo: { type: String, required: true },
  peso: { type: Number }, // Novo campo peso
  largura: { type: Number }, // Novo campo largura
  altura: { type: Number }, // Novo campo altura
  comprimento: { type: Number }, // Novo campo comprimento
});

export const ProdutoModel = mongoose.models.Produto || mongoose.model<IProduto>('produtos', ProdutoSchema);
