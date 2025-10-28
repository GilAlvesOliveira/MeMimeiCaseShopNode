import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { upload, uploadImagemCosmic } from '../../../lib/services/uploadImagemCosmic';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

interface ProdutoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
  file?: any;
}

const handler = nc<ProdutoApiRequest, NextApiResponse<RespostaPadraoMsg | any>>()
  .use(async (req, res, next) => {
    await autenticar((r: ProdutoApiRequest, s: NextApiResponse) => Promise.resolve(next()))(req, res);
  })
  .use(upload.single('file')) // Middleware para upload de imagem

  // POST para criar produto
  .post(async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const produto = req.body as any;

      // Validação dos campos
      if (!produto.nome || produto.nome.length < 2) {
        return res.status(400).json({ erro: 'Nome inválido' });
      }
      if (!produto.descricao || produto.descricao.length < 5) {
        return res.status(400).json({ erro: 'Descrição inválida' });
      }
      if (produto.preco == null || produto.preco <= 0) {
        return res.status(400).json({ erro: 'Preço inválido' });
      }
      if (produto.estoque == null || produto.estoque < 0) {
        return res.status(400).json({ erro: 'Estoque inválido' });
      }
      if (!produto.categoria || produto.categoria.length < 2) {
        return res.status(400).json({ erro: 'Categoria inválida' });
      }
      if (!produto.cor || produto.cor.length < 2) {
        return res.status(400).json({ erro: 'Cor inválida' });
      }
      if (!produto.modelo || produto.modelo.length < 2) {
        return res.status(400).json({ erro: 'Modelo inválido' });
      }

      // Validação das novas dimensões
      if (produto.peso <= 0 || produto.largura <= 0 || produto.altura <= 0 || produto.comprimento <= 0) {
        return res.status(400).json({ erro: 'Peso, largura, altura ou comprimento inválido' });
      }

      // Upload da imagem (opcional)
      const image = await Promise.race([
        uploadImagemCosmic(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout no upload da imagem')), 10000)),
      ]);
      if (req.file && !image) {
        return res.status(400).json({ erro: 'Falha ao fazer upload da imagem' });
      }

      const produtoASerSalvo = {
        nome: produto.nome,
        descricao: produto.descricao,
        preco: produto.preco,
        estoque: produto.estoque,
        imagem: image?.media?.url,
        categoria: produto.categoria,
        cor: produto.cor,
        modelo: produto.modelo,
        peso: produto.peso,
        largura: produto.largura,
        altura: produto.altura,
        comprimento: produto.comprimento,
      };

      await ProdutoModel.create(produtoASerSalvo);
      return res.status(200).json({ msg: 'Produto criado com sucesso' });
    } catch (e) {
      console.error('Erro ao criar produto:', e);
      return res.status(500).json({ erro: 'Erro ao criar produto' });
    }
  })

  // PUT para editar produto
  .put(async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const { _id } = req.query;
      if (!_id || typeof _id !== 'string') {
        return res.status(400).json({ erro: 'ID do produto inválido' });
      }

      const produtoExistente = await ProdutoModel.findById(_id);
      if (!produtoExistente) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
      }

      const produto = req.body as Partial<any>;

      // Validação das novas dimensões
      if (produto.peso <= 0 || produto.largura <= 0 || produto.altura <= 0 || produto.comprimento <= 0) {
        return res.status(400).json({ erro: 'Peso, largura, altura ou comprimento inválido' });
      }

      // Upload da imagem (opcional)
      const image = await Promise.race([
        uploadImagemCosmic(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout no upload da imagem')), 10000)),
      ]);
      if (req.file && !image) {
        return res.status(400).json({ erro: 'Falha ao fazer upload da imagem' });
      }

      const produtoASerAtualizado = {
        nome: produto.nome ?? produtoExistente.nome,
        descricao: produto.descricao ?? produtoExistente.descricao,
        preco: produto.preco ?? produtoExistente.preco,
        estoque: produto.estoque ?? produtoExistente.estoque,
        imagem: image?.media?.url ?? produtoExistente.imagem,
        categoria: produto.categoria ?? produtoExistente.categoria,
        cor: produto.cor ?? produtoExistente.cor,
        modelo: produto.modelo ?? produtoExistente.modelo,
        peso: produto.peso ?? produtoExistente.peso,
        largura: produto.largura ?? produtoExistente.largura,
        altura: produto.altura ?? produtoExistente.altura,
        comprimento: produto.comprimento ?? produtoExistente.comprimento,
      };

      await ProdutoModel.updateOne({ _id }, produtoASerAtualizado);
      return res.status(200).json({ msg: 'Produto atualizado com sucesso' });
    } catch (e) {
      console.error('Erro ao atualizar produto:', e);
      return res.status(500).json({ erro: 'Erro ao atualizar produto' });
    }
  });

export default politicaCORS(conectarMongoDB(handler));
