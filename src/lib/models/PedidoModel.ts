import mongoose from 'mongoose';

export interface IPedido extends mongoose.Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number; precoUnitario: number; _id?: string }[];
  total: number;
  status: string;           // 'pendente' | 'aprovado' (pagamento)
  criadoEm: Date;
  paymentId?: string;
  enviado?: boolean;
  enviadoEm?: Date | null;

  // ===== Frete (NOVO) =====
  freteValor?: number;       // valor do frete somado ao total
  freteServicoId?: string;   // id do serviço escolhido no Melhor Envio
  freteNome?: string;        // nome do serviço (ex.: "PAC", "Jadlog XPRESS", etc)
  freteEmpresa?: string;     // transportadora (ex.: "Correios", "Jadlog")
  fretePrazo?: number;       // prazo estimado em dias
  destinoCEP?: string;       // CEP destino usado no cálculo
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

  enviado: { type: Boolean, default: false },
  enviadoEm: { type: Date, default: null },

  // ===== Frete (NOVO) =====
  freteValor: { type: Number, default: 0 },
  freteServicoId: { type: String, default: null },
  freteNome: { type: String, default: null },
  freteEmpresa: { type: String, default: null },
  fretePrazo: { type: Number, default: null },
  destinoCEP: { type: String, default: null },
});

export const PedidoModel =
  (mongoose.models.Pedidos as mongoose.Model<IPedido>) ||
  mongoose.model<IPedido>('Pedidos', PedidoSchema);
