import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import type { RespostaPadraoMsg } from '../types/RespostaPadraoMsg';

export const politicaCORS = (handler: NextApiHandler) => 
  async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };