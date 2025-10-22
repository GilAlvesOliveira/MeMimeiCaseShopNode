import mongoose, { Schema, Document } from 'mongoose';

export interface IUsuario extends Document {
  nome: string;
  email: string;
  senha: string;
  avatar?: string;
  role: 'admin' | 'customer';
  telefone?: string; // novo
  endereco?: string; // novo
}

const UsuarioSchema = new Schema<IUsuario>({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  avatar: { type: String },
  role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
  telefone: { type: String, default: '' }, // novo
  endereco: { type: String, default: '' }, // novo
});

export const UsuarioModel = mongoose.models.Usuario || mongoose.model<IUsuario>('usuarios', UsuarioSchema);