import mongoose, { Schema, Document } from 'mongoose';

export interface IPedido extends Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number; precoUnitario: number }[];
  total: number;
  status: string;
  pixCode?: string;
  pixQrCode?: string;
  criadoEm: Date;
}

const PedidoSchema = new Schema<IPedido>({
  usuarioId: { type: String, required: true },
  produtos: [
    {
      produtoId: { type: String, required: true },
      quantidade: { type: Number, required: true },
      precoUnitario: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  status: { type: String, required: true, default: 'pendente' },
  pixCode: { type: String },
  pixQrCode: { type: String },
  criadoEm: { type: Date, default: Date.now },
});

export const PedidoModel = mongoose.models.Pedido || mongoose.model<IPedido>('pedidos', PedidoSchema);