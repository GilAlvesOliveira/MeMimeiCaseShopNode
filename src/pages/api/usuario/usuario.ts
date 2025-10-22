import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { UsuarioModel } from '../../../lib/models/UsuarioModel';
import nc from 'next-connect';
import { upload, uploadImagemCosmic } from '../../../lib/services/uploadImagemCosmic';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

interface UsuarioApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
  file?: any;
}

const handler = nc()
  .use(upload.single('file'))
  .get(async (req: UsuarioApiRequest, res: NextApiResponse<RespostaPadraoMsg | any>) => {
    try {
      if (!req.user) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      const userId = req.user.id;

      const usuario = await Promise.race([
        UsuarioModel.findById(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do usuário')), 10000)),
      ]);

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
      }

      const { senha, ...usuarioSemSenha } = (usuario as any).toObject();
      return res.status(200).json(usuarioSemSenha);
    } catch (e) {
      console.error('Erro no GET /api/usuario:', e);
      return res.status(500).json({ erro: 'Erro ao obter dados do usuário' });
    }
  })
  .put(async (req: UsuarioApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      if (!req.user) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
      }

      const userId = req.user.id;

      const usuario = await Promise.race([
        UsuarioModel.findById(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na busca do usuário')), 10000)),
      ]);

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
      }

      const { nome, telefone, endereco } = req.body as any;

      if (nome && nome.length < 2) {
        return res.status(400).json({ erro: 'Nome inválido' });
      }

      const image = await Promise.race([
        uploadImagemCosmic(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout no upload da imagem')), 10000)),
      ]);
      if (req.file && !image) {
        return res.status(400).json({ erro: 'Falha ao fazer upload da imagem' });
      }

      const usuarioASerAtualizado: any = {
        nome: nome || usuario.nome,
        avatar: image?.media?.url || usuario.avatar,
      };

      // campos novos (opcionais)
      if (typeof telefone === 'string') usuarioASerAtualizado.telefone = telefone;
      if (typeof endereco === 'string') usuarioASerAtualizado.endereco = endereco;

      await Promise.race([
        UsuarioModel.updateOne({ _id: userId }, usuarioASerAtualizado),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar usuário')), 10000)),
      ]);

      return res.status(200).json({ msg: 'Usuário atualizado com sucesso' });
    } catch (e) {
      console.error('Erro no PUT /api/usuario:', e);
      return res.status(500).json({ erro: 'Erro ao atualizar usuário: ' + e });
    }
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default politicaCORS(autenticar(conectarMongoDB(handler)));
