import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { globalSignOut } from '../lib/authUtils';
import { UserProfile } from '../types';
import { motion } from 'framer-motion';
import { User, Phone, CreditCard, MapPin, Save, Loader2, LogOut } from 'lucide-react';

interface CompleteProfileProps {
  profile: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
}

export default function CompleteProfile({ profile, onComplete }: CompleteProfileProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile.displayName || '',
    phone: profile.phone || '',
    cpf: profile.cpf || '',
    address: profile.address || ''
  });
  const [error, setError] = useState('');

  const handleLogout = async () => {
    await globalSignOut();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.phone || !formData.cpf || !formData.address) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profileId = `${profile.uid}_${profile.role}`;
      const userRef = doc(db, 'users', profileId);
      const updates = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);
      onComplete({ ...profile, ...formData });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('Erro ao atualizar perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-8 border border-transparent dark:border-slate-700"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/30 rounded-3xl flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
            <User size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Complete seu Perfil</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Precisamos de mais algumas informações para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white"
                placeholder="Seu nome"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white"
                placeholder="(00) 00000-0000"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">CPF</label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white"
                placeholder="000.000.000-00"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Endereço</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white"
                placeholder="Rua, número, bairro, cidade"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm font-bold text-center">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              {loading ? 'Salvando...' : 'Salvar e Continuar'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut size={20} /> Sair
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
