import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Edit, 
  ExternalLink, 
  MousePointer, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  Eye,
  Zap,
  Globe
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminEmptyState } from './admin/AdminEmptyState';

export interface SmartLinkItem {
  _id: string;
  title: string;
  url: string;
  contentType: 'general' | 'movie' | 'tvshow';
  priority: number;
  isActive: boolean;
  clickCount: number;
  lastClicked?: string;
  createdAt: string;
  updatedAt?: string;
}

const AdminAdsManagement: React.FC = () => {
  const [links, setLinks] = useState<SmartLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'general' | 'movie' | 'tvshow'>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SmartLinkItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<SmartLinkItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formContentType, setFormContentType] = useState<'general' | 'movie' | 'tvshow'>('general');
  const [formPriority, setFormPriority] = useState(10);
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/smartlinks');
      const data = res.data?.data || res.data || [];
      if (Array.isArray(data)) {
        setLinks(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch affiliate links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleOpenCreate = () => {
    setEditingLink(null);
    setFormTitle('');
    setFormUrl('');
    setFormContentType('general');
    setFormPriority(10);
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: SmartLinkItem) => {
    setEditingLink(item);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormContentType(item.contentType || 'general');
    setFormPriority(item.priority ?? 10);
    setFormIsActive(item.isActive !== false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) {
      setError('Title and URL are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: formTitle.trim(),
        url: formUrl.trim(),
        contentType: formContentType,
        priority: Number(formPriority) || 0,
        isActive: formIsActive,
        autoSync: false
      };

      if (editingLink) {
        await api.put(`/api/smartlinks/${editingLink._id}`, payload);
        showNotification('Affiliate link updated successfully!');
      } else {
        await api.post('/api/smartlinks', payload);
        showNotification('Affiliate link created successfully!');
      }

      setModalOpen(false);
      await fetchLinks();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save link');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: SmartLinkItem) => {
    try {
      await api.put(`/api/smartlinks/${item._id}`, {
        isActive: !item.isActive
      });
      setLinks(prev =>
        prev.map(l => (l._id === item._id ? { ...l, isActive: !item.isActive } : l))
      );
      showNotification(`Link marked as ${!item.isActive ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!linkToDelete) return;
    try {
      setDeleting(true);
      await api.delete(`/api/smartlinks/${linkToDelete._id}`);
      setLinks(prev => prev.filter(l => l._id !== linkToDelete._id));
      setDeleteModalOpen(false);
      setLinkToDelete(null);
      showNotification('Affiliate link deleted');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete link');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered links
  const filteredLinks = links.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.contentType === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate stats
  const totalClicks = links.reduce((acc, curr) => acc + (curr.clickCount || 0), 0);
  const activeCount = links.filter(l => l.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-red-950/40 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Affiliates & SmartLinks Management
            </h2>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Manage your high-converting VPN affiliate campaigns, smartlinks, and ad links with live click tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-2 shadow-md shadow-red-600/30 transition shrink-0 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Affiliate Link</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-mono text-neutral-400 tracking-wider">Total Links</p>
            <h3 className="text-2xl font-bold text-white mt-1">{links.length}</h3>
          </div>
          <div className="p-3 bg-neutral-800 rounded-xl text-neutral-300">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-mono text-neutral-400 tracking-wider">Active Campaigns</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</h3>
          </div>
          <div className="p-3 bg-emerald-950/50 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-mono text-neutral-400 tracking-wider">Total Recorded Clicks</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{totalClicks.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-amber-950/50 text-amber-400 rounded-xl border border-amber-500/20">
            <MousePointer className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-white">Dismiss</button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-emerald-400 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by title or URL..."
            className="pl-9 bg-neutral-950 border-neutral-800 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs font-semibold">
            {(['all', 'general', 'movie', 'tvshow'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded capitalize transition ${
                  filterType === type
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLinks}
            className="border-neutral-800 text-neutral-400 hover:text-white shrink-0"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Links Table */}
      {loading && links.length === 0 ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading affiliate links..." />
        </div>
      ) : filteredLinks.length === 0 ? (
        <AdminEmptyState
          title="No Affiliate Links Found"
          description={
            searchTerm
              ? 'No links match your search query.'
              : 'You have not added any affiliate or smartlinks yet. Click "Add Affiliate Link" to create your first VPN campaign!'
          }
        />
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-xs uppercase font-mono text-neutral-400 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Title & Destination</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Clicks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {filteredLinks.map(item => (
                  <tr key={item._id} className="hover:bg-neutral-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{item.title}</span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 mt-0.5 truncate max-w-xs sm:max-w-md"
                      >
                        <span className="truncate">{item.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block text-xs uppercase font-mono px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-300">
                        {item.contentType || 'general'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono font-bold text-neutral-200">
                      {item.priority ?? 0}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <MousePointer className="w-3 h-3" />
                        {item.clickCount ?? 0}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                          item.isActive
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {item.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-neutral-500" />
                            <span>Disabled</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLinkToDelete(item);
                            setDeleteModalOpen(true);
                          }}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Shield className="w-5 h-5 text-red-500" />
              <span>{editingLink ? 'Edit Affiliate Link' : 'Add New Affiliate Link'}</span>
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              Configure your affiliate link parameters. High priority links will be shown first to users.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Campaign Title *
              </label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Surfshark VPN (82% Off + 3 Months Free)"
                required
                className="bg-neutral-900 border-neutral-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Affiliate / Destination URL *
              </label>
              <Input
                type="url"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="https://surfshark.club/c/YOUR_AFFILIATE_ID"
                required
                className="bg-neutral-900 border-neutral-800 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Category
                </label>
                <select
                  value={formContentType}
                  onChange={e => setFormContentType(e.target.value as any)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-200 outline-none focus:border-red-500"
                >
                  <option value="general">General (All Pages & Players)</option>
                  <option value="movie">Movies Only</option>
                  <option value="tvshow">TV Shows Only</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Display Priority
                </label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={e => setFormPriority(parseInt(e.target.value) || 0)}
                  placeholder="10"
                  className="bg-neutral-900 border-neutral-800 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="linkIsActive"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-neutral-700 bg-neutral-900"
              />
              <label htmlFor="linkIsActive" className="text-xs text-neutral-300 cursor-pointer">
                Campaign is active (immediately display to visitors)
              </label>
            </div>

            <DialogFooter className="pt-4 border-t border-neutral-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {saving ? 'Saving...' : editingLink ? 'Update Campaign' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-400">Delete Affiliate Link</DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              Are you sure you want to delete <strong className="text-white">"{linkToDelete?.title}"</strong>? This will remove the link and its click history.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteModalOpen(false)}
              className="text-neutral-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAdsManagement;
