import mongoose, { Schema, Document } from 'mongoose';

export interface ICarrinho extends Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number }[];
}

const CarrinhoSchema = new Schema<ICarrinho>({
  usuarioId: { type: String, required: true, unique: true },
  produtos: [
    {
      produtoId: { type: String, required: true },
      quantidade: { type: Number, required: true, min: 1 },
    },
  ],
});

export const CarrinhoModel = mongoose.models.Carrinho || mongoose.model<ICarrinho>('carrinhos', CarrinhoSchema);