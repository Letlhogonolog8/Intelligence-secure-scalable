import React, { useState, useMemo } from 'react';
import { ModuleType, MODULE_LIST, MODULE_METADATA } from '@/data/aegisData';
import { useAppStore } from '@/store/appStore';
import { UserRole } from '@/lib/roleConfig';
import { 
  getRoleSpecificSidebarConfig, 
  type SidebarSection 
} from '@/components/sidebar/RoleSpecificSidebarBuilder';
import {
  ShieldIcon, ActivityIcon, MessageCircleIcon, MapPinIcon,
  ScaleIcon, BrainIcon, LockIcon, SettingsIcon, GlobeIcon,
  ChevronRightIcon, SearchIcon, StarIcon, AlertTriangleIcon, CheckCircleIcon,
  BarChartIcon, FileTextIcon, HeartIcon
} from '@/components/ui/AegisIcons';

interface SidebarProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  collapsed: boolean;
  onToggle: () => void;
  allowedModules?: ModuleType[];
  roleLabel?: string;
  organizationLabel?: string;
  userRole?: UserRole;
}

type IconComponent = React.FC<{ className?: string; size?: number }>;

const moduleIcons: Record<ModuleType, IconComponent> = {
  dashboard: BarChartIcon,
  personal_dashboard: HeartIcon,
  safety_plan: HeartIcon,
  appointments: ActivityIcon,
  trusted_contacts: ShieldIcon,
  document_vault: FileTextIcon,
  support_requests: MessageCircleIcon,
  secure_messages: MessageCircleIcon,
  reporting: FileTextIcon,
  admin_console: SettingsIcon,
  command_center: ActivityIcon,
  survivor_support: MessageCircleIcon,
  prediction: MapPinIcon,
  justice: ScaleIcon,
  policy: BrainIcon,
  governance: LockIcon,
};

const modules: { id: ModuleType; label: string; shortLabel: string; icon: IconComponent; color: string; description: string }[] = MODULE_LIST.map((moduleId) => ({
  id: moduleId,
  label: MODULE_METADATA[moduleId].label,
  shortLabel: MODULE_METADATA[moduleId].shortLabel,
  icon: moduleIcons[moduleId],
  color: MODULE_METADATA[moduleId].colorClass,
  description: MODULE_METADATA[moduleId].description,
}));

type SidebarModule = (typeof modules)[number];
type SidebarRenderSection = Omit<SidebarSection, 'modules'> & { modules: SidebarModule[] };

