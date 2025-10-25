import type { NextApiRequest, NextApiResponse } from 'next';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';
import { autenticar } from '../../../lib/middlewares/autenticar';

type Resposta = { erro?: string } | any;

interface AuthedReq extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

/**
 * POST /api/melhorenvio/cotacao
 * Body:
 * {
 *   "toPostalCode": "90570020",
 *   "package": { "height": 4, "width": 12, "length": 17, "weight": 0.3 },
 *   "insuranceValue": 1180.87,
 *   "services": "1,2,3,4,7,11",  // opcional
 *   "receipt": false,
 *   "own_hand": false
 * }
 */
async function handler(req: AuthedReq, res: NextApiResponse<Resposta>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' });
  }

  try {
    const BASE = process.env.MELHOR_ENVIO_BASE_URL || 'https://sandbox.melhorenvio.com.br';
    const TOKEN = process.env.MELHOR_ENVIO_TOKEN;
    const FROM_POSTAL = (process.env.MELHOR_ENVIO_FROM_POSTAL_CODE || '').replace(/\D/g, '');

    if (!TOKEN) return res.status(500).json({ erro: 'MELHOR_ENVIO_TOKEN não configurado' });
    if (!FROM_POSTAL) return res.status(500).json({ erro: 'MELHOR_ENVIO_FROM_POSTAL_CODE não configurado' });

    const {
      toPostalCode,
      package: pack,
      insuranceValue,
      services,
      receipt = false,
      own_hand = false,
    } = req.body || {};

    if (!toPostalCode || !pack?.height || !pack?.width || !pack?.length || !pack?.weight) {
      return res.status(400).json({ erro: 'Parâmetros inválidos para cotação' });
    }

    const body: any = {
      from: { postal_code: String(FROM_POSTAL) },
      to: { postal_code: String(toPostalCode).replace(/\D/g, '') },
      package: {
        height: Number(pack.height),
        width: Number(pack.width),
        length: Number(pack.length),
        weight: Number(pack.weight),
      },
      options: {
        insurance_value: Number(insuranceValue || 0) || 0,
        receipt: !!receipt,
        own_hand: !!own_hand,
      },
    };
    if (services && typeof services === 'string') {
      body.services = services;
    }

    const resp = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({ erro: data?.message || 'Falha na cotação de frete' });
    }

    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ erro: 'Erro ao cotar frete: ' + (e?.message || e) });
  }
}

export default politicaCORS(autenticar(conectarMongoDB(handler)));
