import type { NextApiRequest, NextApiResponse } from 'next';
  import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
  import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
  import { PedidoModel, IPedido } from '../../../lib/models/PedidoModel';
  import { ProdutoModel } from '../../../lib/models/ProdutoModel';
  import { MercadoPagoConfig, Payment } from 'mercadopago';
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
        console.log('Webhook recebido:', req.body);
        const { topic, id } = req.body;

        if (topic !== 'payment') {
          return res.status(400).json({ erro: 'Notificação inválida' });
        }

        let payment;
        try {
          payment = await paymentClient.get({ id: Number(id) });
        } catch (e) {
          console.error('Erro ao buscar pagamento:', e);
          return res.status(400).json({ erro: 'Pagamento não encontrado ou inválido' });
        }

        if (payment.status !== 'approved') {
          return res.status(400).json({ erro: `Pagamento não aprovado: status ${payment.status}` });
        }

        console.log('Pagamento encontrado:', payment);
        const pedidoId = payment.external_reference;
        if (!pedidoId) {
          return res.status(400).json({ erro: 'ID do pedido não encontrado em external_reference' });
        }

        const pedido = await Promise.race([
          PedidoModel.findById(pedidoId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do pedido')), 10000)),
        ]) as IPedido | null;

        if (!pedido) {
          return res.status(404).json({ erro: 'Pedido não encontrado' });
        }

        if (pedido.status === 'aprovado') {
          return res.status(400).json({ erro: 'Pedido já está aprovado' });
        }

        await Promise.race([
          PedidoModel.updateOne({ _id: pedidoId }, { status: 'aprovado' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar pedido')), 10000)),
        ]);

        for (const item of pedido.produtos) {
          const produto = await Promise.race([
            ProdutoModel.findById(item.produtoId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do produto')), 10000)),
          ]);

          if (produto) {
            const estoqueAntigo = produto.estoque;
            produto.estoque = Math.max(0, produto.estoque - item.quantidade);
            console.log(`Produto ${item.produtoId}: Estoque antigo ${estoqueAntigo}, novo ${produto.estoque}`);
            await Promise.race([
              ProdutoModel.updateOne({ _id: item.produtoId }, { estoque: produto.estoque }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar estoque')), 10000)),
            ]);
          } else {
            console.log(`Produto ${item.produtoId} não encontrado`);
          }
        }

        return res.status(200).json({ msg: 'Status do pedido atualizado e estoque diminuído com sucesso' });
      } catch (e) {
        console.error('Erro ao processar webhook:', e);
        return res.status(500).json({ erro: 'Erro ao processar webhook: ' + (e instanceof Error ? e.message : e) });
      }
    });

  export default politicaCORS(conectarMongoDB(handler));