const Sidebar: React.FC<SidebarProps> = ({ 
  activeModule, 
  onModuleChange, 
  collapsed, 
  onToggle, 
  allowedModules, 
  roleLabel, 
  organizationLabel,
  userRole 
}) => {
  const { sidebarSearchQuery, setSidebarSearchQuery, recentModules, favoriteModules, toggleFavoriteModule, moduleActivities } = useAppStore();
  const [, setShowSearch] = useState(false);
  const [tooltip, setTooltip] = useState<{
    label: string;
    description: string;
    status: string;
    top: number;
    left: number;
  } | null>(null);

  const roleConfig = useMemo(() => {
    if (!userRole) return null;
    return getRoleSpecificSidebarConfig(userRole);
  }, [userRole]);

  const allowed = allowedModules ?? modules.map(m => m.id);
  const visibleModules = modules.filter((mod) => allowed.includes(mod.id));
  const filteredModules = useMemo(() => {
    if (!sidebarSearchQuery) return visibleModules;
    return visibleModules.filter(mod =>
      mod.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
      mod.description.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
    );
  }, [visibleModules, sidebarSearchQuery]);

  const favoriteModsData = visibleModules.filter(m => favoriteModules.includes(m.id));
  const recentModsData = visibleModules.filter(m => recentModules.includes(m.id) && m.id !== activeModule);

  const highlightedModuleIds = useMemo(() => {
    if (collapsed) {
      return new Set<ModuleType>();
    }

    return new Set<ModuleType>([
      ...favoriteModsData.map((mod) => mod.id),
      ...recentModsData.map((mod) => mod.id),
    ]);
  }, [collapsed, favoriteModsData, recentModsData]);

  const renderRoleSpecificSections = useMemo(() => {
    if (!roleConfig) return null;
    return roleConfig.sections.reduce<SidebarRenderSection[]>((sections, section: SidebarSection) => {
      const sectionModules = visibleModules.filter(
        (m) => section.modules.includes(m.id) && !highlightedModuleIds.has(m.id)
      );
      if (sectionModules.length > 0) {
        sections.push({ ...section, modules: sectionModules });
      }
      return sections;
    }, []);
  }, [highlightedModuleIds, roleConfig, visibleModules]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'error':
        return <AlertTriangleIcon size={10} className="text-red-400" />;
      case 'updating':
        return <ActivityIcon size={10} className="text-blue-400 animate-spin" />;
      case 'loading':
        return <ActivityIcon size={10} className="text-amber-400 animate-pulse" />;
      default:
        return <CheckCircleIcon size={10} className="text-emerald-400" />;
    }
  };

  const ModuleButton: React.FC<{ mod: typeof modules[0]; isFavorite?: boolean; showNotification?: number }> = ({ mod, isFavorite, showNotification }) => {
    const isActive = activeModule === mod.id;
    const Icon = mod.icon;
    const activity = moduleActivities[mod.id];

    const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
      if (collapsed) {
        setTooltip(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        label: mod.label,
        description: mod.description,
        status: activity.status,
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
    };

    const handleMouseLeave = () => {
      setTooltip(null);
    };

    return (
      <div className="group relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <button
          key={mod.id}
          type="button"
          onClick={() => onModuleChange(mod.id)}
          aria-pressed={isActive}
          aria-label={mod.label}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative
            ${isActive
              ? 'bg-slate-800/80 text-white shadow-lg shadow-slate-900/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          title={collapsed ? mod.label : undefined}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-indigo-400 to-cyan-400 rounded-r-full" />
          )}
          <div className="relative">
            <Icon className={`flex-shrink-0 ${isActive ? mod.color : ''}`} size={20} />
            <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
              {getStatusIcon(activity.status)}
            </div>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium truncate">{mod.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {typeof showNotification === "number" && showNotification > 0 && (
                  <span className="flex items-center justify-center h-5 w-5 bg-red-500 rounded-full text-xs text-white font-bold">
                    {showNotification > 9 ? '9+' : showNotification}
                  </span>
                )}
                {isFavorite && <StarIcon size={14} className="text-amber-400" />}
                {isActive && <ChevronRightIcon className="ml-auto opacity-50" size={14} />}
              </div>
            </>
          )}
          {collapsed && isActive && (
            <div className={`absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50`}>
              {mod.label}
            </div>
          )}
        </button>

      </div>
    );
  };

  return (
    <div className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-slate-950 border-r border-slate-800/50 flex flex-col transition-all duration-300 relative z-20 overflow-visible`}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <ShieldIcon className="text-white" size={22} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-white font-bold text-lg leading-tight tracking-wide">AEGIS</h1>
              <p className="text-[10px] text-cyan-400 font-medium tracking-widest">SYNTHETIC INTELLIGENCE</p>
              {(roleLabel || organizationLabel) && (
                <div className="mt-2 space-y-1">
                  {organizationLabel && (
                    <p className="text-[10px] text-slate-400 truncate">{organizationLabel}</p>
                  )}
                  {roleLabel && (
                    <p className="text-[10px] text-slate-500 truncate">{roleLabel}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-slate-800/50">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search modules..."
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 100)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/30 transition-all"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col min-h-0 overflow-visible">
        <div className="flex-1 overflow-y-auto overflow-x-visible px-2 py-4 space-y-1">
          {/* Favorites Section */}
          {!collapsed && favoriteModsData.length > 0 && (
            <>
              <div className="px-3 mb-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <StarIcon size={12} /> Favorites
                </span>
              </div>
              <div className="space-y-1 mb-3 pb-3 border-b border-slate-800/50">
                {favoriteModsData.map(mod => (
                  <ModuleButton key={mod.id} mod={mod} isFavorite showNotification={moduleActivities[mod.id].notificationCount} />
                ))}
              </div>
            </>
          )}

          {/* Recent Modules Section */}
          {!collapsed && recentModsData.length > 0 && (
            <>
              <div className="px-3 mb-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  ⏱ Recent
                </span>
              </div>
              <div className="space-y-1 mb-3 pb-3 border-b border-slate-800/50">
                {recentModsData.slice(0, 2).map(mod => (
                  <ModuleButton key={mod.id} mod={mod} showNotification={moduleActivities[mod.id].notificationCount} />
                ))}
              </div>
            </>
          )}

          {/* Role-Specific Sections or Core Modules */}
          {renderRoleSpecificSections && renderRoleSpecificSections.length > 0 ? (
            renderRoleSpecificSections.map((section) => (
              <div key={section.id}>
                {!collapsed && (
                  <div className="px-3 mb-3 mt-4 first:mt-0">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {section.title}
                    </span>
                  </div>
                )}
                <div className={`space-y-1 ${!collapsed && section !== renderRoleSpecificSections[renderRoleSpecificSections.length - 1] ? 'mb-3 pb-3 border-b border-slate-800/50' : ''}`}>
                  {section.modules.map((mod) => (
                    <div key={mod.id} className="relative group">
                      <div className="flex items-center">
                        <ModuleButton mod={mod} isFavorite={favoriteModules.includes(mod.id)} showNotification={moduleActivities[mod.id].notificationCount} />
                        {!collapsed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteModule(mod.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity mr-2 p-1.5 hover:bg-slate-800/50 rounded"
                            title={favoriteModules.includes(mod.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <StarIcon size={14} className={favoriteModules.includes(mod.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-500'} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Fallback: Core Modules Section */}
              <div className={`${collapsed ? 'px-1' : 'px-3'} mb-3`}>
                {!collapsed && <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Core Modules</span>}
              </div>

              <div className="space-y-1">
                {(sidebarSearchQuery ? filteredModules : visibleModules).map((mod) => (
                  <div key={mod.id} className="relative group">
                    <div className="flex items-center">
                      <ModuleButton mod={mod} isFavorite={favoriteModules.includes(mod.id)} showNotification={moduleActivities[mod.id].notificationCount} />
                      {!collapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteModule(mod.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity mr-2 p-1.5 hover:bg-slate-800/50 rounded"
                          title={favoriteModules.includes(mod.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <StarIcon size={14} className={favoriteModules.includes(mod.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-500'} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>
      {!collapsed && tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 w-max max-w-xs shadow-xl">
            <p className="text-xs text-slate-300 break-words">{tooltip.description}</p>
            <p className="text-[10px] text-slate-500 mt-2">
              {tooltip.status === 'online' && '🟢 Online'}
              {tooltip.status === 'offline' && '🔴 Offline'}
              {tooltip.status === 'loading' && '🟡 Loading'}
              {tooltip.status === 'error' && '⚠️ Error'}
            </p>
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="p-3 border-t border-slate-800/50">
        {!collapsed ? (
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">System Online</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Uptime: 99.97%</span>
              <span>v3.2.1</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <GlobeIcon size={12} className="text-slate-500" />
              <span className="text-[10px] text-slate-500">18 countries active</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/40 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500/50"
        >
          <ChevronRightIcon className={`transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} size={16} />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
