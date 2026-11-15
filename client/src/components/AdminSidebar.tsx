import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X, Video, Clock, Share2 } from 'lucide-react';
import { FaReddit, FaPinterest } from 'react-icons/fa';
import { SiBluesky, SiTumblr } from 'react-icons/si';
import { 
  MdDashboard, 
  MdPeople, 
  MdAdminPanelSettings,
  MdMovie, 
  MdTv, 
  MdCategory, 
  MdCastConnected, 
  MdSync, 
  MdAnalytics, 
  MdAssessment, 
  MdComputer, 
  MdStorage, 
  MdDescription, 
  MdBackup, 
  MdAutorenew,
  MdSecurity, 
  MdLockOpen, 
  MdVpnKey, 
  MdHistory, 
  MdDevices,
  MdStar
} from 'react-icons/md';

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, onToggle, mobileOpen = false, onMobileClose }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['dashboard']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      path: '/admin/dashboard',
      icon: MdDashboard
    },
    {
      id: 'users',
      title: 'Users',
      icon: MdPeople,
      children: [
        { title: 'All Users', path: '/admin/users', icon: MdPeople },
        { title: 'Roles', path: '/admin/users/roles', icon: MdAdminPanelSettings },
        { title: 'Activity', path: '/admin/users/activity', icon: MdHistory },
        { title: 'Banned', path: '/admin/users/banned', icon: MdSecurity }
      ]
    },
    {
      id: 'movies',
      title: 'Movies',
      path: '/admin/content/movies',
      icon: MdMovie
    },
    {
      id: 'tvshows',
      title: 'TV Shows',
      path: '/admin/content/tvshows',
      icon: MdTv
    },
    {
      id: 'history',
      title: 'Watch History',
      path: '/admin/history',
      icon: Clock
    },
    {
      id: 'content',
      title: 'Content',
      icon: MdCategory,
      children: [
        { title: 'Genres', path: '/admin/content/genres', icon: MdCategory },
        { title: 'Streaming', path: '/admin/content/streaming', icon: MdCastConnected },
        { title: 'Sync', path: '/admin/content/sync', icon: MdSync },
        { title: 'Affiliates & Ads', path: '/admin/content/ads', icon: MdSecurity }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: MdAnalytics,
      children: [
        { title: 'Users', path: '/admin/analytics/users', icon: MdPeople },
        { title: 'User Activity', path: '/admin/analytics/activity', icon: MdAssessment },
        { title: 'Content', path: '/admin/analytics/content', icon: MdCategory },
        { title: 'System', path: '/admin/analytics/system', icon: MdComputer },
        { title: 'Reports', path: '/admin/analytics/reports', icon: MdAssessment },
        { title: 'Search Console', path: '/admin/analytics/search-console', icon: MdStar }
      ]
    },
    {
      id: 'system',
      title: 'System',
      icon: MdComputer,
      children: [
        { title: 'Health', path: '/admin/system/health', icon: MdComputer },
        { title: 'Logo', path: '/admin/system/logo', icon: MdDescription },
        { title: 'Telegram', path: '/admin/system/telegram', icon: MdCastConnected },
        { title: 'Twitter/X', path: '/admin/system/twitter', icon: MdCastConnected },
        { title: 'Reddit', path: '/admin/system/reddit', icon: FaReddit },
        { title: 'Pinterest', path: '/admin/system/pinterest', icon: FaPinterest },
        { title: 'Bluesky', path: '/admin/system/bluesky', icon: SiBluesky },
        { title: 'Tumblr', path: '/admin/system/tumblr', icon: SiTumblr },
        { title: 'Open Graph', path: '/admin/system/open-graph', icon: Share2 },
        { title: 'Database', path: '/admin/system/database', icon: MdStorage },
        { title: 'Logs', path: '/admin/system/logs', icon: MdDescription },
        { title: 'Backups', path: '/admin/system/backups', icon: MdBackup },
        { title: 'Auto Sync', path: '/admin/system/autosync', icon: MdAutorenew }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      icon: MdSecurity,
      children: [
        { title: 'Access', path: '/admin/security/access', icon: MdLockOpen },
        { title: 'API Keys', path: '/admin/security/apikeys', icon: MdVpnKey },
        { title: 'Audit', path: '/admin/security/audit', icon: MdHistory },
        { title: 'Sessions', path: '/admin/security/sessions', icon: MdDevices }
      ]
    }
  ];

  const renderMenuItem = (item: any, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections.includes(item.id);
    const isActiveItem = isActive(item.path || '');
    const Icon = item.icon;
    // On mobile, always show full menu (not collapsed)
    const showFullText = !isCollapsed || mobileOpen;

    if (hasChildren) {
      return (
        <div key={item.id} className="mb-2">
          <button
            onClick={() => {
              toggleSection(item.id);
              // On mobile, if section is already expanded, clicking a child link will close menu
              // This is handled in the Link onClick below
            }}
            className={`group w-full flex items-center ${showFullText ? 'justify-between px-4' : 'justify-center px-2'} py-3 border transition-all duration-300 ${
              isActiveItem
                ? 'border-red-600 bg-red-600/10'
                : 'border-transparent hover:border-red-600/20'
            }`}
            title={!showFullText ? item.title : undefined}
          >
            <div className={`flex items-center gap-3 ${showFullText ? '' : 'justify-center'}`}>
              {Icon && (
                <Icon className={`h-5 w-5 flex-shrink-0 ${
                  isActiveItem 
                    ? 'text-red-600' 
                    : 'text-gray-400 group-hover:text-red-600'
                }`} />
              )}
              {showFullText && (
                <span className={`text-sm font-medium uppercase tracking-wider ${
                  isActiveItem 
                    ? 'text-red-600' 
                    : 'text-gray-400 group-hover:text-red-600'
                }`}>
                  {item.title}
                </span>
              )}
            </div>
            {showFullText && (
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`} />
            )}
          </button>
          
          {showFullText && isExpanded && (
            <div className="mt-2 ml-4 border-l border-white/10 pl-4 space-y-1">
              {item.children.map((child: any) => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => {
          // Close mobile menu when clicking a link (only if mobile menu is open)
          if (onMobileClose && mobileOpen) {
            onMobileClose();
          }
        }}
        className={`group relative flex items-center ${showFullText ? 'px-4' : 'justify-center px-2'} py-3 border transition-all duration-300 ${
          isActiveItem
            ? 'border-red-600 bg-red-600/10'
            : 'border-transparent hover:border-red-600/20'
        }`}
        title={!showFullText ? item.title : undefined}
      >
        <div className={`flex items-center gap-3 ${showFullText ? '' : 'justify-center'}`}>
          {Icon && (
            <Icon className={`h-5 w-5 flex-shrink-0 ${
              isActiveItem 
                ? 'text-red-600' 
                : 'text-gray-400 group-hover:text-red-600'
            }`} />
          )}
          {showFullText && (
            <span className={`text-sm font-medium uppercase tracking-wider whitespace-nowrap ${
              isActiveItem 
                ? 'text-red-600' 
                : 'text-gray-400 group-hover:text-red-600'
            }`}>
              {item.title}
            </span>
          )}
        </div>
        {/* Active accent */}
        {isActiveItem && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-600 transition-all duration-300" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Sidebar - Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-black border-r border-white/10 transition-transform duration-300 ease-in-out md:hidden w-72 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">
                ADMIN
              </h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Control Panel
              </p>
            </div>
            <button
              onClick={onMobileClose}
              className="p-2 hover:bg-white/5 transition-all duration-300 group ml-auto"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X className="h-5 w-5 text-gray-400 group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 px-4 my-4 py-2 space-y-1 overflow-y-auto h-[calc(100vh-180px)]">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Mobile Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-white/10 bg-black/98 backdrop-blur-sm">
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-white uppercase tracking-wider font-medium">System</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Fixed */}
      <div className={`hidden md:block relative bg-black border-r border-white/10 transition-all duration-500 ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}>
        {/* Desktop Header */}
        <div className="px-4 my-4 py-2 border-b border-white/10">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">
                  ADMIN
                </h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                  Control Panel
                </p>
              </div>
            )}
            <button
              onClick={onToggle}
              className="p-1 hover:bg-white/5 transition-all duration-300 group"
              title="Toggle Sidebar"
              aria-label="Toggle Sidebar"
            >
              {isCollapsed ? (
                <Menu className="h-5 w-5 text-gray-400 group-hover:text-white" />
              ) : (
                <X className="h-5 w-5 text-gray-400 group-hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Desktop Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-white/10 bg-black/98 backdrop-blur-sm">
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-white uppercase tracking-wider font-medium">System</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;
