import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import {
  Users,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Heart,
  Activity,
  BookOpen,
  CheckSquare,
  Edit,
  Save,
  X
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPagination } from './admin/AdminPagination';
import { AdminEmptyState } from './admin/AdminEmptyState';

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  isActive: boolean;
  lastLogin?: string;
  loginCount: number;
  createdAt: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    bio?: string;
    location?: string;
    website?: string;
  };
  preferences?: {
    assistantName: string;
    theme: 'light' | 'dark';
    language: string;
  };
}

interface UserStats {
  watchlist: number;
  watchHistory: number;
  memories: number;
  tasks: number;
}

const AdminUserManagement: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter && roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter && statusFilter !== 'all' && { isActive: statusFilter }),
        sortBy,
        order: sortOrder
      });

      const response = await api.get(`/api/admin/users?${params}`);
      setUsers(response.data.data.users);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalItems(response.data.data.pagination.total || 0);
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, roleFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchUserDetails = async (userId: string, openInEditMode: boolean = false) => {
    try {
      setLoadingUserDetails(true);
      setShowUserDetails(false); // Hide modal while loading
      setIsEditing(false); // Reset edit mode
      const response = await api.get(`/api/admin/users/${userId}`);
      
      if (response.data && response.data.success && response.data.data) {
        const userData = response.data.data.user;
        setSelectedUser(userData);
        setUserStats({
          watchlist: response.data.data.watchlist?.length || 0,
          watchHistory: response.data.data.watchHistory?.length || 0,
          memories: response.data.data.memories?.length || 0,
          tasks: response.data.data.tasks?.length || 0
        });
        
        // If opening in edit mode, set up the form data
        if (openInEditMode) {
          setEditFormData({
            username: userData.username,
            email: userData.email,
            role: userData.role,
            isActive: userData.isActive,
            profile: { ...userData.profile },
            preferences: {
              assistantName: userData.preferences?.assistantName || 'Alex',
              theme: userData.preferences?.theme || 'light',
              language: userData.preferences?.language || 'en'
            }
          });
          setIsEditing(true);
        }
        
        setShowUserDetails(true);
      } else {
        showToast('Failed to fetch user details: Invalid response', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch user details', 'error');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const response = await api.put(`/api/admin/users/${userId}`, updates);
      if (!response.data || !response.data.success || !response.data.data) {
        throw new Error('Invalid response from server');
      }
      const updatedUser = response.data.data;
      
      // Update users list
      setUsers(prevUsers => prevUsers.map(user => user._id === userId ? updatedUser : user));
      
      return updatedUser;
    } catch (err: any) {
      throw err;
    }
  };

  const handleEditClick = () => {
    if (selectedUser) {
      setEditFormData({
        username: selectedUser.username,
        email: selectedUser.email,
        role: selectedUser.role,
        isActive: selectedUser.isActive,
        profile: { ...selectedUser.profile },
        preferences: {
          assistantName: selectedUser.preferences?.assistantName || 'Alex',
          theme: selectedUser.preferences?.theme || 'light',
          language: selectedUser.preferences?.language || 'en'
        }
      });
      setIsEditing(true);
    } else {
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    try {
      setSaving(true);
      
      // Prepare the update payload - only include defined values
      const updates: Partial<User> = {};
      
      if (editFormData.username !== undefined && editFormData.username.trim() !== '') {
        updates.username = editFormData.username.trim();
      }
      
      if (editFormData.email !== undefined && editFormData.email.trim() !== '') {
        updates.email = editFormData.email.trim();
      }
      
      if (editFormData.role !== undefined) {
        updates.role = editFormData.role;
      }
      
      if (editFormData.isActive !== undefined) {
        updates.isActive = editFormData.isActive;
      }
      
      // Clean up profile object - remove empty strings
      if (editFormData.profile) {
        const cleanedProfile: any = {};
        Object.keys(editFormData.profile).forEach(key => {
          const value = (editFormData.profile as any)[key];
          if (value !== undefined && value !== null && value !== '') {
            cleanedProfile[key] = value;
          }
        });
        if (Object.keys(cleanedProfile).length > 0) {
          updates.profile = cleanedProfile;
        }
      }
      
      // Always include preferences if they exist
      if (editFormData.preferences) {
        updates.preferences = editFormData.preferences;
      }
      
      const updatedUser = await updateUser(selectedUser._id, updates);
      
      // Refresh the users list first
      await fetchUsers();
      
      // Refetch the full user details to get all related data (watchlist, history, etc.)
      const response = await api.get(`/api/admin/users/${selectedUser._id}`);
      if (response.data && response.data.success && response.data.data) {
        setSelectedUser(response.data.data.user);
        setUserStats({
          watchlist: response.data.data.watchlist?.length || 0,
          watchHistory: response.data.data.watchHistory?.length || 0,
          memories: response.data.data.memories?.length || 0,
          tasks: response.data.data.tasks?.length || 0
        });
      } else {
        // Fallback to the updated user from the update response
        setSelectedUser(updatedUser);
      }
      
      setIsEditing(false);
      setEditFormData({});
      
      // Show success message
      showToast('User updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update user. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await updateUser(userId, { isActive });
      showToast(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update user status', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(users.filter(user => user._id !== userId));
      showToast('User deactivated successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to deactivate user', 'error');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'admin':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        <XCircle className="h-3 w-3 mr-1" />
        Inactive
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && users.length === 0) {
    return (
      <LoadingSpinner fullScreen text="Loading users..." color="red" size="xl" />
    );
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Filters and Search Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="var(--sys-cyan)" />
            <span>User Search &amp; Filter Directives</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {totalItems} Registered Accounts
          </span>
        </div>
        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 text-white placeholder-gray-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sort By
              </label>
              <Select 
                value={`${sortBy}-${sortOrder}`} 
                onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="username-asc">Username A-Z</SelectItem>
                  <SelectItem value="username-desc">Username Z-A</SelectItem>
                  <SelectItem value="lastLogin-desc">Last Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Directory Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} />
            <span>User Accounts Directory</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">
            Page {currentPage} of {totalPages || 1}
          </span>
        </div>

        <div className="ctrl-panel-body p-0">
          {users.length === 0 ? (
            <AdminEmptyState
              icon={<Users size={28} />}
              title="No Users Found"
              description="No user accounts match the current filter or search criteria."
            />
          ) : (
            <>
              {/* Users Table - Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--sys-border)]">
              <thead className="bg-gray-800/30">
                <tr>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-900/30 divide-y divide-gray-800/30">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-3 sm:ml-4 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {user.username}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      {getStatusBadge(user.isActive)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-400">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => fetchUserDetails(user._id)}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-none transition-all border border-transparent hover:border-blue-500/30"
                          title="View Details"
                          aria-label="View user details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => fetchUserDetails(user._id, true)}
                          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-none transition-all border border-transparent hover:border-yellow-500/30"
                          title="Edit User"
                          aria-label="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user._id, !user.isActive)}
                          className={`p-2 rounded-lg transition-all ${
                            user.isActive 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                          }`}
                          title={user.isActive ? "Deactivate User" : "Activate User"}
                          aria-label={user.isActive ? "Deactivate user" : "Activate user"}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteUser(user._id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete User"
                          aria-label="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {users.map((user) => (
            <div key={user._id} className="bg-gray-900/50 backdrop-blur-sm rounded-none border border-gray-800/50 p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-white truncate">
                      {user.username}
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  <button
                    onClick={() => fetchUserDetails(user._id)}
                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-none transition-all border border-transparent hover:border-blue-500/30"
                    title="View Details"
                    aria-label="View user details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fetchUserDetails(user._id, true)}
                    className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-none transition-all border border-transparent hover:border-yellow-500/30"
                    title="Edit User"
                    aria-label="Edit user"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleUserStatus(user._id, !user.isActive)}
                    className={`p-2 rounded-lg transition-all ${
                      user.isActive 
                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' 
                        : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                    }`}
                    title={user.isActive ? "Deactivate User" : "Activate User"}
                    aria-label={user.isActive ? "Deactivate user" : "Activate user"}
                  >
                    {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => deleteUser(user._id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete User"
                    aria-label="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Role</div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                    {user.role.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  {getStatusBadge(user.isActive)}
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-gray-800/50">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Last Login:</span>
                  <span className="text-gray-300">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-gray-300">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {/* End of mobile list */}
        </div>
      </>
    )}
  </div>

  {/* Standardized Pagination Bar */}
  {totalPages > 1 && (
    <div className="p-3 border-t border-[var(--sys-border)] bg-[var(--sys-surface)]">
      <AdminPagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={itemsPerPage}
        onPageChange={setCurrentPage}
        itemName="users"
      />
    </div>
  )}
</div>

        {/* User Details Modal */}
        {loadingUserDetails && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="text-center">
              <LoadingSpinner text="Loading user details..." color="red" size="lg" />
            </div>
          </div>
        )}
        {showUserDetails && selectedUser && !loadingUserDetails && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50 p-4">
            <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-6 border w-full sm:w-11/12 md:w-3/4 lg:w-1/2 shadow-2xl rounded-none bg-gray-900/50 backdrop-blur-sm border-gray-800/50 max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-500/20 rounded-none border border-red-500/30">
                      <Users className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      {isEditing ? 'Edit User' : 'User Details'}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!isEditing && (
                      <button
                        onClick={handleEditClick}
                        className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-none transition-all border border-transparent hover:border-yellow-500/30"
                        title="Edit User"
                        aria-label="Edit user"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowUserDetails(false);
                        setIsEditing(false);
                        setEditFormData({});
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-none transition-all border border-transparent hover:border-gray-700/50"
                      aria-label="Close user details"
                    >
                      <XCircle className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Basic Info */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Username
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            id="edit-username"
                            name="username"
                            value={editFormData.username || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Username"
                            placeholder="Enter username"
                          />
                        ) : (
                          <p className="text-white font-medium">
                            {selectedUser.username}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Email
                        </label>
                        {isEditing ? (
                          <input
                            type="email"
                            id="edit-email"
                            name="email"
                            value={editFormData.email || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Email"
                            placeholder="Enter email"
                          />
                        ) : (
                          <p className="text-white font-medium">
                            {selectedUser.email}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Role
                        </label>
                        {isEditing ? (
                          <Select
                            value={editFormData.role || 'user'}
                            onValueChange={(value) => setEditFormData({ ...editFormData, role: value as 'user' | 'admin' | 'super_admin' })}
                          >
                            <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(selectedUser.role)}`}>
                            {selectedUser.role.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Status
                        </label>
                        {isEditing ? (
                          <Select
                            value={editFormData.isActive ? 'true' : 'false'}
                            onValueChange={(value) => setEditFormData({ ...editFormData, isActive: value === 'true' })}
                          >
                            <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="true">Active</SelectItem>
                              <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-1">
                            {getStatusBadge(selectedUser.isActive)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Activity Stats */}
                  {userStats && (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">
                        Activity Statistics
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-800/50 rounded-none border border-gray-700/50">
                          <Heart className="h-6 w-6 text-red-400 mx-auto mb-2" />
                          <p className="text-lg font-bold text-white">
                            {userStats.watchlist}
                          </p>
                          <p className="text-xs text-gray-400">
                            Watchlist
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-800/50 rounded-none border border-gray-700/50">
                          <Activity className="h-6 w-6 text-green-400 mx-auto mb-2" />
                          <p className="text-lg font-bold text-white">
                            {userStats.watchHistory}
                          </p>
                          <p className="text-xs text-gray-400">
                            Watch History
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-800/50 rounded-none border border-gray-700/50">
                          <BookOpen className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                          <p className="text-lg font-bold text-white">
                            {userStats.memories}
                          </p>
                          <p className="text-xs text-gray-400">
                            Memories
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-800/50 rounded-none border border-gray-700/50">
                          <CheckSquare className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                          <p className="text-lg font-bold text-white">
                            {userStats.tasks}
                          </p>
                          <p className="text-xs text-gray-400">
                            Tasks
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profile Information */}
                  {isEditing && (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">
                        Profile Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            First Name
                          </label>
                          <input
                            type="text"
                            id="edit-firstname"
                            name="firstName"
                            value={editFormData.profile?.firstName || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              profile: { ...editFormData.profile, firstName: e.target.value }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="First Name"
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            id="edit-lastname"
                            name="lastName"
                            value={editFormData.profile?.lastName || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              profile: { ...editFormData.profile, lastName: e.target.value }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Last Name"
                            placeholder="Enter last name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Bio
                          </label>
                          <textarea
                            id="edit-bio"
                            name="bio"
                            value={editFormData.profile?.bio || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              profile: { ...editFormData.profile, bio: e.target.value }
                            })}
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Bio"
                            placeholder="Enter bio"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Location
                          </label>
                          <input
                            type="text"
                            id="edit-location"
                            name="location"
                            value={editFormData.profile?.location || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              profile: { ...editFormData.profile, location: e.target.value }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Location"
                            placeholder="Enter location"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Website
                          </label>
                          <input
                            type="url"
                            id="edit-website"
                            name="website"
                            value={editFormData.profile?.website || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              profile: { ...editFormData.profile, website: e.target.value }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Website"
                            placeholder="Enter website URL"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preferences */}
                  {isEditing && (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">
                        Preferences
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Assistant Name
                          </label>
                          <input
                            type="text"
                            id="edit-assistantname"
                            name="assistantName"
                            value={editFormData.preferences?.assistantName || 'Alex'}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              preferences: {
                                assistantName: e.target.value,
                                theme: editFormData.preferences?.theme || 'light',
                                language: editFormData.preferences?.language || 'en'
                              }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Assistant Name"
                            placeholder="Enter assistant name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Theme
                          </label>
                          <Select
                            value={editFormData.preferences?.theme || 'light'}
                            onValueChange={(value) => setEditFormData({
                              ...editFormData,
                              preferences: {
                                assistantName: editFormData.preferences?.assistantName || 'Alex',
                                theme: value as 'light' | 'dark',
                                language: editFormData.preferences?.language || 'en'
                              }
                            })}
                          >
                            <SelectTrigger className="w-full bg-gray-800/50 border-gray-700/50 text-white rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Language
                          </label>
                          <input
                            type="text"
                            id="edit-language"
                            name="language"
                            value={editFormData.preferences?.language || 'en'}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              preferences: {
                                assistantName: editFormData.preferences?.assistantName || 'Alex',
                                theme: editFormData.preferences?.theme || 'light',
                                language: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-none text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                            aria-label="Language"
                            placeholder="Enter language code"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Info */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Account Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Created
                        </label>
                        <p className="text-white font-medium">
                          {formatDate(selectedUser.createdAt)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Last Login
                        </label>
                        <p className="text-white font-medium">
                          {selectedUser.lastLogin ? formatDate(selectedUser.lastLogin) : 'Never'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Login Count
                        </label>
                        <p className="text-white font-medium">
                          {selectedUser.loginCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-4">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-6 py-2.5 border border-gray-600/50 rounded-none text-sm font-medium text-gray-300 bg-gray-800/50 hover:bg-gray-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <X className="h-4 w-4" />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-6 py-2.5 border border-red-500/50 rounded-none text-sm font-medium text-white bg-red-500/20 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setShowUserDetails(false);
                        setIsEditing(false);
                        setEditFormData({});
                      }}
                      className="px-6 py-2.5 border border-gray-600/50 rounded-none text-sm font-medium text-gray-300 bg-gray-800/50 hover:bg-gray-700/50 transition-all"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default AdminUserManagement;