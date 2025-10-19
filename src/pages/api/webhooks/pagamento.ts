import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { PedidoModel, IPedido } from '../../../lib/models/PedidoModel';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import { MercadoPagoConfig,  Payment} from 'mercadopago';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

const paymentClient = new Payment(client);

const handler = nc()
  .post(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      const { topic, id } = req.body;

      if (topic !== 'payment') {
        return res.status(400).json({ erro: 'Notificação inválida' });
      }

      // Verificar o pagamento no Mercado Pago
      const payment = await paymentClient.get({ id: Number(id) });
      if (payment.status !== 'approved') {
        return res.status(400).json({ erro: `Pagamento não aprovado: status ${payment.status}` });
      }

      // Extrair o pedidoId de external_reference
      const pedidoId = payment.external_reference;
      if (!pedidoId) {
        return res.status(400).json({ erro: 'ID do pedido não encontrado em external_reference' });
      }

      // Buscar o pedido
      const pedido = await Promise.race([
        PedidoModel.findById(pedidoId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do pedido')), 10000)),
      ]) as IPedido | null;

      if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
      }

      // Verificar se o pedido já está aprovado para evitar diminuição duplicada do estoque
      if (pedido.status === 'aprovado') {
        return res.status(400).json({ erro: 'Pedido já está aprovado' });
      }

      // Atualizar status do pedido para "aprovado"
      await Promise.race([
        PedidoModel.updateOne({ _id: pedidoId }, { status: 'aprovado' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar pedido')), 10000)),
      ]);

      // Diminuir o estoque dos produtos
      for (const item of pedido.produtos) {
        const produto = await Promise.race([
          ProdutoModel.findById(item.produtoId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do produto')), 10000)),
        ]);

        if (produto) {
          produto.estoque = Math.max(0, produto.estoque - item.quantidade); // Evita estoque negativo
          await Promise.race([
            ProdutoModel.updateOne({ _id: item.produtoId }, { estoque: produto.estoque }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar estoque')), 10000)),
          ]);
        }
      }

      return res.status(200).json({ msg: 'Status do pedido atualizado e estoque diminuído com sucesso' });
    } catch (e) {
      console.error('Erro ao processar webhook:', e);
      return res.status(500).json({ erro: 'Erro ao processar webhook: ' + (e instanceof Error ? e.message : e) });
    }
  });

export default politicaCORS(conectarMongoDB(handler));