import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import './admin/admin.css';
import {
  RefreshCw,
  LogOut,
  ExternalLink,
  Pin,
  PinOff,
  Share2,
  Globe,
  Database,
  Search,
  BarChart3,
  Zap,
  Film,
  Tv,
  Users,
  Shield,
  Cpu,
  LayoutDashboard,
  Clock,
  Menu,
  ScrollText,
  FileText,
  Ban,
  Lock,
  Key,
  X
} from 'lucide-react';

import {
  TelegramBrandIcon,
  BlueskyBrandIcon,
  TumblrBrandIcon,
  TwitterBrandIcon,
  RedditBrandIcon,
  PinterestBrandIcon
} from './admin/SocialBrandIcons';
import { useAuth } from '../contexts/AuthContext';

// Admin Subcomponents
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import AdminContentManagement from './AdminContentManagement';
import AdminGenreManagement from './AdminGenreManagement';
import AdminStreamingManagement from './AdminStreamingManagement';
import AdminSyncManagement from './AdminSyncManagement';
import AdminSystemHealth from './AdminSystemHealth';
import AutoSyncPanel from './AutoSyncPanel';
import AdminActivity from './AdminActivity';
import AdminHistoryManagement from './AdminHistoryManagement';
import ComingSoon from './admin/ComingSoon';
import AdminAnalyticsUsers from './AdminAnalyticsUsers';
import AdminAnalyticsContent from './AdminAnalyticsContent';
import AdminAnalyticsSystem from './AdminAnalyticsSystem';
import AdminAnalyticsReports from './AdminAnalyticsReports';
import AdminUserActivity from './AdminUserActivity';
import AdminLogoManagement from './AdminLogoManagement';
import AdminTelegramManagement from './AdminTelegramManagement';
import AdminTwitterManagement from './AdminTwitterManagement';
import AdminRedditManagement from './AdminRedditManagement';
import AdminPinterestManagement from './AdminPinterestManagement';
import AdminBlueskyManagement from './AdminBlueskyManagement';
import AdminTumblrManagement from './AdminTumblrManagement';
import AdminSearchConsole from './AdminSearchConsole';
import AdminOpenGraph from './AdminOpenGraph';
import AdminAdsManagement from './AdminAdsManagement';

interface SubNavItem {
  title: string;
  path: string;
  icon: React.FC<any> | React.ComponentType<any>;
  badge?: string;
  ledColor?: 'green' | 'amber' | 'cyan' | 'red';
}

