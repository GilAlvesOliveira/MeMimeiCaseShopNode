import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { CarrinhoModel } from '../../../lib/models/CarrinhoModel';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import type { IProduto } from '../../../lib/models/ProdutoModel';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';
import type { ICarrinho } from '../../../lib/models/CarrinhoModel';

// Estender NextApiRequest para incluir user
interface CarrinhoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

const handler = nc()
.get(async (req: CarrinhoApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user) {
        console.log('req.user não definido'); // Log para depuração
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      // Busca o carrinho do usuário
      const carrinho = await Promise.race([
        CarrinhoModel.findOne({ usuarioId: req.user.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do carrinho')), 10000)),
      ]) as ICarrinho | null;

      // Se não houver carrinho, retorna um array vazio
      if (!carrinho) {
        return res.status(200).json({ produtos: [] });
      }

      // Busca os detalhes dos produtos no carrinho
      const produtos = await Promise.race([
        ProdutoModel.find({ _id: { $in: carrinho.produtos.map(p => p.produtoId) } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca dos produtos')), 10000)),
      ]) as IProduto[];

      // Combina os produtos com suas quantidades
      const produtosComQuantidade = carrinho.produtos.map(p => {
        const produto = produtos.find((prod: IProduto) => prod._id.toString() === p.produtoId);
        return {
          ...produto?.toObject(),
          quantidade: p.quantidade,
        };
      });

      return res.status(200).json({ produtos: produtosComQuantidade });
    } catch (e) {
      console.error('Erro ao listar carrinho:', e); // Log para depuração
      return res.status(500).json({ erro: 'Erro ao listar carrinho: ' + e });
    }
  })
  .post(async (req: CarrinhoApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user) {
        console.log('req.user não definido'); // Log para depuração
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      const { produtoId, quantidade } = req.body;
      console.log('POST /api/carrinho:', { usuarioId: req.user.id, produtoId, quantidade }); // Log para depuração

      // Valida os dados de entrada
      if (!produtoId || typeof produtoId !== 'string') {
        return res.status(400).json({ erro: 'ID do produto inválido' });
      }
      if (!quantidade || typeof quantidade !== 'number' || quantidade <= 0) {
        return res.status(400).json({ erro: 'Quantidade inválida' });
      }

      // Verifica se o produto existe
      const produto = await Promise.race([
        ProdutoModel.findById(produtoId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do produto')), 10000)),
      ]);
      if (!produto) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
      }

      // Busca ou cria o carrinho do usuário
      let carrinho = await Promise.race([
        CarrinhoModel.findOne({ usuarioId: req.user.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do carrinho')), 10000)),
      ]);

      if (!carrinho) {
        carrinho = await CarrinhoModel.create({ usuarioId: req.user.id, produtos: [] });
      }

      // Verifica se o produto já está no carrinho
      const produtoIndex = carrinho.produtos.findIndex((p: any) => p.produtoId === produtoId);
      if (produtoIndex >= 0) {
        // Atualiza a quantidade se o produto já existe
        carrinho.produtos[produtoIndex].quantidade += quantidade;
      } else {
        // Adiciona novo produto ao carrinho
        carrinho.produtos.push({ produtoId, quantidade });
      }

      // Salva o carrinho no MongoDB
      await Promise.race([
        CarrinhoModel.updateOne({ _id: carrinho._id }, carrinho),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar carrinho')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Produto adicionado ao carrinho com sucesso' });
    } catch (e) {
      console.error('Erro ao adicionar ao carrinho:', e); // Log para depuração
      return res.status(500).json({ erro: 'Erro ao adicionar ao carrinho: ' + e });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));