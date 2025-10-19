import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { CarrinhoModel } from '../../../lib/models/CarrinhoModel';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

// Estender NextApiRequest para incluir user
interface CarrinhoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

const handler = nc()
  .delete(async (req: CarrinhoApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user) {
        console.log('req.user não definido'); // Log para depuração
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      const { produtoId } = req.body;
      console.log('DELETE /api/carrinho/item:', { usuarioId: req.user.id, produtoId }); // Log para depuração

      // Valida o produtoId
      if (!produtoId || typeof produtoId !== 'string') {
        return res.status(400).json({ erro: 'ID do produto inválido' });
      }

      // Busca o carrinho do usuário
      const carrinho = await Promise.race([
        CarrinhoModel.findOne({ usuarioId: req.user.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do carrinho')), 10000)),
      ]);

      if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
      }

      // Verifica se o produto está no carrinho
      const produtoIndex = carrinho.produtos.findIndex((p: any) => p.produtoId === produtoId);
      if (produtoIndex === -1) {
        return res.status(404).json({ erro: 'Produto não encontrado no carrinho' });
      }

      // Reduz a quantidade em 1
      carrinho.produtos[produtoIndex].quantidade -= 1;

      // Remove o produto se a quantidade for 0
      if (carrinho.produtos[produtoIndex].quantidade <= 0) {
        carrinho.produtos.splice(produtoIndex, 1);
      }

      // Atualiza o carrinho no MongoDB
      await Promise.race([
        CarrinhoModel.updateOne({ _id: carrinho._id }, { produtos: carrinho.produtos }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar carrinho')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Produto atualizado ou removido do carrinho com sucesso' });
    } catch (e) {
      console.error('Erro ao atualizar/remover produto do carrinho:', e); // Log para depuração
      return res.status(500).json({ erro: 'Erro ao atualizar/remover produto do carrinho: ' + e });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));