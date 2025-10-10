import mongoose, { Schema, Document } from 'mongoose';

export interface IProduto extends Document {
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  imagem?: string;
  categoria: string;
  cor: string;
  modelo: string;
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
});

export const ProdutoModel = mongoose.models.Produto || mongoose.model<IProduto>('Produto', ProdutoSchema);