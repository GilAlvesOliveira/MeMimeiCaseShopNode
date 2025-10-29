import mongoose from 'mongoose';

export interface IPedido extends mongoose.Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number; precoUnitario: number; _id?: string }[];
  total: number;
  frete: number;             // Novo campo de frete
  status: string;            // 'pendente' | 'aprovado' | 'cancelado' 
  criadoEm: Date;
  paymentId?: string;
  enviado?: boolean;         // Status de envio
  enviadoEm?: Date | null;   // Quando foi marcado como enviado
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
  frete: { type: Number, required: true, default: 0 }, // Novo campo para frete
  status: { 
    type: String, 
    default: 'pendente', 
    enum: ['pendente', 'aprovado', 'cancelado'] 
  },
  criadoEm: { type: Date, default: Date.now },
  paymentId: { type: String, default: null },
  
  // NOVOS CAMPOS
  enviado: { type: Boolean, default: false },
  enviadoEm: { type: Date, default: null },
});

PedidoSchema.pre('save', function (next) {
  const currentDate = new Date();
  // Se o pedido tiver mais de 24 horas e o status for 'pendente', marque como 'cancelado'
  if (this.status === 'pendente' && (currentDate.getTime() - this.criadoEm.getTime()) > 24 * 60 * 60 * 1000) {
    this.status = 'cancelado';
  }
  next();
});

export const PedidoModel =
  (mongoose.models.Pedidos as mongoose.Model<IPedido>) ||
  mongoose.model<IPedido>('Pedidos', PedidoSchema);
