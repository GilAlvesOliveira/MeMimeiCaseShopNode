import type { NextApiRequest, NextApiResponse } from 'next';
import type { RespostaPadraoMsg } from '../../../lib/types/RespostaPadraoMsg';
import { autenticar } from '../../../lib/middlewares/autenticar';
import { conectarMongoDB } from '../../../lib/middlewares/conectarMongoDB';
import { CarrinhoModel, ICarrinho } from '../../../lib/models/CarrinhoModel';
import { ProdutoModel, IProduto } from '../../../lib/models/ProdutoModel';
import { PedidoModel, IPedido } from '../../../lib/models/PedidoModel';
import { UsuarioModel } from '../../../lib/models/UsuarioModel';
import nc from 'next-connect';
import { politicaCORS } from '../../../lib/middlewares/politicaCORS';

interface PedidoApiRequest extends NextApiRequest {
  user?: { id: string; email: string; role: string };
}

const handler = nc<PedidoApiRequest, NextApiResponse<RespostaPadraoMsg | any>>()

  // Criar pedido a partir do carrinho (cliente logado)
  // Aceita "frete" opcional no body para somar ao total e salvar os dados do frete
  .post(async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });

      const carrinho = (await CarrinhoModel.findOne({ usuarioId: req.user.id })) as ICarrinho | null;
      if (!carrinho || carrinho.produtos.length === 0) {
        return res.status(400).json({ erro: 'Carrinho vazio' });
      }

      const produtos = (await ProdutoModel.find({
        _id: { $in: carrinho.produtos.map((p) => p.produtoId) },
      })) as IProduto[];

      // ===== VALIDAÇÃO DE ESTOQUE (para cada item do carrinho) =====
      for (const item of carrinho.produtos) {
        const prod = produtos.find((pp) => pp._id.toString() === item.produtoId);
        if (!prod) {
          return res.status(400).json({ erro: `Produto ${item.produtoId} não encontrado` });
        }
        const estoqueAtual = Number((prod as any).estoque ?? 0) || 0;
        if (estoqueAtual <= 0) {
          return res.status(400).json({ erro: `Produto "${(prod as any).nome}" está esgotado` });
        }
        if (item.quantidade > estoqueAtual) {
          return res.status(400).json({
            erro: `Quantidade de "${(prod as any).nome}" indisponível (em estoque: ${estoqueAtual})`,
          });
        }
      }
      // ============================================================

      const itens = carrinho.produtos.map((p) => {
        const prod = produtos.find((pp) => pp._id.toString() === p.produtoId);
        return {
          produtoId: p.produtoId,
          quantidade: p.quantidade,
          precoUnitario: (prod as any)?.preco || 0,
        };
      });

      const subtotal = carrinho.produtos.reduce((sum, p) => {
        const prod = produtos.find((pp) => pp._id.toString() === p.produtoId);
        return sum + (((prod as any)?.preco || 0) * p.quantidade);
      }, 0);

      // ===== Frete (opcional) vindo do body =====
      const frete = (req.body && (req.body as any).frete) || null;
      const freteValor = Number(frete?.valor || 0) || 0;

      const pedido = {
        usuarioId: req.user.id,
        produtos: itens,
        total: subtotal + freteValor, // soma do frete
        status: 'pendente',
        criadoEm: new Date(),
        enviado: false,
        enviadoEm: null,

        // Salva dados do frete (se houver)
        freteValor,
        freteServicoId: frete?.servicoId || null,
        freteNome: frete?.nome || null,
        freteEmpresa: frete?.empresa || null,
        fretePrazo: typeof frete?.prazo === 'number' ? frete?.prazo : null,
        destinoCEP: frete?.destinoCEP || null,
      };

      const novo = (await PedidoModel.create(pedido)) as IPedido;

      // limpar carrinho
      await CarrinhoModel.updateOne({ _id: carrinho._id }, { produtos: [] });

      return res.status(200).json({
        msg: 'Pedido criado com sucesso',
        pedidoId: novo._id,
        subtotal,
        freteValor,
        total: pedido.total,
      });
    } catch (e) {
      console.error('Erro ao criar pedido:', e);
      return res.status(500).json({ erro: 'Erro ao criar pedido' });
    }
  })

  // Listar pedidos (admin vê todos; cliente vê os seus)
  .get(async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });

      const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
      const filtro = isAdmin ? {} : { usuarioId: req.user.id };

      const pedidos = (await PedidoModel.find(filtro).sort({ criadoEm: -1 })) as IPedido[];

      // enriquecer: nome do usuário + dados do produto
      const usuarioIds = Array.from(new Set(pedidos.map((p) => p.usuarioId)));
      const usuarios = await UsuarioModel.find({ _id: { $in: usuarioIds } });
      const userMap = new Map(usuarios.map((u) => [u._id.toString(), u]));

      const produtoIds = Array.from(
        new Set(pedidos.flatMap((p) => p.produtos.map((i) => i.produtoId)))
      );
      const prods = await ProdutoModel.find({ _id: { $in: produtoIds } });
      const prodMap = new Map(prods.map((x) => [x._id.toString(), x]));

      const resp = pedidos.map((p) => ({
        _id: p._id,
        usuarioId: p.usuarioId,
        usuarioInfo: (() => {
          const u: any = userMap.get(p.usuarioId);
          if (!u) return {};
          return {
            nome: u.nome,
            email: u.email,
            telefone: u.telefone || '',
            endereco: u.endereco || '',
          };
        })(),
        produtos: p.produtos.map((it) => {
          const pd: any = prodMap.get(it.produtoId);
          return {
            produtoId: it.produtoId,
            quantidade: it.quantidade,
            precoUnitario: it.precoUnitario,
            nome: pd?.nome || undefined,
            modelo: pd?.modelo || undefined,
            cor: pd?.cor || undefined,
            imagem: pd?.imagem || undefined,
          };
        }),
        total: p.total,
        status: p.status,
        criadoEm: p.criadoEm,
        enviado: p.enviado || false,
        enviadoEm: p.enviadoEm || null,

        // Frete (exposto na listagem)
        freteValor: p.freteValor || 0,
        freteServicoId: p.freteServicoId || null,
        freteNome: p.freteNome || null,
        freteEmpresa: p.freteEmpresa || null,
        fretePrazo: p.fretePrazo || null,
        destinoCEP: p.destinoCEP || null,
      }));

      return res.status(200).json(resp);
    } catch (e) {
      console.error('Erro ao listar pedidos:', e);
      return res.status(500).json({ erro: 'Erro ao listar pedidos' });
    }
  })

  // ADMIN: atualizar status de envio (enviado true/false)
  .put(async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });
      if (String(req.user.role || '').toLowerCase() !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado: somente administradores' });
      }

      const { _id } = req.query;
      if (!_id || typeof _id !== 'string') {
        return res.status(400).json({ erro: 'ID do pedido inválido' });
      }

      const { enviado } = req.body as { enviado?: boolean };
      if (typeof enviado !== 'boolean') {
        return res.status(400).json({ erro: 'Campo "enviado" (boolean) é obrigatório' });
      }

      const setObj: any = { enviado };
      setObj.enviadoEm = enviado ? new Date() : null;

      const upd = await PedidoModel.updateOne({ _id }, { $set: setObj });
      if (upd.modifiedCount === 0) {
        return res.status(404).json({ erro: 'Pedido não encontrado ou sem alterações' });
      }

      return res.status(200).json({ msg: 'Status de envio atualizado' });
    } catch (e) {
      console.error('Erro ao atualizar envio:', e);
      return res.status(500).json({ erro: 'Erro ao atualizar envio' });
    }
  });

export default politicaCORS(autenticar(conectarMongoDB(handler)));
