import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import type { ProdutoRequisicao } from '../../../lib/types/ProdutoRequisicao';
import { ProdutoModel } from '../../../lib/models/ProdutoModel';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { upload, uploadImagemCosmic } from '../../../lib/services/uploadImagemCosmic';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

// Estender NextApiRequest para incluir user e file
interface ProdutoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
  file?: any; // Temporário devido ao problema com multer
}

const handler = nc<ProdutoApiRequest, NextApiResponse<RespostaPadraoMsg | any>>()
  /**
   * GET /api/products/produtos
   * - Lista todos os produtos, inclusive com estoque = 0
   * - Suporta busca opcional (?q=) em vários campos
   * - Suporta filtro opcional (?somenteDisponiveis=1) para listar apenas estoque > 0
   */
  .get(async (req, res) => {
    try {
      const { q, somenteDisponiveis } = req.query;

      const filtro: any = {};

      if (typeof q === 'string' && q.trim().length > 0) {
        const term = q.trim();
        filtro.$or = [
          { nome:        { $regex: term, $options: 'i' } },
          { modelo:      { $regex: term, $options: 'i' } },
          { categoria:   { $regex: term, $options: 'i' } },
          { cor:         { $regex: term, $options: 'i' } },
          { altura:      { $regex: term, $options: 'i' } },
          { peso:        { $regex: term, $options: 'i' } },
          { largura:     { $regex: term, $options: 'i' } },
          { comprimento: { $regex: term, $options: 'i' } },
        ];
      }

      if (String(somenteDisponiveis || '') === '1') {
        filtro.estoque = { $gt: 0 };
      }

      const produtos = await Promise.race([
        ProdutoModel.find(filtro).sort({ nome: 1 }).limit(500),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca de produtos')), 10000)),
      ]);

      return res.status(200).json(produtos);
    } catch (e) {
      console.error('Erro ao listar produtos:', e);
      return res.status(500).json({ erro: 'Erro ao listar produtos' });
    }
  })

  /**
   * A partir daqui, autenticação obrigatória (POST/PUT/DELETE)
   * Usamos o middleware de autenticação apenas nas rotas de escrita.
   */
  .use(async (req, res, next) => {
    // Encapsula o middleware autenticar para funcionar no next-connect
    await autenticar((r: ProdutoApiRequest, s: NextApiResponse) => Promise.resolve(next()))(req, res);
  })

  .use(upload.single('file')) // Middleware para upload de imagem

  /**
   * POST /api/products/produtos
   * - Cria produto (apenas admin)
   * - Permite estoque = 0
   */
  .post(async (req, res) => {
    try {
      // Verificar se o usuário é admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const produto = req.body as ProdutoRequisicao;

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
      // PERMITE 0 -> usa == null para aceitar zero
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
      if (!produto.peso || produto.peso <= 0) {
        return res.status(400).json({ erro: 'Peso inválido' });
      }
      if (!produto.largura || produto.largura <= 0) {
        return res.status(400).json({ erro: 'Largura inválida' });
      }
      if (!produto.altura || produto.altura <= 0) {
        return res.status(400).json({ erro: 'Altura inválida' });
      }
      if (!produto.comprimento || produto.comprimento <= 0) {
        return res.status(400).json({ erro: 'Comprimento inválido' });
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
        estoque: produto.estoque, // pode ser 0
        imagem: image?.media?.url,
        categoria: produto.categoria,
        cor: produto.cor,
        modelo: produto.modelo,
        peso: produto.peso,
        largura: produto.largura,
        altura: produto.altura,
        comprimento: produto.comprimento,
      };

      await Promise.race([
        ProdutoModel.create(produtoASerSalvo),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao salvar produto')), 10000)),
      ]);
      return res.status(200).json({ msg: 'Produto criado com sucesso' });
    } catch (e) {
      console.error('Erro ao criar produto:', e);
      return res.status(500).json({ erro: 'Erro ao criar produto' });
    }
  })

  /**
   * PUT /api/products/produtos?_id=<id>
   * - Atualiza produto (apenas admin)
   * - Usa nullish coalescing (??) para não perder zeros
   */
  .put(async (req, res) => {
    try {
      // Verificar se o usuário é admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const { _id } = req.query;
      if (!_id || typeof _id !== 'string') {
        return res.status(400).json({ erro: 'ID do produto inválido' });
      }

      const produtoExistente = await Promise.race([
        ProdutoModel.findById(_id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do produto')), 10000)),
      ]);

      if (!produtoExistente) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
      }

      const produto = req.body as Partial<ProdutoRequisicao>;

      // Validação dos campos fornecidos
      if (produto.nome != null && produto.nome.length < 2) {
        return res.status(400).json({ erro: 'Nome inválido' });
      }
      if (produto.descricao != null && produto.descricao.length < 5) {
        return res.status(400).json({ erro: 'Descrição inválida' });
      }
      if (produto.preco != null && produto.preco <= 0) {
        return res.status(400).json({ erro: 'Preço inválido' });
      }
      if (produto.estoque != null && produto.estoque < 0) {
        return res.status(400).json({ erro: 'Estoque inválido' });
      }
      if (produto.categoria != null && produto.categoria.length < 2) {
        return res.status(400).json({ erro: 'Categoria inválida' });
      }
      if (produto.cor != null && produto.cor.length < 2) {
        return res.status(400).json({ erro: 'Cor inválida' });
      }
      if (produto.modelo != null && produto.modelo.length < 2) {
        return res.status(400).json({ erro: 'Modelo inválido' });
      }
      if (produto.peso != null && produto.peso < 0) {
        return res.status(400).json({ erro: 'Peso inválido' });
      }
      if (produto.largura != null && produto.largura < 0) {
        return res.status(400).json({ erro: 'Largura inválida' });
      }
      if (produto.altura != null && produto.altura < 0) {
        return res.status(400).json({ erro: 'Altura inválida' });
      }
      if (produto.comprimento != null && produto.comprimento < 0) {
        return res.status(400).json({ erro: 'Comprimento inválido' });
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
        preco: produto.preco ?? produtoExistente.preco,       // aceita 0 usando ??
        estoque: produto.estoque ?? produtoExistente.estoque, // aceita 0 usando ??
        imagem: image?.media?.url ?? produtoExistente.imagem,
        categoria: produto.categoria ?? produtoExistente.categoria,
        cor: produto.cor ?? produtoExistente.cor,
        modelo: produto.modelo ?? produtoExistente.modelo,
        peso: produto.peso ?? produtoExistente.peso,
        largura: produto.largura ?? produtoExistente.largura,
        altura: produto.altura ?? produtoExistente.altura,
        comprimento: produto.comprimento ?? produtoExistente.comprimento,
      };

      await Promise.race([
        ProdutoModel.updateOne({ _id }, produtoASerAtualizado),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar produto')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Produto atualizado com sucesso' });
    } catch (e) {
      console.error('Erro ao atualizar produto:', e);
      return res.status(500).json({ erro: 'Erro ao atualizar produto' });
    }
  })

  /**
   * DELETE /api/products/produtos?_id=<id>
   * - Exclui produto (apenas admin)
   */
  .delete(async (req, res) => {
    try {
      // Verificar se o usuário é admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const { _id } = req.query;
      if (!_id || typeof _id !== 'string') {
        return res.status(400).json({ erro: 'ID do produto inválido' });
      }

      const produto = await Promise.race([
        ProdutoModel.findById(_id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do produto')), 10000)),
      ]);

      if (!produto) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
      }

      await Promise.race([
        ProdutoModel.deleteOne({ _id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao excluir produto')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Produto excluído com sucesso' });
    } catch (e) {
      console.error('Erro ao excluir produto:', e);
      return res.status(500).json({ erro: 'Erro ao excluir produto' });
    }
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default politicaCORS(conectarMongoDB(handler));
