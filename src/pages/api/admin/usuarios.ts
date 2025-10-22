import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { UsuarioModel } from '../../../lib/models/UsuarioModel';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

interface AuthedRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

const handler = nc()
  .get(async (req: AuthedRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado' });
      }

      const { ids } = req.query;
      const list = typeof ids === 'string' && ids.trim().length
        ? ids.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const filtro = list.length ? { _id: { $in: list } } : {};

      const usuarios = await UsuarioModel.find(
        filtro,
        { nome: 1, email: 1, avatar: 1, telefone: 1, endereco: 1 }
      ).limit(500);

      return res.status(200).json(usuarios);
    } catch (e) {
      console.error('Erro /api/admin/usuarios:', e);
      return res.status(500).json({ erro: 'Erro ao listar usuários' });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));
