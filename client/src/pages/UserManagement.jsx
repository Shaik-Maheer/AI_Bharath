import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import EmptyState from '../components/EmptyState';

function editableUser(user) {
  return { role: user.role, department: user.department };
}

export default function UserManagement() {
  usePageTitle('User Management');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(['admin', 'reviewer', 'viewer']);
  const [departments, setDepartments] = useState(['Legal']);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer', department: 'Legal' });
  const { notify } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [usersRes, metaRes] = await Promise.all([api.get('/users'), api.get('/users/meta')]);
      setUsers(usersRes.data.users || []);
      setRoles(metaRes.data.roles || ['admin', 'reviewer', 'viewer']);
      setDepartments(metaRes.data.departments || ['Legal']);
      const nextEdits = {};
      (usersRes.data.users || []).forEach((user) => {
        nextEdits[user.id] = editableUser(user);
      });
      setEdits(nextEdits);
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setEdit(userId, field, value) {
    setEdits((current) => ({ ...current, [userId]: { ...(current[userId] || {}), [field]: value } }));
  }

  async function saveUser(userId) {
    setSavingId(userId);
    try {
      await api.put(`/users/${userId}`, edits[userId]);
      notify('User updated.');
      await load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setSavingId('');
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', newUser);
      notify('User created.');
      setNewUser({ name: '', email: '', password: '', role: 'viewer', department: departments[0] || 'Legal' });
      await load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">Admin User Governance</h1>
        <p className="mt-1 text-sm text-slate-600">Manage accounts, assign departments, and control role-based workflow access.</p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
        <h2 className="text-lg font-extrabold text-navy">Create User</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="Full name" className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold" />
          <input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="Email" className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold" />
          <input required value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="Temp password" className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold" />
          <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold">
            {roles.map((role) => <option key={role}>{role}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })} className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold">
              {departments.map((department) => <option key={department}>{department}</option>)}
            </select>
            <button disabled={creating} className="focus-ring inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
        <h2 className="text-lg font-extrabold text-navy">Existing Users</h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading users...</p>
        ) : users.length ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-3 md:hidden">
              {users.map((user) => (
                <div key={user.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-extrabold text-navy">{user.name}</p>
                  <p className="mt-1 break-all text-xs text-slate-600">{user.email}</p>
                  <div className="mt-3 grid gap-3">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Role
                      <select value={edits[user.id]?.role || user.role} onChange={(event) => setEdit(user.id, 'role', event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-2 text-sm outline-none focus:border-gold">
                        {roles.map((role) => <option key={role}>{role}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Department
                      <select value={edits[user.id]?.department || user.department} onChange={(event) => setEdit(user.id, 'department', event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-2 text-sm outline-none focus:border-gold">
                        {departments.map((department) => <option key={department}>{department}</option>)}
                      </select>
                    </label>
                    <button onClick={() => saveUser(user.id)} disabled={savingId === user.id} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold px-3 py-2 text-sm font-bold text-navy disabled:opacity-50">
                      <Save className="h-4 w-4" />
                      {savingId === user.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Department</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell font-semibold text-navy">{user.name}</td>
                      <td className="table-cell">{user.email}</td>
                      <td className="table-cell">
                        <select value={edits[user.id]?.role || user.role} onChange={(event) => setEdit(user.id, 'role', event.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-gold">
                          {roles.map((role) => <option key={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="table-cell">
                        <select value={edits[user.id]?.department || user.department} onChange={(event) => setEdit(user.id, 'department', event.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-gold">
                          {departments.map((department) => <option key={department}>{department}</option>)}
                        </select>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => saveUser(user.id)} disabled={savingId === user.id} className="focus-ring inline-flex items-center gap-2 rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-50">
                          <Save className="h-4 w-4" />
                          {savingId === user.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No users found" message="Create governance users to separate reviewer/admin/viewer workflows." />
          </div>
        )}
      </section>
    </div>
  );
}
