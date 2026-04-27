import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion } from 'framer-motion';
import { User, Phone, CreditCard, MapPin, Save, Loader2, ArrowLeft, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { logSystemError } from '../lib/errorUtils';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
}

export default function ProfileView({ profile, onUpdate }: ProfileViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile.displayName || '',
    phone: profile.phone || '',
    cpf: profile.cpf || '',
    address: profile.address || ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Change States
  const [showSecurity, setShowSecurity] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const profileId = `${profile.uid}_${profile.role}`;
      const userRef = doc(db, 'users', profileId);
      const updates = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);
      onUpdate({ ...profile, ...formData });
      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      logSystemError(err, 'Profile Update');
      setError('Erro ao atualizar perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    
    if (newPassword !== confirmNewPassword) {
      setError('As novas senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setPasswordLoading(true);
    setError('');
    setSuccess('');

    try {
      // Reauthenticate first
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      setSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowSecurity(false);
    } catch (err: any) {
      console.error('Error changing password:', err);
      logSystemError(err, 'Password Change');
      if (err.code === 'auth/wrong-password') {
        setError('Senha atual incorreta.');
      } else {
        setError('Erro ao alterar senha: ' + err.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-2 font-black text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={18} /> Voltar
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Meu <span className="text-sky-500">Perfil</span></h1>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-transparent dark:border-slate-800 space-y-8"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 bg-sky-100 dark:bg-sky-900/30 rounded-3xl flex items-center justify-center text-sky-600 dark:text-sky-400 relative">
              <User size={48} />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-slate-900" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{profile.displayName || 'Usuário'}</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <Mail size={12} /> {profile.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">CPF</label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">E-mail (Não editável)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-transparent rounded-2xl outline-none dark:text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                  placeholder="Rua, número, bairro, cidade"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-bold text-center">{error}</p>
            )}

            {success && (
              <p className="text-green-500 text-xs font-bold text-center">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>

          {/* Security Section */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                <Shield className="text-sky-600" size={24} />
                <h3 className="text-lg font-black uppercase tracking-tight">Segurança</h3>
              </div>
              <button
                onClick={() => setShowSecurity(!showSecurity)}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 uppercase tracking-widest"
              >
                {showSecurity ? 'Cancelar' : 'Alterar Senha'}
              </button>
            </div>

            {showSecurity && (
              <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha Atual</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Senha</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Confirmar Nova Senha</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-sky-500 rounded-2xl outline-none transition-all dark:text-white text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 hover:text-sky-600 transition-colors"
                  >
                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {passwordLoading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                  {passwordLoading ? 'Alterando...' : 'Confirmar Nova Senha'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
