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
    .post(async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    // Recebe o valor do frete da requisição
    const { frete } = req.body;
    console.log("[Backend] Valor do frete recebido:", frete); // Log do valor recebido

    // Forçar a conversão para número (logar o tipo e o valor)
    const freteNumerico = parseFloat(frete);
    console.log("[Backend] Valor do frete convertido:", freteNumerico);

    // Verificar se o frete é válido
    if (isNaN(freteNumerico) || freteNumerico <= 0) {
      return res.status(400).json({ erro: 'Valor de frete inválido' });
    }

    // Buscar o carrinho do usuário
    const carrinho = (await CarrinhoModel.findOne({ usuarioId: req.user.id })) as ICarrinho | null;
    if (!carrinho || carrinho.produtos.length === 0) {
      return res.status(400).json({ erro: 'Carrinho vazio' });
    }

    // Buscar os produtos no carrinho
    const produtos = (await ProdutoModel.find({
      _id: { $in: carrinho.produtos.map((p) => p.produtoId) },
    })) as IProduto[];

    console.log("[Backend] Produtos encontrados no carrinho:", produtos);

    // Calcular o total dos produtos no carrinho
    const totalProdutos = carrinho.produtos.reduce((sum, p) => {
      const prod = produtos.find((pp) => pp._id.toString() === p.produtoId);
      return sum + (prod?.preco || 0) * p.quantidade;
    }, 0);

    console.log("[Backend] Total dos produtos:", totalProdutos);

    // Calcular o total final somando o valor do frete
    const total = totalProdutos + freteNumerico;
    console.log("[Backend] Total com frete:", total);

    // Criar o objeto do pedido
    const pedido = {
      usuarioId: req.user.id,
      produtos: carrinho.produtos.map((p) => {
        const prod = produtos.find((pp) => pp._id.toString() === p.produtoId);
        return {
          produtoId: p.produtoId,
          quantidade: p.quantidade,
          precoUnitario: prod?.preco || 0,
        };
      }),
      total, // Total com frete
      frete: freteNumerico, // Salvando o valor do frete também
      status: 'pendente',
      criadoEm: new Date(),
      enviado: false,
      enviadoEm: null,
    };

    // Criar o pedido no banco
    const novo = (await PedidoModel.create(pedido)) as IPedido;

    // Limpar o carrinho após o pedido ser criado
    await CarrinhoModel.updateOne({ _id: carrinho._id }, { produtos: [] });

    return res.status(200).json({
      msg: 'Pedido criado com sucesso',
      pedidoId: novo._id,
      total,
      frete: freteNumerico,  // Retornando o valor do frete também
    });
  } catch (e) {
    console.error('Erro ao criar pedido:', e);
    return res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
})
    .get(async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });

        const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
        const filtro = isAdmin ? {} : { usuarioId: req.user.id };

        const pedidos = (await PedidoModel.find(filtro).sort({ criadoEm: -1 })) as IPedido[];

        const usuarioIds = Array.from(new Set(pedidos.map((p) => p.usuarioId)));
        const usuarios = await UsuarioModel.find({ _id: { $in: usuarioIds } });
        const userMap = new Map(usuarios.map((u) => [u._id.toString(), u]));

        const produtoIds = Array.from(
            new Set(pedidos.flatMap((p) => p.produtos.map((i) => i.produtoId)))
        );
        const prods = await ProdutoModel.find({ _id: { $in: produtoIds } });
        const prodMap = new Map(prods.map((x) => [x._id.toString(), x]));

        // Lógica para verificar e atualizar o status de pedidos pendentes há mais de 24 horas
        const now = new Date();
        for (let pedido of pedidos) {
            if (pedido.status === "pendente" && new Date(pedido.criadoEm).getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
                pedido.status = "cancelado";  // Atualiza o status para "cancelado"
                await pedido.save(); // Salva a alteração do status
            }
        }

        // Organiza a resposta com informações detalhadas
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
            frete: p.frete || 0, // Exibindo o valor do frete
            status: p.status,
            criadoEm: p.criadoEm,
            enviado: p.enviado || false,
            enviadoEm: p.enviadoEm || null,
        }));

        return res.status(200).json(resp);
    } catch (e) {
        console.error('Erro ao listar pedidos:', e);
        return res.status(500).json({ erro: 'Erro ao listar pedidos' });
    }
})


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