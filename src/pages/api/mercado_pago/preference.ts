import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

// Estender o tipo NextApiRequest para incluir req.user
interface CustomNextApiRequest extends NextApiRequest {
  user?: { email: string; id: string };
}

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

const preferenceClient = new Preference(client);

const handler = nc()
  .post(async (req: CustomNextApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      const { total, pedidoId } = req.body;

      if (!total || !pedidoId) {
        return res.status(400).json({ erro: 'Total e pedidoId são obrigatórios' });
      }

      // E-mail do pagador (do usuário logado, vindo do middleware)
      const email = req.user?.email || req.body.email;
      if (!email) {
        return res.status(400).json({ erro: 'Email do usuário não encontrado' });
      }

      // Base pública do frontend/backend para montar URLs de retorno e webhook
      const baseUrl = (process.env.NEXT_PUBLIC_URL || '').replace(/\/$/, '');
      if (!baseUrl) {
        return res.status(500).json({ erro: 'NEXT_PUBLIC_URL não configurado' });
      }

      // Preferência de pagamento (Checkout Pro) com o ID do pedido como query param
      const preferenceData = {
        body: {
          items: [
            {
              id: String(pedidoId),
              title: `Pedido #${pedidoId}`,
              unit_price: Number(total),
              quantity: 1,
              currency_id: 'BRL',
            },
          ],
          payer: { email },
          external_reference: String(pedidoId), // usado no webhook para identificar o pedido
          auto_return: 'approved',
          back_urls: {
            success: `${baseUrl}/sucesso?pedido=${encodeURIComponent(String(pedidoId))}`,
            failure: `${baseUrl}/falha?pedido=${encodeURIComponent(String(pedidoId))}`,
            pending: `${baseUrl}/pendente?pedido=${encodeURIComponent(String(pedidoId))}`,
          },
          notification_url: `${baseUrl}/api/webhooks/pagamento`,
        },
      };

      const preference = await preferenceClient.create(preferenceData);

      if (!preference.init_point) {
        return res.status(500).json({ erro: 'Erro ao gerar preferência de pagamento' });
      }

      return res.status(200).json({
        initPoint: preference.init_point,
        preferenceId: preference.id,
      });
    } catch (e) {
      console.error('Erro ao criar preferência de pagamento:', e);
      return res.status(500).json({
        erro: 'Erro ao criar preferência de pagamento: ' + (e instanceof Error ? e.message : e),
      });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));
