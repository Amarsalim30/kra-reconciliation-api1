"use client";

import { useState } from "react";
import { UserRecord, UserCreatePayload, UserUpdatePayload, UserRole } from "@/types/company";
import { fetchWithAuth } from "@/lib/api";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Eye,
  Edit3,
  X,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  ToggleLeft,
  ToggleRight,
  BadgeCheck,
} from "lucide-react";

interface UserManagementCardProps {
  users: UserRecord[];
  currentUserId: number;
  onSaved: () => void;
}

const ROLE_META: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin",
    color: "bg-violet-100 text-violet-800 border border-violet-200",
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  checker: {
    label: "Checker",
    color: "bg-blue-100 text-blue-800 border border-blue-200",
    icon: <BadgeCheck className="w-3 h-3" />,
  },
  viewer: {
    label: "Viewer",
    color: "bg-slate-100 text-slate-700 border border-slate-200",
    icon: <Eye className="w-3 h-3" />,
  },
};

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role] || ROLE_META.viewer;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// --- Create User Modal ---
interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("checker");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: UserCreatePayload = {
        username,
        password,
        email: email || undefined,
        full_name: fullName || undefined,
        role,
      };
      const res = await fetchWithAuth("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create user.");
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Create New User</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Username *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john.doe"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="checker">Checker</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Reset Password Modal ---
interface ResetPasswordModalProps {
  user: UserRecord;
  onClose: () => void;
  onReset: () => void;
}

function ResetPasswordModal({ user, onClose, onReset }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to reset password.");
      }
      setSuccess(true);
      onReset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-sm">Reset Password — {user.username}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleReset} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Password reset successfully.
            </div>
          )}
          {!success && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
              {success ? "Close" : "Cancel"}
            </button>
            {!success && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Reset
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit User Inline Row ---
interface EditUserRowProps {
  user: UserRecord;
  onSaved: () => void;
  onCancel: () => void;
}

function EditUserRow({ user, onSaved, onCancel }: EditUserRowProps) {
  const [role, setRole] = useState<UserRole>(user.role as UserRole);
  const [email, setEmail] = useState(user.email || "");
  const [fullName, setFullName] = useState(user.full_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: UserUpdatePayload = { role, email: email || undefined, full_name: fullName || undefined };
      const res = await fetchWithAuth(`/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save.");
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-blue-50/50 border-t border-blue-100">
      <td className="px-4 py-3" colSpan={5}>
        {error && (
          <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">{error}</div>
        )}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-600 uppercase">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-600 uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-600 uppercase">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="checker">Checker</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// --- Main Component ---
export function UserManagementCard({ users, currentUserId, onSaved }: UserManagementCardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleToggleActive = async (user: UserRecord) => {
    if (user.id === currentUserId) return;
    setTogglingId(user.id);
    try {
      await fetchWithAuth(`/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      onSaved();
    } catch {
      // silently fail; list will stay stale until next refresh
    } finally {
      setTogglingId(null);
    }
  };

  const resetUser = users.find((u) => u.id === resetUserId);

  return (
    <>
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={onSaved}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUserId(null)}
          onReset={onSaved}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <Users className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Team Members</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {users.length} user{users.length !== 1 ? "s" : ""} · Manage roles and access levels
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        {/* Role Legend */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Roles:</span>
          {(Object.entries(ROLE_META) as [UserRole, typeof ROLE_META[UserRole]][]).map(([role, meta]) => (
            <span key={role} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>
              {meta.icon} {meta.label}
            </span>
          ))}
          <span className="text-[11px] text-slate-400 ml-auto">
            Admin: full access · Checker: reconciliation · Viewer: read-only
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <>
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-50/70 transition-colors ${!user.is_active ? "opacity-60" : ""}`}
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          user.role === "admin"
                            ? "bg-violet-100 text-violet-800"
                            : user.role === "checker"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {(user.full_name || user.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                            {user.full_name || user.username}
                            {user.id === currentUserId && (
                              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">You</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">@{user.username} {user.email ? `· ${user.email}` : ""}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role as UserRole} />
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={user.id === currentUserId || togglingId === user.id}
                        title={user.id === currentUserId ? "You cannot deactivate your own account" : undefined}
                        className="flex items-center gap-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
                      >
                        {togglingId === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : user.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                        <span className={user.is_active ? "text-emerald-700" : "text-slate-500"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(user.last_login_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title="Edit user"
                        >
                          {editingId === user.id ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setResetUserId(user.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          title="Reset password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline Edit Row */}
                  {editingId === user.id && (
                    <EditUserRow
                      key={`edit-${user.id}`}
                      user={user}
                      onSaved={() => { setEditingId(null); onSaved(); }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No users found. Click &quot;Invite User&quot; to add the first team member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
