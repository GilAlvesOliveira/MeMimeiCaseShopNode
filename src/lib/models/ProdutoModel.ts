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
  peso: number;              // Novo campo peso
  largura: number;           // Novo campo largura
  altura: number;            // Novo campo altura
  comprimento: number;       // Novo campo comprimento
  frete?: number;            // Caso queira salvar o frete calculado aqui
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
  peso: { type: Number, required: true },  // Campo obrigatório
  largura: { type: Number, required: true }, // Campo obrigatório
  altura: { type: Number, required: true },  // Campo obrigatório
  comprimento: { type: Number, required: true }, // Campo obrigatório
  frete: { type: Number }, // Novo campo para armazenar o valor do frete (se desejado)
});

export const ProdutoModel = mongoose.models.Produto || mongoose.model<IProduto>('produtos', ProdutoSchema);
