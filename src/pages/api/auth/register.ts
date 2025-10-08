import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import type { CadastroRequisicao } from '../../../lib/types/CadastroRequisicao';
import { UsuarioModel } from '../../../lib/models/UsuarioModel';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import md5 from 'md5'; // Recomendação: Troque por bcrypt para segurança (npm install bcrypt @types/bcrypt)
import { upload, uploadImagemCosmic } from '../../../lib/services/uploadImagemCosmic';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

const handler = nc()
  .use(upload.single('file'))
  .post(async (req: NextApiRequest, res: NextApiResponse<RespostaPadraoMsg>) => {
    try {
      const usuario = req.body as CadastroRequisicao;

      if (!usuario.nome || usuario.nome.length < 2) {
        return res.status(400).json({ erro: 'Nome invalido' });
      }

      if (
        !usuario.email ||
        usuario.email.length < 5 ||
        !usuario.email.includes('@') ||
        !usuario.email.includes('.')
      ) {
        return res.status(400).json({ erro: 'Email invalido' });
      }

      if (!usuario.senha || usuario.senha.length < 4) {
        return res.status(400).json({ erro: 'Senha invalida' });
      }

      const usuarioComMesmoEmail = await UsuarioModel.find({ email: usuario.email });
      if (usuarioComMesmoEmail && usuarioComMesmoEmail.length > 0) {
        return res.status(400).json({ erro: 'Ja existe uma conta com o email informado' });
      }

      // Enviar a imagem do multer para o cosmic
      const image = await uploadImagemCosmic(req);

      const usuarioASerSalvo = {
        nome: usuario.nome,
        email: usuario.email,
        senha: md5(usuario.senha), // Troque por await bcrypt.hash(usuario.senha, 10) para segurança
        avatar: image?.media?.url,
        role: 'customer', // Para e-commerce
      };
      await UsuarioModel.create(usuarioASerSalvo);
      return res.status(200).json({ msg: 'Usuario criado com sucesso' });
    } catch (e) {
      console.log(e);
      return res.status(500).json({ erro: 'Erro ao cadastrar usuario' });
    }
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default politicaCORS(conectarMongoDB(handler));