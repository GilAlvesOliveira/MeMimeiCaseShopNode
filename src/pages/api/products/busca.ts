import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

const handler = nc()
  .get(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      // Extrai o termo de busca da query string (?q=termo)
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.trim().length < 1) {
        // Validação: o termo deve ser uma string não vazia
        return res.status(400).json({ erro: 'Termo de busca inválido' });
      }

      // Converte o termo para minúsculas para busca case-insensitive
      const term = q.toLowerCase();

      // Busca no MongoDB usando $or para múltiplos campos e $regex com opção 'i' para ignorar maiúsculas/minúsculas
      const produtos = await Promise.race([
        ProdutoModel.find({
          $or: [
            { cor: { $regex: term, $options: 'i' } },
            { categoria: { $regex: term, $options: 'i' } },
            { descricao: { $regex: term, $options: 'i' } },
          ],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca de produtos')), 10000)),
      ]);

      // Retorna a lista de produtos encontrados
      return res.status(200).json(produtos);
    } catch (e) {
      // Tratamento de erro: retorna 500 se algo der errado (ex.: erro no MongoDB)
      console.error('Erro ao buscar produtos:', e);
      return res.status(500).json({ erro: 'Erro ao buscar produtos' });
    }
  });

export default politicaCORS(conectarMongoDB(handler));