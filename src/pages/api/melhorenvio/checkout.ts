import type { NextApiRequest, NextApiResponse } from 'next';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';

type Resposta = { erro?: string } | any;

interface AuthedReq extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

/**
 * POST /api/melhorenvio/checkout
 *
 * Fluxo:
 * 1) Inserir no carrinho: POST {BASE}/api/v2/me/cart  (retorna id da etiqueta no carrinho)
 * 2) Comprar etiqueta:    POST {BASE}/api/v2/me/shipment/checkout (exige saldo em carteira)
 * 3) Gerar etiqueta:      POST {BASE}/api/v2/me/shipment/generate
 * 4) Link de impressão:   POST {BASE}/api/v2/me/shipment/print  (mode:"public" opcional)
 *
 * Requer ADMIN (evitar uso do token no cliente).
 * Documentação oficial das etapas (carrinho/compra/geração/impressão). :contentReference[oaicite:4]{index=4}
 *
 * Body esperado (exemplo):
 * {
 *   "service_id": 1,
 *   "agency_id": null,          // opcional/alguns casos obrigatório com token do painel
 *   "from": {
 *     "name": "Loja X", "phone":"...", "email":"...", "document":"...", "company_document":null,
 *     "address":"Rua A", "complement": "", "number":"100", "district":"Centro",
 *     "postal_code":"01002001", "city":"São Paulo", "state_abbr":"SP"
 *   },
 *   "to": {
 *     "name": "Cliente Y", "phone":"...", "email":"...", "document":"...",
 *     "address":"Av B", "complement":"", "number":"200", "district":"Bairro",
 *     "postal_code":"90570020", "city":"Porto Alegre", "state_abbr":"RS"
 *   },
 *   "volumes": [{ "height":4, "width":12, "length":17, "weight":0.3 }],
 *   "options": {
 *     "insurance_value": 1180.87,
 *     "receipt": false, "own_hand": false,
 *     "non_commercial": true,    // true = usa declaração de conteúdo; false = exige options.invoice.key
 *     "invoice": { "key": "" },
 *     "platform": "MemimeiCaseShop",
 *     "tags": [{ "tag": "PEDIDO-123", "url": "https://sua-loja/pedido/123" }]
 *   },
 *   "products": [
 *     { "id":"sku-abc", "quantity":1 }
 *   ],
 *   "printPublic": true
 * }
 */
async function handler(req: AuthedReq, res: NextApiResponse<Resposta>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' });
  }

  // só admin dispara compra/geração/impressão
  if (!req.user || String(req.user.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
  }

  const BASE = process.env.MELHOR_ENVIO_BASE_URL || 'https://sandbox.melhorenvio.com.br';
  const TOKEN = process.env.MELHOR_ENVIO_TOKEN;
  const PLATFORM = process.env.MELHOR_ENVIO_PLATFORM_NAME || 'MemimeiCaseShop';
  const DEFAULT_AGENCY = process.env.MELHOR_ENVIO_DEFAULT_AGENCY_ID || undefined;

  if (!TOKEN) return res.status(500).json({ erro: 'MELHOR_ENVIO_TOKEN não configurado' });

  try {
    const {
      service_id,
      agency_id,
      from,
      to,
      volumes = [],
      options = {},
      products = [],
      printPublic = true,
    } = req.body || {};

    if (!service_id || !from?.postal_code || !to?.postal_code || !Array.isArray(volumes) || volumes.length === 0) {
      return res.status(400).json({ erro: 'Dados obrigatórios ausentes para criar o envio' });
    }

    // 1) Inserir no carrinho
    const cartBody: any = {
      service: String(service_id),
      agency: agency_id ?? DEFAULT_AGENCY ?? null,
      from,
      to,
      volumes: volumes.map((v: any) => ({
        height: Number(v.height),
        width: Number(v.width),
        length: Number(v.length),
        weight: Number(v.weight),
      })),
      options: {
        platform: options.platform || PLATFORM,
        insurance_value: Number(options.insurance_value || 0) || 0,
        receipt: !!options.receipt,
        own_hand: !!options.own_hand,
        reverse: !!options.reverse,
        non_commercial: options.non_commercial !== false, // default true para evitar exigir chave NF
        invoice: options.invoice || undefined,
        tags: Array.isArray(options.tags) ? options.tags : undefined,
      },
      products: Array.isArray(products) ? products : undefined,
    };

    const step1 = await fetch(`${BASE}/api/v2/me/cart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(cartBody),
    });
    const cartData = await step1.json().catch(() => ({}));
    if (!step1.ok) {
      return res.status(step1.status).json({ erro: cartData?.message || 'Falha ao inserir no carrinho' });
    }
    // resposta inclui id da etiqueta no carrinho
    const orderId = cartData?.id || cartData?.data?.id;
    if (!orderId) return res.status(500).json({ erro: 'ID da etiqueta não retornado pelo carrinho' });

    // 2) Comprar etiqueta (exige saldo em carteira)
    const step2 = await fetch(`${BASE}/api/v2/me/shipment/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orders: [orderId] }),
    });
    const checkoutData = await step2.json().catch(() => ({}));
    if (!step2.ok) {
      return res.status(step2.status).json({ erro: checkoutData?.message || 'Falha ao comprar etiqueta (saldo?)' });
    }

    // 3) Gerar etiqueta
    const step3 = await fetch(`${BASE}/api/v2/me/shipment/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orders: [orderId] }),
    });
    const genData = await step3.json().catch(() => ({}));
    if (!step3.ok) {
      return res.status(step3.status).json({ erro: genData?.message || 'Falha ao gerar etiqueta' });
    }

    // 4) Link de impressão (público por padrão)
    const printBody = { orders: [orderId], ...(printPublic ? { mode: 'public' } : {}) };
    const step4 = await fetch(`${BASE}/api/v2/me/shipment/print`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(printBody),
    });
    const printData = await step4.json().catch(() => ({}));
    if (!step4.ok) {
      return res.status(step4.status).json({ erro: printData?.message || 'Falha ao obter link de impressão' });
    }

    // Normaliza uma resposta útil
    return res.status(200).json({
      msg: 'Etiqueta comprada, gerada e pronta para impressão',
      orderId,
      checkout: checkoutData,
      generate: genData,
      print: printData, // geralmente contém url(s)
    });
  } catch (e: any) {
    return res.status(500).json({ erro: 'Erro no checkout do Melhor Envio: ' + (e?.message || e) });
  }
}

export default politicaCORS(autenticar(conectarMongoDB(handler)));
