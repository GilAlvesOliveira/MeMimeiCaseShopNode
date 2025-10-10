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

const handler = nc()
  .get(async (req: ProdutoApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      const produtos = await Promise.race([
        ProdutoModel.find(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca de produtos')), 10000)),
      ]);
      return res.status(200).json(produtos);
    } catch (e) {
      return res.status(500).json({ erro: 'Erro ao listar produtos' });
    }
  })
  .use(async (req: ProdutoApiRequest, res: NextApiResponse, next: () => void) => {
    await autenticar((req: ProdutoApiRequest, res: NextApiResponse) => Promise.resolve(next()))(req, res);
  })
  .use(upload.single('file')) // Middleware para upload de imagem
  .post(async (req: ProdutoApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
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
      if (!produto.preco || produto.preco <= 0) {
        return res.status(400).json({ erro: 'Preço inválido' });
      }
      if (!produto.estoque || produto.estoque < 0) {
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
      };

      await Promise.race([
        ProdutoModel.create(produtoASerSalvo),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao salvar produto')), 10000)),
      ]);
      return res.status(200).json({ msg: 'Produto criado com sucesso' });
    } catch (e) {
      return res.status(500).json({ erro: 'Erro ao criar produto' });
    }
  })
  .put(async (req: ProdutoApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
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
      if (produto.nome && produto.nome.length < 2) {
        return res.status(400).json({ erro: 'Nome inválido' });
      }
      if (produto.descricao && produto.descricao.length < 5) {
        return res.status(400).json({ erro: 'Descrição inválida' });
      }
      if (produto.preco && produto.preco <= 0) {
        return res.status(400).json({ erro: 'Preço inválido' });
      }
      if (produto.estoque && produto.estoque < 0) {
        return res.status(400).json({ erro: 'Estoque inválido' });
      }
      if (produto.categoria && produto.categoria.length < 2) {
        return res.status(400).json({ erro: 'Categoria inválida' });
      }
      if (produto.cor && produto.cor.length < 2) {
        return res.status(400).json({ erro: 'Cor inválida' });
      }
      if (produto.modelo && produto.modelo.length < 2) {
        return res.status(400).json({ erro: 'Modelo inválido' });
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
        nome: produto.nome || produtoExistente.nome,
        descricao: produto.descricao || produtoExistente.descricao,
        preco: produto.preco || produtoExistente.preco,
        estoque: produto.estoque || produtoExistente.estoque,
        imagem: image?.media?.url || produtoExistente.imagem,
        categoria: produto.categoria || produtoExistente.categoria,
        cor: produto.cor || produtoExistente.cor,
        modelo: produto.modelo || produtoExistente.modelo,
      };

      await Promise.race([
        ProdutoModel.updateOne({ _id }, produtoASerAtualizado),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar produto')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Produto atualizado com sucesso' });
    } catch (e) {
      return res.status(500).json({ erro: 'Erro ao atualizar produto' });
    }
  })
  .delete(async (req: ProdutoApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
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
      return res.status(500).json({ erro: 'Erro ao excluir produto' });
    }
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default politicaCORS(conectarMongoDB(handler));