interface PrimaryNavItem {
  id: string;
  title: string;
  path: string;
  icon: React.FC<any> | React.ComponentType<any>;
  basePath: string;
  children?: SubNavItem[];
}

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Pin state for sidebar rail (stored in localStorage)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('movie_admin_pinned') === 'true';
    }
    return false;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lock permanently to dark mode (no light mode)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    localStorage.setItem('movie_admin_theme', 'dark');
  }, []);

  const handleTogglePin = () => {
    setIsPinned(prev => {
      const next = !prev;
      localStorage.setItem('movie_admin_pinned', String(next));
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const isExpanded = isPinned || isHovered;

  // Primary navigation items definition
  const primaryNavItems: PrimaryNavItem[] = useMemo(() => [
    {
      id: 'dashboard',
      title: 'Dashboard',
      path: '/admin/dashboard',
      basePath: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'content',
      title: 'Content',
      path: '/admin/content/movies',
      basePath: '/admin/content',
      icon: Film,
      children: [
        { title: 'Movies', path: '/admin/content/movies', icon: Film, ledColor: 'green' },
        { title: 'TV Shows', path: '/admin/content/tvshows', icon: Tv, ledColor: 'cyan' },
        { title: 'Genres', path: '/admin/content/genres', icon: Globe, ledColor: 'amber' },
        { title: 'Streaming', path: '/admin/content/streaming', icon: Zap, ledColor: 'green' },
        { title: 'Sync Control', path: '/admin/content/sync', icon: RefreshCw, ledColor: 'cyan' },
        { title: 'Affiliates & Ads', path: '/admin/content/ads', icon: Shield, ledColor: 'red' }
      ]
    },
    {
      id: 'social',
      title: 'Social Media',
      path: '/admin/system/telegram',
      basePath: '/admin/system/social',
      icon: Share2,
      children: [
        { title: 'Telegram', path: '/admin/system/telegram', icon: TelegramBrandIcon, ledColor: 'cyan' },
        { title: 'Bluesky', path: '/admin/system/bluesky', icon: BlueskyBrandIcon, ledColor: 'cyan' },
        { title: 'Tumblr', path: '/admin/system/tumblr', icon: TumblrBrandIcon, ledColor: 'amber' },
        { title: 'Twitter / X', path: '/admin/system/twitter', icon: TwitterBrandIcon, ledColor: 'cyan' },
        { title: 'Reddit', path: '/admin/system/reddit', icon: RedditBrandIcon, ledColor: 'amber' },
        { title: 'Pinterest', path: '/admin/system/pinterest', icon: PinterestBrandIcon, ledColor: 'red' },
        { title: 'Open Graph', path: '/admin/system/open-graph', icon: Share2, ledColor: 'green' }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics',
      path: '/admin/analytics/users',
      basePath: '/admin/analytics',
      icon: BarChart3,
      children: [
        { title: 'User Overview', path: '/admin/analytics/users', icon: Users, ledColor: 'green' },
        { title: 'User Activity', path: '/admin/analytics/activity', icon: Clock, ledColor: 'cyan' },
        { title: 'Content Stats', path: '/admin/analytics/content', icon: Film, ledColor: 'amber' },
        { title: 'System Health', path: '/admin/analytics/system', icon: Cpu, ledColor: 'green' },
        { title: 'Reports', path: '/admin/analytics/reports', icon: BarChart3, ledColor: 'cyan' },
        { title: 'Search Console', path: '/admin/analytics/search-console', icon: Search, ledColor: 'amber' }
      ]
    },
    {
      id: 'history',
      title: 'Watch History',
      path: '/admin/history',
      basePath: '/admin/history',
      icon: Clock,
    },
    {
      id: 'users',
      title: 'Users',
      path: '/admin/users',
      basePath: '/admin/users',
      icon: Users,
      children: [
        { title: 'All Users', path: '/admin/users', icon: Users, ledColor: 'green' },
        { title: 'User Roles', path: '/admin/users/roles', icon: Shield, ledColor: 'cyan' },
        { title: 'Activity Audit', path: '/admin/users/activity', icon: Clock, ledColor: 'amber' },
        { title: 'Banned Users', path: '/admin/users/banned', icon: Ban, ledColor: 'red' }
      ]
    },
    {
      id: 'system',
      title: 'System',
      path: '/admin/system/health',
      basePath: '/admin/system',
      icon: Cpu,
      children: [
        { title: 'Health Status', path: '/admin/system/health', icon: Cpu, ledColor: 'green' },
        { title: 'Logo Branding', path: '/admin/system/logo', icon: Film, ledColor: 'cyan' },
        { title: 'Auto Sync Panel', path: '/admin/system/autosync', icon: Zap, ledColor: 'green' },
        { title: 'Database', path: '/admin/system/database', icon: Database, ledColor: 'cyan' },
        { title: 'System Logs', path: '/admin/system/logs', icon: ScrollText, ledColor: 'amber' },
        { title: 'Backups', path: '/admin/system/backups', icon: Database, ledColor: 'cyan' }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      path: '/admin/security/access',
      basePath: '/admin/security',
      icon: Shield,
      children: [
        { title: 'Access Control', path: '/admin/security/access', icon: Lock, ledColor: 'green' },
        { title: 'API Keys', path: '/admin/security/apikeys', icon: Key, ledColor: 'cyan' },
        { title: 'Security Audit', path: '/admin/security/audit', icon: Clock, ledColor: 'amber' },
        { title: 'Active Sessions', path: '/admin/security/sessions', icon: Cpu, ledColor: 'cyan' }
      ]
    }
  ], []);

  // Determine active primary category
  const activeSection = useMemo(() => {
    const current = location.pathname;

    // Check specific social endpoints first
    const isSocialRoute = [
      '/admin/system/telegram',
      '/admin/system/bluesky',
      '/admin/system/tumblr',
      '/admin/system/twitter',
      '/admin/system/reddit',
      '/admin/system/pinterest',
      '/admin/system/open-graph'
    ].some(p => current.startsWith(p));
    if (isSocialRoute) return 'social';

    if (current.startsWith('/admin/dashboard')) return 'dashboard';
    if (current.startsWith('/admin/content')) return 'content';
    if (current.startsWith('/admin/analytics')) return 'analytics';
    if (current.startsWith('/admin/history')) return 'history';
    if (current.startsWith('/admin/users')) return 'users';
    if (current.startsWith('/admin/security')) return 'security';
    if (current.startsWith('/admin/system')) return 'system';

    return 'dashboard';
  }, [location.pathname]);

  // Find matching section definition
  const currentNavGroup = useMemo(() => {
    return primaryNavItems.find(item => item.id === activeSection);
  }, [primaryNavItems, activeSection]);

  // Get current active child title for Child Toolbar
  const currentToolbarInfo = useMemo(() => {
    if (!currentNavGroup) return { title: 'Dashboard', icon: LayoutDashboard };
    if (!currentNavGroup.children) {
      return { title: currentNavGroup.title, icon: currentNavGroup.icon };
    }
    const currentChild = currentNavGroup.children.find(child => location.pathname === child.path);
    if (currentChild) {
      return { title: currentChild.title, icon: currentChild.icon };
    }
    return { title: currentNavGroup.title, icon: currentNavGroup.icon };
  }, [currentNavGroup, location.pathname]);

  // Access validation
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return (
      <div className="sys-admin-root flex items-center justify-center min-h-screen">
        <div className="ctrl-panel p-8 max-w-md text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-[var(--sys-text-muted)] mb-6">
            You don't have administrative privileges to access this console.
          </p>
          <button
            onClick={() => navigate('/movies')}
            className="app-btn app-btn-primary app-btn-md w-full"
          >
            Return to Movies
          </button>
        </div>
      </div>
    );
  }

  const ToolbarIcon = currentToolbarInfo.icon;

  return (
    <div className="sys-admin-root">
      {/* 1. TOP NAVBAR (Standardized 44px Fixed System Header) */}
      <header className="sys-top-navbar">
        {/* Left: Brand Identity & Telemetry */}
        <div className="sys-top-left">
          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            className="sys-icon-btn mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            title={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          >
            {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>

          <Link to="/admin/dashboard" className="sys-brand-link" title="Admin Dashboard">
            <div className="w-5 h-5 rounded-none flex items-center justify-center bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Film size={12} />
            </div>
            <span className="sys-brand-name">Movie Admin</span>
          </Link>

          <div className="sys-v-divider hide-on-mobile" />

          {/* Operational status LED */}
          <div className="sys-telemetry-badge hide-on-mobile">
            <span className="status-led led-green led-pulse" />
            <span className="font-mono text-[11px] text-[var(--sys-text-muted)]">Live</span>
          </div>
        </div>

        {/* Right: Quick Actions & Status */}
        <div className="sys-top-right">
          {/* Auto-Sync Status Pill */}
          <Link
            to="/admin/system/autosync"
            className="sys-pill-btn active-green"
            title="Auto-Sync Engine (Click to Configure)"
          >
            <Zap size={12} color="var(--sys-green)" />
            <strong className="font-mono text-[11px] hide-on-mobile">Sync Live</strong>
          </Link>

          {/* Refresh Data */}
          <button
            type="button"
            className="sys-header-btn"
            onClick={handleRefresh}
            title="Refresh View"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Subtle Vertical Divider */}
          <div className="sys-header-divider hide-on-mobile" />

          {/* Return to Public Streaming Front */}
          <Link to="/movies" title="Open Public Site in New Tab" target="_blank" rel="noopener noreferrer">
            <button
              type="button"
              className="sys-header-btn"
              title="Open Public Site in New Tab"
            >
              <ExternalLink size={13} />
            </button>
          </Link>

          {/* Logout button */}
          <button
            type="button"
            className="sys-header-btn sys-header-btn-danger"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign out of Admin Console"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer (Positioned cleanly below 44px fixed top navbar) */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[44px] z-50 md:hidden flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-x-0 bottom-0 top-[44px] bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] bg-[var(--sys-surface)] border-r border-[var(--sys-border)] h-full overflow-y-auto flex flex-col z-50 p-3 shadow-2xl">
            {/* Navigation Categories and Sub-links */}
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {primaryNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-none text-xs font-semibold transition-all text-left uppercase tracking-wider ${
                        isActive
                          ? 'bg-cyan-500/15 text-cyan-400 border-l-2 border-cyan-400 font-bold'
                          : 'text-zinc-400 hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="flex-1 truncate">{item.title}</span>
                      {isActive && <span className="status-led led-green ml-auto" />}
                    </button>
                    {item.children && (
                      <div className="pl-4 space-y-0.5 border-l border-[var(--sys-border)] ml-3">
                        {item.children.map(sub => {
                          const SubIcon = sub.icon;
                          const isSubActive = location.pathname === sub.path;
                          return (
                            <button
                              key={sub.path}
                              type="button"
                              onClick={() => {
                                navigate(sub.path);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-none text-[11.5px] transition-all text-left ${
                                isSubActive
                                  ? 'text-[var(--sys-cyan)] font-semibold bg-[var(--sys-cyan)]/10'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <SubIcon size={13} />
                              <span className="truncate">{sub.title}</span>
                              {isSubActive && <span className="w-1.5 h-1.5 rounded-none bg-[var(--sys-cyan)] ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer with Logout & Public Site */}
            <div className="pt-3 border-t border-[var(--sys-border)] mt-3 space-y-2">
              <Link
                to="/movies"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-none text-xs font-semibold bg-[var(--sys-panel)] text-[var(--sys-text-muted)] hover:text-[var(--sys-text)] border border-[var(--sys-border)] uppercase tracking-wider"
              >
                <ExternalLink size={13} />
                <span>Public Site</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-none text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/25 transition-colors uppercase tracking-wider"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. BODY SHELL: SIDEBAR RAIL + SUB-SIDEBAR + MAIN VIEWPORT */}
      <div className="sys-body-shell">
        {/* 2.1 PRIMARY SIDEBAR RAIL (48px Auto-collapse, hover/pinned to 190px) */}
        <aside
          className={`sys-sidebar-rail ${isExpanded ? 'expanded' : 'collapsed'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Top pin/unpin indicator */}
          <div className="sidebar-rail-header">
            <span className="rail-header-label">Tabs</span>
            <button
              type="button"
              onClick={handleTogglePin}
              className="rail-pin-btn hide-on-mobile"
              title={isPinned ? 'Unpin Sidebar (Auto-collapse)' : 'Pin Sidebar Open'}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
          </div>

          {/* Primary Nav Menu */}
          <nav className="sys-sidebar-menu">
            {primaryNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 860) setMobileMenuOpen(false);
                  }}
                  className={`sys-nav-item ${isActive ? 'active' : ''}`}
                  title={item.title}
                >
                  <div className="nav-item-icon">
                    <Icon size={17} strokeWidth={isActive ? 2.2 : 1.75} />
                  </div>
                  <div className="nav-item-meta">
                    <span className="nav-item-title">{item.title}</span>
                    <span className={`status-led led-${isActive ? 'cyan' : 'green'} ml-auto`} />
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 2.2 SUB-SIDEBAR: Opens when current primary category has sub-items (175px width) */}
        {currentNavGroup && currentNavGroup.children && currentNavGroup.children.length > 0 && (
          <aside className="sys-sub-sidebar">
            <div className="sub-sidebar-header">
              <span className="sub-sidebar-title">{currentNavGroup.title} Hub</span>
            </div>
            <nav className="sub-sidebar-menu">
              {currentNavGroup.children.map(subItem => {
                const SubIcon = subItem.icon;
                const isSubActive = location.pathname === subItem.path;
                return (
                  <button
                    key={subItem.path}
                    type="button"
                    onClick={() => {
                      navigate(subItem.path);
                      if (window.innerWidth < 860) setMobileMenuOpen(false);
                    }}
                    className={`sys-sub-nav-item ${isSubActive ? 'active' : ''}`}
                    title={subItem.title}
                  >
                    <div className="sub-nav-item-icon">
                      <SubIcon size={16} active={isSubActive} />
                    </div>
                    <span className="sub-nav-item-title">{subItem.title}</span>
                    <span className={`status-led led-${subItem.ledColor || 'green'} ml-auto`} />
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* 2.3 MAIN VIEWPORT */}
        <div className="sys-main-viewport">
          {/* CHILD TOOLBAR (Compact, single-row 44px bar) */}
          <div className="sys-child-toolbar">
            <div className="toolbar-left">
              {ToolbarIcon && (
                <div className="toolbar-icon text-[var(--sys-cyan)]">
                  <ToolbarIcon size={16} />
                </div>
              )}
              <h1 className="toolbar-title">{currentToolbarInfo.title}</h1>
              <span className="sys-badge sys-badge-cyan hide-on-mobile">
                Live
              </span>
            </div>

            <div className="toolbar-actions">
              <button
                type="button"
                className="sys-btn"
                onClick={handleRefresh}
                title="Refresh current view"
              >
                <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {/* PAGE CANVAS: 100% full view, smooth zero-padding, custom scrollbar */}
          <main className="sys-page-canvas">
            <div className="p-2.5 sm:p-4 md:p-6 min-h-full">
              <Routes>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/dashboard" element={<AdminDashboard />} />
                
                {/* Users Management */}
                <Route path="/users" element={<AdminUserManagement />} />
                <Route path="/users/roles" element={<ComingSoon title="User Roles Management" description="Manage user roles and permissions" icon={<Users className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/users/activity" element={<AdminActivity />} />
                <Route path="/users/banned" element={<ComingSoon title="Banned Users" description="Manage banned and restricted users" icon={<Ban className="h-20 w-20 text-gray-400" />} />} />
                
                {/* Content & Media Management */}
                <Route path="/content/movies" element={<AdminContentManagement contentType="movies" />} />
                <Route path="/content/tvshows" element={<AdminContentManagement contentType="tvshows" />} />
                <Route path="/content/genres" element={<AdminGenreManagement />} />
                <Route path="/content/streaming" element={<AdminStreamingManagement />} />
                <Route path="/content/sync" element={<AdminSyncManagement />} />
                <Route path="/content/ads" element={<AdminAdsManagement />} />
                
                {/* Watch History */}
                <Route path="/history" element={<AdminHistoryManagement />} />
                
                {/* Analytics & SEO */}
                <Route path="/analytics/users" element={<AdminAnalyticsUsers />} />
                <Route path="/analytics/content" element={<AdminAnalyticsContent />} />
                <Route path="/analytics/activity" element={<AdminUserActivity />} />
                <Route path="/analytics/system" element={<AdminAnalyticsSystem />} />
                <Route path="/analytics/reports" element={<AdminAnalyticsReports />} />
                <Route path="/analytics/search-console" element={<AdminSearchConsole />} />
                
                {/* System & Social Media Outlets */}
                <Route path="/system/health" element={<AdminSystemHealth />} />
                <Route path="/system/logo" element={<AdminLogoManagement />} />
                <Route path="/system/telegram" element={<AdminTelegramManagement />} />
                <Route path="/system/twitter" element={<AdminTwitterManagement />} />
                <Route path="/system/reddit" element={<AdminRedditManagement />} />
                <Route path="/system/pinterest" element={<AdminPinterestManagement />} />
                <Route path="/system/bluesky" element={<AdminBlueskyManagement />} />
                <Route path="/system/tumblr" element={<AdminTumblrManagement />} />
                <Route path="/system/open-graph" element={<AdminOpenGraph />} />
                <Route path="/system/database" element={<ComingSoon title="Database Management" description="Manage database collections and documents" icon={<Database className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/system/logs" element={<ComingSoon title="System Logs" description="View system activity logs" icon={<FileText className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/system/backups" element={<ComingSoon title="System Backups" description="Create and restore system backups" icon={<Database className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/system/autosync" element={<AutoSyncPanel />} />
                
                {/* Security */}
                <Route path="/security/access" element={<ComingSoon title="Access Control" description="Manage user access permissions" icon={<Lock className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/security/apikeys" element={<ComingSoon title="API Keys" description="Manage API keys and tokens" icon={<Key className="h-20 w-20 text-gray-400" />} />} />
                <Route path="/security/audit" element={<AdminActivity />} />
                <Route path="/security/sessions" element={<ComingSoon title="Active Sessions" description="Manage active user sessions" icon={<Clock className="h-20 w-20 text-gray-400" />} />} />
                
                <Route path="*" element={<div className="p-6 text-center">Page Not Found</div>} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
