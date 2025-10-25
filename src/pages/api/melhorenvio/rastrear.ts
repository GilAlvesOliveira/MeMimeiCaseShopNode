import type { NextApiRequest, NextApiResponse } from 'next';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';

type Resposta = { erro?: string } | any;

interface AuthedReq extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

/**
 * POST /api/melhorenvio/rastrear
 * Body: { "orders": ["<idEtiqueta>"] }
 * Implementa POST {BASE}/api/v2/me/shipment/tracking
 * Retorna status/ciclo de vida da etiqueta. :contentReference[oaicite:5]{index=5}
 */
async function handler(req: AuthedReq, res: NextApiResponse<Resposta>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' });
  }
  if (!req.user) {
    return res.status(401).json({ erro: 'Usuário não autenticado' });
  }

  try {
    const BASE = process.env.MELHOR_ENVIO_BASE_URL || 'https://sandbox.melhorenvio.com.br';
    const TOKEN = process.env.MELHOR_ENVIO_TOKEN;
    if (!TOKEN) return res.status(500).json({ erro: 'MELHOR_ENVIO_TOKEN não configurado' });

    const { orders } = req.body || {};
    const list = Array.isArray(orders) ? orders : [];
    if (list.length === 0) {
      return res.status(400).json({ erro: 'Informe "orders": [ids]' });
    }

    const resp = await fetch(`${BASE}/api/v2/me/shipment/tracking`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orders: list }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({ erro: data?.message || 'Falha ao rastrear etiqueta' });
    }
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ erro: 'Erro ao rastrear: ' + (e?.message || e) });
  }
}

export default politicaCORS(autenticar(conectarMongoDB(handler)));
