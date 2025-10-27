import mongoose from 'mongoose';

export interface IPedido extends mongoose.Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number; precoUnitario: number; _id?: string }[];
  total: number;
  status: string;           // 'pendente' | 'aprovado' (pagamento)
  criadoEm: Date;
  paymentId?: string;
  enviado?: boolean;        // <-- NOVO: status de envio
  enviadoEm?: Date | null;  // <-- NOVO: quando foi marcado enviado
}

const PedidoSchema = new mongoose.Schema({
  usuarioId: { type: String, required: true },
  produtos: [
    {
      produtoId: { type: String, required: true },
      quantidade: { type: Number, required: true },
      precoUnitario: { type: Number, required: true },
      _id: false,
    },
  ],
  total: { type: Number, required: true },
  status: { type: String, default: 'pendente' }, // pagamento
  criadoEm: { type: Date, default: Date.now },
  paymentId: { type: String, default: null },

  // NOVOS CAMPOS
  enviado: { type: Boolean, default: false },
  enviadoEm: { type: Date, default: null },
});

export const PedidoModel =
  (mongoose.models.Pedidos as mongoose.Model<IPedido>) ||
  mongoose.model<IPedido>('Pedidos', PedidoSchema);
