/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Search,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { SimagRole, SimagSession, SimagUser } from '../types/auth';
import {
  createSimagUser,
  changeSimagUserPassword,
  deleteSimagUser,
} from '../services/simagAuthService';

interface UserManagementTabProps {
  currentSession: SimagSession;
  users: SimagUser[];
  onUsersChange: (nextUsers: SimagUser[]) => void;
}

const ROLE_OPTIONS: SimagRole[] = [
  'Administrator',
  'Kepala Gudang',
  'Petugas Gudang',
  'Operator',
];

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  currentSession,
  users,
  onUsersChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | SimagRole>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add User Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNip, setNewNip] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newRole, setNewRole] = useState<SimagRole>('Petugas Gudang');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Change Password Modal state
  const [passwordTarget, setPasswordTarget] = useState<SimagUser | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState('');
  const [confirmUpdatedPassword, setConfirmUpdatedPassword] = useState('');
  const [showUpdatedPwd, setShowUpdatedPwd] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [deleteTarget, setDeleteTarget] = useState<SimagUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManageUsers =
    currentSession.role === 'Administrator' || currentSession.role === 'Kepala Gudang';
  const isAdmin = currentSession.role === 'Administrator';

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'Administrator').length;
    const kepala = users.filter(u => u.role === 'Kepala Gudang').length;
    const staff = users.filter(u => u.role !== 'Administrator' && u.role !== 'Kepala Gudang').length;
    return { total, admins, kepala, staff };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (q) {
        return (
          u.nip.toLowerCase().includes(q) ||
          u.nama.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Belum pernah login';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const openAddModal = () => {
    setNewNip('');
    setNewNama('');
    setNewRole('Petugas Gudang');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPwd(false);
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (newPassword !== confirmNewPassword) {
      setAddError('Konfirmasi password tidak cocok dengan password.');
      return;
    }

    const res = createSimagUser(currentSession, {
      nip: newNip,
      nama: newNama,
      role: newRole,
      password: newPassword,
    });

    if (!res.ok) {
      setAddError(res.error);
      return;
    }

    onUsersChange(res.users);
    setIsAddOpen(false);
    setFeedback({
      type: 'success',
      message: `User baru NIP ${res.created.nip} (${res.created.role}) berhasil ditambahkan.`,
    });
  };

  const openPasswordModal = (user: SimagUser) => {
    setPasswordTarget(user);
    setUpdatedPassword('');
    setConfirmUpdatedPassword('');
    setShowUpdatedPwd(false);
    setPasswordError(null);
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    setPasswordError(null);

    if (updatedPassword !== confirmUpdatedPassword) {
      setPasswordError('Konfirmasi password baru tidak cocok.');
      return;
    }

    const res = changeSimagUserPassword(currentSession, passwordTarget.id, updatedPassword);
    if (!res.ok) {
      setPasswordError(res.error);
      return;
    }

    onUsersChange(res.users);
    setFeedback({
      type: 'success',
      message: `Password untuk NIP ${passwordTarget.nip} berhasil diperbarui.`,
    });
    setPasswordTarget(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError(null);

    const res = deleteSimagUser(currentSession, deleteTarget.id);
    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }

    onUsersChange(res.users);
    setFeedback({
      type: 'success',
      message: `User NIP ${deleteTarget.nip} (${deleteTarget.nama}) berhasil dihapus.`,
    });
    setDeleteTarget(null);
  };

  const canChangeTargetPassword = (target: SimagUser) => {
    if (target.id === currentSession.userId) return true;
    if (!canManageUsers) return false;
    if (!isAdmin && target.role === 'Administrator') return false;
    return true;
  };

  const canDeleteTargetUser = (target: SimagUser) => {
    if (target.id === currentSession.userId) return false;
    if (!canManageUsers) return false;
    if (!isAdmin && target.role === 'Administrator') return false;
    return true;
  };

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Management User SIMAG PLN
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola NIP / User ID, peran akses, pergantian password, dan penghapusan akun pengguna dashboard.
            </p>
          </div>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={openAddModal}
            className="btn-tactile px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-cyan-900/15 dark:shadow-cyan-950/40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Role Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total User Aktif</div>
          <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Administrator</div>
          <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {stats.admins}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kepala Gudang</div>
          <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.kepala}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Petugas / Operator</div>
          <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {stats.staff}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan NIP, nama, atau role..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-xs sm:text-sm text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'ALL' | SimagRole)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Role ({users.length})</option>
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">NIP / User ID</th>
                <th className="py-3 px-4">Nama Pengguna</th>
                <th className="py-3 px-4">Role Akses</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada user yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentSession.userId;
                  const allowPwd = canChangeTargetPassword(user);
                  const allowDelete = canDeleteTargetUser(user);

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">
                        {user.nip}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.nama}
                          {isCurrentUser && (
                            <span className="ml-2 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                              (Sesi Aktif)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            user.role === 'Administrator'
                              ? 'text-cyan-700 dark:text-cyan-300'
                              : user.role === 'Kepala Gudang'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {user.role === 'Administrator' ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          ) : (
                            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>{user.role}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
                        {formatDateTime(user.lastLoginAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!allowPwd}
                            onClick={() => openPasswordModal(user)}
                            title={
                              allowPwd
                                ? `Ganti password ${user.nip}`
                                : 'Hanya Administrator yang dapat mengganti password Administrator'
                            }
                            className="btn-tactile px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/60 border border-slate-300 dark:border-slate-700 hover:border-cyan-400 text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Ganti Password</span>
                          </button>

                          <button
                            type="button"
                            disabled={!allowDelete}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(user);
                            }}
                            title={
                              isCurrentUser
                                ? 'Tidak dapat menghapus akun yang sedang aktif login'
                                : !allowDelete
                                ? 'Hanya Administrator yang dapat menghapus akun Administrator'
                                : `Hapus user ${user.nip}`
                            }
                            className="btn-tactile px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah User Baru */}
      {isAddOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tambah User Baru</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Buat akun akses dashboard SIMAG</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-5 space-y-4">
              {addError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  NIP / User ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newNip}
                  onChange={(e) => setNewNip(e.target.value.toUpperCase())}
                  placeholder="Contoh: 9821012XYZ"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Role Akses <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as SimagRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  {ROLE_OPTIONS.map(role => (
                    <option
                      key={role}
                      value={role}
                      disabled={!isAdmin && role === 'Administrator'}
                    >
                      {role}{!isAdmin && role === 'Administrator' ? ' (Khusus Admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password (min. 6 karakter) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password awal"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Konfirmasi Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Simpan User Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ganti Password */}
      {passwordTarget && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPasswordTarget(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Ganti Password User</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {passwordTarget.nip} · {passwordTarget.nama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-5 space-y-4">
              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password Baru (min. 6 karakter) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showUpdatedPwd ? 'text' : 'password'}
                    value={updatedPassword}
                    onChange={(e) => setUpdatedPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    autoFocus
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpdatedPwd(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    {showUpdatedPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Konfirmasi Password Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showUpdatedPwd ? 'text' : 'password'}
                  value={confirmUpdatedPassword}
                  onChange={(e) => setConfirmUpdatedPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Simpan Password Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus User */}
      {deleteTarget && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Hapus User</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {deleteTarget.nip} · {deleteTarget.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun <strong>{deleteTarget.nama}</strong> (<span className="font-mono font-bold">{deleteTarget.nip}</span>)? Akun ini tidak akan dapat lagi masuk ke dashboard SIMAG.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="btn-tactile px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Ya, Hapus User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
