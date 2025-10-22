// src/pages/api/webhooks/pagamento.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { PedidoModel, IPedido } from '../../../lib/models/PedidoModel';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';
import crypto from 'crypto';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

const paymentClient = new Payment(client);

// (Opcional) validação de assinatura — configure MP_WEBHOOK_SECRET no painel do MP
function isValidSignature(req: NextApiRequest, paymentId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];

  if (!secret || !signatureHeader || !requestId) return true; // sem validação se não configurado

  try {
    const sig = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const [tsPart, v1Part] = sig.split(',');
    const ts = tsPart.replace('ts=', '');
    const v1 = v1Part.replace('v1=', '');

    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return v1 === calc;
  } catch {
    return false;
  }
}

const handler = nc()
  .post(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      // Tenta ler nos formatos possíveis
      // Novo (webhook padrão): { type: 'payment', data: { id } }
      let tipo: string | undefined =
        (req.body && req.body.type) ||
        (req.body && req.body.topic) ||
        (typeof req.query?.topic === 'string' ? req.query.topic : undefined);

      let paymentId: string | undefined =
        (req.body && req.body.data?.id) ||
        (req.body && req.body.id) ||
        (typeof req.query?.id === 'string' ? req.query.id : undefined);

      if (!tipo || !paymentId) {
        console.log('Webhook inválido. Body:', req.body, 'Query:', req.query);
        return res.status(400).json({ erro: 'Notificação inválida' });
      }

      // Aceita "payment" (type) ou "payment" (topic)
      if (String(tipo).toLowerCase() !== 'payment') {
        return res.status(400).json({ erro: 'Tipo de notificação não suportado' });
      }

      // (opcional) valida a assinatura se MP_WEBHOOK_SECRET estiver configurada
      if (!isValidSignature(req, String(paymentId))) {
        return res.status(401).json({ erro: 'Assinatura inválida' });
      }

      // Busca o pagamento no MP
      let payment;
      try {
        payment = await paymentClient.get({ id: Number(paymentId) });
      } catch (e) {
        console.error('Erro ao buscar pagamento:', e);
        return res.status(400).json({ erro: 'Pagamento não encontrado ou inválido' });
      }

      if (payment.status !== 'approved') {
        // Você pode tratar outros status aqui se quiser (rejected, pending, etc)
        return res.status(200).json({ msg: `Ignorado: status ${payment.status}` });
      }

      const pedidoId = payment.external_reference;
      if (!pedidoId) {
        return res.status(400).json({ erro: 'external_reference ausente no pagamento' });
      }

      const pedido = await PedidoModel.findById(pedidoId) as IPedido | null;
      if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
      }

      if (pedido.status === 'aprovado') {
        // idempotência: já está aprovado
        return res.status(200).json({ msg: 'Pedido já estava aprovado' });
      }

      // Atualiza status do pedido
      await PedidoModel.updateOne({ _id: pedidoId }, { status: 'aprovado' });

      // Diminui estoque dos itens do pedido
      for (const item of pedido.produtos) {
        const produto = await ProdutoModel.findById(item.produtoId);
        if (produto) {
          const novoEstoque = Math.max(0, (produto.estoque || 0) - (item.quantidade || 0));
          await ProdutoModel.updateOne({ _id: item.produtoId }, { estoque: novoEstoque });
        }
      }

      return res.status(200).json({ msg: 'Status do pedido atualizado e estoque diminuído com sucesso' });
    } catch (e) {
      console.error('Erro ao processar webhook:', e);
      return res.status(500).json({ erro: 'Erro ao processar webhook: ' + (e instanceof Error ? e.message : e) });
    }
  });

export default politicaCORS(conectarMongoDB(handler));
