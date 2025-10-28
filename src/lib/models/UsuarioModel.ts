import mongoose, { Schema, Document } from 'mongoose';

export interface IUsuario extends Document {
  nome: string;
  email: string;
  senha: string;
  avatar?: string;
  role: 'admin' | 'customer';
  telefone?: string;
  endereco?: string;
  cep?: string;  // Novo campo para o CEP de destino
}

const UsuarioSchema = new Schema<IUsuario>({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  avatar: { type: String },
  role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
  telefone: { type: String },
  endereco: { type: String },
  cep: { type: String, required: false },  // Adicionando o campo cep para o cliente
});

export const UsuarioModel =
  mongoose.models.Usuario || mongoose.model<IUsuario>('usuarios', UsuarioSchema);
