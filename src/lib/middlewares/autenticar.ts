import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import type { RespostaPadraoMsg } from '../types/RespostaPadraoMsg';

// Estender NextApiRequest para incluir a propriedade user
interface AutenticarApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

export const autenticar = (handler: any) => {
  return async (req: AutenticarApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string;
        email: string;
        role: string;
      };
      req.user = decoded; // Adiciona o usuário decodificado ao req
      return handler(req, res);
    } catch (e) {
      return res.status(401).json({ erro: 'Token inválido' });
    }
  };
};