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

      // Obter o email do usuário a partir do middleware de autenticação
      const email = req.user?.email || req.body.email; // Fallback para teste
      if (!email) {
        return res.status(400).json({ erro: 'Email do usuário não encontrado' });
      }

      // Criar preferência de pagamento com Checkout Pro
      const preferenceData = {
        body: {
          items: [
            {
              id: `${pedidoId}`,
              title: `Pedido #${pedidoId}`,
              unit_price: Number(total),
              quantity: 1,
              currency_id: 'BRL',
            },
          ],
          payer: { email },
          external_reference: pedidoId, // Para rastreamento no webhook
          auto_return: 'approved', // Redireciona após aprovação
          back_urls: {
            success: `${process.env.NEXT_PUBLIC_URL}/sucesso`, // URL de sucesso (ajuste conforme necessário)
            failure: `${process.env.NEXT_PUBLIC_URL}/falha`, // URL de falha
            pending: `${process.env.NEXT_PUBLIC_URL}/pendente`, // URL de pendente
          },
          notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhooks/pagamento`, // Webhook
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
      return res.status(500).json({ erro: 'Erro ao criar preferência de pagamento: ' + (e instanceof Error ? e.message : e) });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));