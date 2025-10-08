import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import mongoose from 'mongoose';
import type { RespostaPadraoMsg } from '../types/RespostaPadraoMsg';

export const conectarMongoDB = (handler: NextApiHandler) => 
  async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    if (mongoose.connections[0].readyState) {
      return handler(req, res);
    }

    const { MONGO_URI } = process.env;
    if (!MONGO_URI) {
      return res.status(500).json({ erro: 'MONGO_URI não configurado' });
    }

    try {
      await mongoose.connect(MONGO_URI);
      console.log('Conectado ao MongoDB');
      return handler(req, res);
    } catch (e) {
      console.log(e);
      return res.status(500).json({ erro: 'Erro ao conectar ao MongoDB' });
    }
  };