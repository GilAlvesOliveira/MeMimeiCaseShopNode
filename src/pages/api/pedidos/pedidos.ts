import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { CarrinhoModel, ICarrinho } from '../../../lib/models/CarrinhoModel';
import { ProdutoModel, IProduto } from '../../../lib/models/ProdutoModel';
import mongoose from 'mongoose';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

// Estender NextApiRequest para incluir user
interface PedidoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

// Interface do Pedido
export interface IPedido extends mongoose.Document {
  usuarioId: string;
  produtos: { produtoId: string; quantidade: number; precoUnitario: number }[];
  total: number;
  status: string;
  criadoEm: Date;
}

const PedidoSchema = new mongoose.Schema<IPedido>({
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
  criadoEm: { type: Date, default: Date.now },
});

export const PedidoModel = mongoose.models.Pedido || mongoose.model<IPedido>('pedidos', PedidoSchema);

const handler = nc()
  .post(async (req: PedidoApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      if (!req.user) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      const carrinho = await Promise.race([
        CarrinhoModel.findOne({ usuarioId: req.user.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do carrinho')), 10000)),
      ]) as ICarrinho | null;

      if (!carrinho || carrinho.produtos.length === 0) {
        return res.status(400).json({ erro: 'Carrinho vazio' });
      }

      const produtos = await Promise.race([
        ProdutoModel.find({ _id: { $in: carrinho.produtos.map(p => p.produtoId) } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca dos produtos')), 10000)),
      ]) as IProduto[];

      const pedido = {
        usuarioId: req.user.id,
        produtos: carrinho.produtos.map((p: { produtoId: string; quantidade: number }) => {
          const produto = produtos.find((prod: IProduto) => prod._id.toString() === p.produtoId);
          return {
            produtoId: p.produtoId,
            quantidade: p.quantidade,
            precoUnitario: produto?.preco || 0,
          };
        }),
        total: carrinho.produtos.reduce((sum: number, p: { produtoId: string; quantidade: number }) => {
          const produto = produtos.find((prod: IProduto) => prod._id.toString() === p.produtoId);
          return sum + (produto?.preco || 0) * p.quantidade;
        }, 0),
        status: 'pendente',
        criadoEm: new Date(),
      };

      const novoPedido = await Promise.race([
        PedidoModel.create(pedido),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao criar pedido')), 10000)),
      ]) as IPedido;

      // Limpa o carrinho após criar o pedido
      await Promise.race([
        CarrinhoModel.updateOne({ _id: carrinho._id }, { produtos: [] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao limpar carrinho')), 10000)),
      ]);

      return res.status(200).json({
        msg: 'Pedido criado com sucesso',
        pedidoId: novoPedido._id,
        total: pedido.total,
      });
    } catch (e) {
      console.error('Erro ao criar pedido:', e);
      return res.status(500).json({ erro: 'Erro ao criar pedido: ' + (e instanceof Error ? e.message : e) });
    }
  })
  .get(async (req: PedidoApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      if (!req.user) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      let pedidos;
      if (req.user.role === 'admin') {
        // Admins veem todos os pedidos
        pedidos = await Promise.race([
          PedidoModel.find({}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca de pedidos')), 10000)),
        ]) as IPedido[];
      } else {
        // Clientes veem apenas seus próprios pedidos
        pedidos = await Promise.race([
          PedidoModel.find({ usuarioId: req.user.id }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca de pedidos')), 10000)),
        ]) as IPedido[];
      }

      return res.status(200).json(pedidos);
    } catch (e) {
      console.error('Erro ao listar pedidos:', e);
      return res.status(500).json({ erro: 'Erro ao listar pedidos: ' + (e instanceof Error ? e.message : e) });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));