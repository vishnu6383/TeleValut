'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Folder,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
  HardDrive,
  UploadCloud,
  Search,
  Download,
  Trash2,
  AlertCircle,
  Info,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Plus,
  Check,
  Layers,
  ArrowRight,
  CloudUpload,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { api, apiBase } from '../../lib/api';

type User = {
  fullName: string;
  username: string;
  email: string;
};

type FileItem = {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileType: string;
  createdAt: string;
};

type Stats = {
  total: number;
  size: number;
  image: number;
  video: number;
  document: number;
};

type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
};

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const getFileDetails = (type: string, mime: string) => {
  if (type === 'image' || mime.startsWith('image/')) {
    return { icon: <ImageIcon size={24} className="text-emerald-400" />, label: 'Image', color: '#10b981' };
  }
  if (type === 'video' || mime.startsWith('video/')) {
    return { icon: <Video size={24} className="text-purple-400" />, label: 'Video', color: '#a855f7' };
  }
  if (type === 'audio' || mime.startsWith('audio/')) {
    return { icon: <Music size={24} className="text-amber-400" />, label: 'Audio', color: '#f59e0b' };
  }
  if (mime.includes('pdf')) {
    return { icon: <FileText size={24} className="text-rose-400" />, label: 'PDF Document', color: '#f43f5e' };
  }
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('compressed')) {
    return { icon: <Layers size={24} className="text-cyan-400" />, label: 'Archive', color: '#06b6d4' };
  }
  return { icon: <FileText size={24} className="text-teal-400" />, label: 'Document', color: '#0d9488' };
};

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, size: 0, image: 0, video: 0, document: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressState, setUploadProgressState] = useState<'idle' | 'uploading' | 'syncing' | 'completed'>('idle');
  const [uploadFileNames, setUploadFileNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Theme & Navigation
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gallery' | 'files'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'document' | 'video' | 'audio'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

  // Lightbox
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize theme
  useEffect(() => {
    const savedTheme = (localStorage.getItem('televault_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('televault_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const showToast = (
    title: string,
    description?: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxFile) {
        setLightboxFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxFile]);

  // Load authenticated user data
  const loadData = async () => {
    try {
      const me = await api<{ user: User }>('/auth/me');
      setUser(me.user);

      const [filesData, statsData] = await Promise.all([
        api<{ files: FileItem[] }>('/files?limit=100'),
        api<Stats>('/files/stats'),
      ]);

      setFiles(filesData.files || []);
      setStats(statsData || { total: 0, size: 0, image: 0, video: 0, document: 0 });
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Upload handler with micro-sync animation
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const names = Array.from(fileList).map((f) => f.name);
    setUploadFileNames(names);
    setUploading(true);
    setUploadProgressState('uploading');

    const formData = new FormData();
    const count = fileList.length;
    Array.from(fileList).forEach((file) => formData.append('files', file));

    try {
      setTimeout(() => {
        setUploadProgressState('syncing');
      }, 700);

      const response = await fetch(`${apiBase}/files/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Upload failed.');

      setUploadProgressState('completed');
      await loadData();

      setTimeout(() => {
        setUploading(false);
        setUploadProgressState('idle');
        setUploadFileNames([]);
        showToast(
          count === 1 ? 'Secured in your vault' : `${count} files secured in your vault`,
          count === 1 ? fileList[0].name : `Added ${count} items to your private space.`,
          'success'
        );
      }, 900);
    } catch (err: unknown) {
      setUploading(false);
      setUploadProgressState('idle');
      showToast(
        'Upload Failed',
        err instanceof Error ? err.message : 'Could not secure file to vault.',
        'error'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag & drop handlers
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // Delete single file
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from your vault?`)) return;
    try {
      await api(`/files/${id}`, { method: 'DELETE' });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (lightboxFile?._id === id) setLightboxFile(null);
      await loadData();
      showToast('File deleted', `"${name}" was permanently removed.`, 'info');
    } catch (err: unknown) {
      showToast('Delete Failed', err instanceof Error ? err.message : 'Could not delete file.', 'error');
    }
  };

  // Toggle single file selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all or clear
  const selectAllFiltered = (items: FileItem[]) => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((f) => f._id)));
    }
  };

  // Batch download selected files
  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setDownloadingBatch(true);
    showToast('Preparing download', `Downloading ${selectedIds.size} file(s)...`, 'info');

    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const link = document.createElement('a');
      link.href = `${apiBase}/files/${id}/download`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (i < ids.length - 1) {
        await new Promise((res) => setTimeout(res, 350));
      }
    }
    setDownloadingBatch(false);
  };

  // Batch delete selected files
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Permanently delete ${count} selected file(s) from your vault?`)) return;

    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => api(`/files/${id}`, { method: 'DELETE' })));
      setSelectedIds(new Set());
      if (lightboxFile && selectedIds.has(lightboxFile._id)) setLightboxFile(null);
      await loadData();
      showToast('Batch Delete Completed', `Removed ${count} files from your vault.`, 'info');
    } catch (err: unknown) {
      showToast('Batch Delete Failed', err instanceof Error ? err.message : 'Error removing selected files.', 'error');
    }
  };

  // Robust Logout Handler
  const handleLogout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors and continue local teardown
    } finally {
      sessionStorage.clear();
      localStorage.removeItem('televault_token');
      setUser(null);
      setFiles([]);
      router.replace('/login');
    }
  };

  // Sort and filter files
  const sortFiles = (items: FileItem[]) => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name_asc':
          return a.originalName.localeCompare(b.originalName);
        case 'name_desc':
          return b.originalName.localeCompare(a.originalName);
        case 'size_asc':
          return a.size - b.size;
        case 'size_desc':
          return b.size - a.size;
        default:
          return 0;
      }
    });
  };

  // Filtered files for All Files view
  const filteredFiles = sortFiles(
    files.filter((file) => {
      const matchesSearch = file.originalName.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (filterType === 'all') return true;
      if (filterType === 'image') return file.fileType === 'image' || file.mimeType.startsWith('image/');
      if (filterType === 'document') return file.fileType === 'document' || file.mimeType.includes('pdf') || file.mimeType.includes('text');
      if (filterType === 'video') return file.fileType === 'video' || file.mimeType.startsWith('video/');
      if (filterType === 'audio') return file.fileType === 'audio' || file.mimeType.startsWith('audio/');
      return true;
    })
  );

  // Photo gallery files (strictly images)
  const photoGalleryFiles = sortFiles(
    files.filter((file) => {
      const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
      if (!isImg) return false;
      return file.originalName.toLowerCase().includes(searchQuery.toLowerCase().trim());
    })
  );

  if (loading) {
    return (
      <main className="auth-form-wrap" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', textAlign: 'center' }}>
          <div className="brand-mark" style={{ animation: 'pulse 1.5s infinite' }}>T</div>
          <p className="muted" style={{ fontWeight: 700 }}>Unlocking your vault...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="dashboard-shell" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* MOBILE TOPBAR */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ padding: '0.45rem 0.65rem', minHeight: '2.2rem' }}
            aria-label="Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="brand" style={{ fontSize: '1.1rem' }}>
            <span className="brand-mark" style={{ width: '2rem', height: '2rem', fontSize: '0.95rem' }}>T</span>
            <span className="font-display">TeleVault</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            style={{ padding: '0.45rem 0.65rem', minHeight: '2.2rem' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* TOUCH-FRIENDLY USER PROFILE BUTTON ON MOBILE */}
          <button
            type="button"
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'var(--bg-elevated)',
              border: '1.5px solid var(--border-active)',
              borderRadius: '9999px',
              padding: '0.2rem 0.5rem 0.2rem 0.2rem',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
            aria-label="Open Account Menu"
          >
            <div className="user-avatar" style={{ width: '1.9rem', height: '1.9rem', fontSize: '0.8rem' }}>
              {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <UserIcon size={14} className="text-emerald-400" />
          </button>
        </div>
      </header>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            top: '3.6rem',
            background: 'var(--bg-surface)',
            zIndex: 40,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            overflowY: 'auto',
          }}
        >
          <div className="user-profile-badge">
            <div className="user-avatar">{user?.fullName ? user.fullName[0].toUpperCase() : 'U'}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.fullName || 'User'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                @{user?.username} · {user?.email}
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <HardDrive size={18} />
                <span>Dashboard Overview</span>
              </div>
            </button>

            <button
              className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('gallery');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <ImageIcon size={18} />
                <span>Photo Gallery</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8 }}>{stats.image}</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('files');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Folder size={18} />
                <span>All Vault Files</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8 }}>{stats.total}</span>
            </button>
          </nav>

          {/* MOBILE LOGOUT BUTTON IN DRAWER */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', paddingBottom: '4rem' }}>
            <button
              className="btn-danger"
              onClick={handleLogout}
              style={{ width: '100%', justifyContent: 'center', minHeight: '2.8rem', fontSize: '0.92rem' }}
            >
              <LogOut size={17} />
              <span>Log Out of Vault</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE / DESKTOP ACCOUNT MENU MODAL */}
      {accountMenuOpen && (
        <div
          onClick={() => setAccountMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '4rem 1rem 1rem 1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '22rem',
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--border-active)',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              boxShadow: 'var(--card-shadow), var(--glow-shadow)',
              animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: 'calc(100vh - 5rem)',
              overflowY: 'auto',
            }}
          >
            {/* User Identity Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <div className="user-avatar" style={{ width: '2.85rem', height: '2.85rem', fontSize: '1.15rem' }}>
                {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.fullName || 'User'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.email}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--lime)', fontWeight: 700, marginTop: '0.1rem' }}>
                  @{user?.username}
                </div>
              </div>
              <button
                onClick={() => setAccountMenuOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0.3rem' }}
                aria-label="Close Account Menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Vault Status & Specs */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '0.85rem', padding: '0.75rem 0.9rem', marginBottom: '1rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 700 }}>STORAGE USED</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{formatSize(stats.size)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 700 }}>TOTAL ITEMS</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{stats.total} files</span>
              </div>
            </div>

            {/* Theme Action in Menu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
              <button
                className="nav-item"
                onClick={() => {
                  toggleTheme();
                }}
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', borderRadius: '0.75rem', padding: '0.65rem 0.85rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                </div>
              </button>
            </div>

            {/* PROMINENT MOBILE LOGOUT BUTTON */}
            <button
              className="btn-danger"
              onClick={handleLogout}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem 1rem',
                minHeight: '2.85rem',
                fontSize: '0.92rem',
                borderRadius: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <LogOut size={18} />
              <span>Log Out of Vault</span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">T</span>
          <span className="font-display">TeleVault</span>
        </Link>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <HardDrive size={18} />
              <span>Dashboard</span>
            </div>
          </button>

          <button
            className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <ImageIcon size={18} />
              <span>Photo Gallery</span>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, opacity: 0.85 }}>{stats.image}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Folder size={18} />
              <span>All Files</span>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, opacity: 0.85 }}>{stats.total}</span>
          </button>
        </nav>

        {/* User Badge */}
        <div className="user-profile-badge">
          <div className="user-avatar">{user?.fullName ? user.fullName[0].toUpperCase() : 'U'}</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.fullName || 'User'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              @{user?.username}
            </div>
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={handleLogout}
          style={{ marginTop: '0.65rem', width: '100%', justifyContent: 'center' }}
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </aside>

      {/* MAIN VAULT AREA */}
      <main className="main">
        {/* ============================================================
            1. DASHBOARD OVERVIEW TAB
            (Welcome, 4 Storage Statistics cards ONLY HERE, Dropzone, Recent Files)
            ============================================================ */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Dashboard Welcome Header */}
            <div className="topbar">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <p className="muted" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, fontSize: '0.75rem' }}>
                    YOUR PERSONAL VAULT
                  </p>
                </div>
                <h1 className="font-display" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.3rem)', letterSpacing: '-0.04em', margin: '0.2rem 0 0', fontWeight: 800 }}>
                  Welcome back, {user?.fullName?.split(' ')[0] || 'Member'}
                </h1>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  Everything you store, organized in one private space.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="theme-toggle-btn" onClick={toggleTheme} title="Switch theme">
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <button
                  className="primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Plus size={18} />
                  <span>Secure to Vault</span>
                </button>
              </div>
            </div>

            {/* 4 STORAGE STATISTICS CARDS - STRICTLY DASHBOARD ONLY */}
            <section className="stats">
              <div className="stat-card">
                <div className="icon-wrapper">
                  <Folder size={22} className="text-teal-400" />
                </div>
                <small>Total Files</small>
                <strong>{stats.total}</strong>
                <span className="stat-hint">Items in vault</span>
              </div>

              <div className="stat-card">
                <div className="icon-wrapper">
                  <HardDrive size={22} className="text-emerald-400" />
                </div>
                <small>Storage Used</small>
                <strong>{formatSize(stats.size)}</strong>
                <span className="stat-hint">Your vault is ready</span>
              </div>

              <div className="stat-card">
                <div className="icon-wrapper">
                  <ImageIcon size={22} className="text-lime-400" />
                </div>
                <small>Photos & Media</small>
                <strong>{stats.image}</strong>
                <span className="stat-hint">Visual assets stored</span>
              </div>

              <div className="stat-card">
                <div className="icon-wrapper">
                  <FileText size={22} className="text-amber-400" />
                </div>
                <small>Documents & Other</small>
                <strong>{stats.document + (stats.video || 0)}</strong>
                <span className="stat-hint">Docs & archives</span>
              </div>
            </section>

            {/* Quick Actions & Upload Dropzone */}
            <section className="panel" style={{ marginBottom: '1.75rem' }}>
              <div className="panel-header">
                <div>
                  <h2 className="font-display" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.03em', fontWeight: 800 }}>
                    Quick Actions & Storage
                  </h2>
                  <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                    Securely stream new files or jump directly into your visual gallery.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={() => setActiveTab('gallery')}>
                    <ImageIcon size={16} />
                    <span>View Gallery ({stats.image})</span>
                  </button>
                  <button className="btn-secondary" onClick={() => setActiveTab('files')}>
                    <Folder size={16} />
                    <span>Manage All ({stats.total})</span>
                  </button>
                </div>
              </div>

              {/* Cloud Dropzone */}
              <div
                className={`dropzone ${isDragging ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div
                  className="cloud-vault-sync-icon"
                  style={{
                    width: '3.75rem',
                    height: '3.75rem',
                    borderRadius: '1.25rem',
                    background: 'rgba(215, 232, 126, 0.12)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 0.85rem',
                    color: 'var(--lime)',
                  }}
                >
                  <UploadCloud size={30} />
                </div>
                <h3 className="font-display" style={{ fontSize: '1.25rem', margin: '0 0 0.35rem', fontWeight: 800 }}>
                  Drag & drop files to secure in your vault
                </h3>
                <p className="muted" style={{ maxWidth: '28rem', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                  High resolution preserved, zero compression, and accessible anywhere.
                </p>
                <button className="primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <Plus size={16} /> Browse Files
                </button>
              </div>
            </section>

            {/* Recent Files Section */}
            <section className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 className="font-display" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    Recent Files
                  </h3>
                  <p className="muted" style={{ margin: '0.15rem 0 0' }}>Latest additions to your personal vault.</p>
                </div>

                {files.length > 0 && (
                  <button className="link" onClick={() => setActiveTab('files')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.88rem' }}>
                    View all {files.length} files <ArrowRight size={15} />
                  </button>
                )}
              </div>

              {files.length > 0 ? (
                <div className="gallery-grid">
                  {files.slice(0, 6).map((file) => {
                    const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
                    const details = getFileDetails(file.fileType, file.mimeType);

                    return (
                      <article key={file._id} className="gallery-card">
                        <div
                          className="gallery-media-preview"
                          onClick={() => isImg && setLightboxFile(file)}
                          style={{ cursor: isImg ? 'zoom-in' : 'default' }}
                        >
                          {isImg ? (
                            <img
                              className="gallery-thumbnail"
                              src={`${apiBase}/files/${file._id}/download`}
                              alt={file.originalName}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', color: 'var(--muted)' }}>
                              {details.icon}
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>{details.label}</span>
                            </div>
                          )}
                          <div className="file-type-chip">{file.fileType}</div>
                        </div>

                        <div className="gallery-card-content">
                          <h4 className="file-name" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                            {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>

                          <div className="file-actions">
                            <a
                              className="file-action-btn"
                              href={`${apiBase}/files/${file._id}/download`}
                              target="_blank"
                              title="Download"
                            >
                              <Download size={13} /> Download
                            </a>
                            <button
                              className="file-action-btn delete"
                              onClick={() => handleDelete(file._id, file.originalName)}
                              title="Delete"
                              style={{ maxWidth: '2.8rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'grid', placeItems: 'center', margin: '0 auto 0.75rem', color: 'var(--muted)' }}>
                    <CloudUpload size={24} />
                  </div>
                  <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.95rem' }}>Your vault is ready</p>
                  <p className="muted" style={{ maxWidth: '20rem', margin: '0.25rem auto 1rem' }}>
                    Upload your first photo or document to get started.
                  </p>
                  <button className="primary" onClick={() => fileInputRef.current?.click()}>
                    <Plus size={15} /> Upload First File
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============================================================
            2. PHOTO GALLERY TAB (Image-First, NO statistics cards!)
            ============================================================ */}
        {activeTab === 'gallery' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h1 className="font-display" style={{ margin: 0, fontSize: '1.6rem', letterSpacing: '-0.04em', fontWeight: 800 }}>
                  Photos & Media
                </h1>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  {photoGalleryFiles.length === 0
                    ? 'Your visual vault.'
                    : `Your visual vault · ${photoGalleryFiles.length} photo(s)`}
                </p>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-input-wrap">
                  <span className="field-icon-left">
                    <Search size={16} />
                  </span>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search photos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 0.85rem', minHeight: '2.5rem', fontSize: '0.84rem' }}
                  aria-label="Sort Photos"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="size_desc">Size (Largest)</option>
                </select>

                <button className="primary" onClick={() => fileInputRef.current?.click()}>
                  <Plus size={16} /> Upload Photo
                </button>
              </div>
            </div>

            {/* Smart Batch Action Toolbar */}
            {selectedIds.size > 0 && (
              <div className="batch-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    className="file-checkbox"
                    checked={selectedIds.size === photoGalleryFiles.length && photoGalleryFiles.length > 0}
                    onChange={() => selectAllFiltered(photoGalleryFiles)}
                  />
                  <span style={{ fontWeight: 800, color: 'var(--lime)', fontSize: '0.92rem' }}>
                    {selectedIds.size} {selectedIds.size === 1 ? 'photo' : 'photos'} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    className="primary"
                    onClick={handleDownloadSelected}
                    disabled={downloadingBatch}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.95rem', fontSize: '0.84rem' }}
                  >
                    <Download size={14} />
                    {downloadingBatch ? 'Downloading...' : `Download (${selectedIds.size})`}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleDeleteSelected}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.95rem', fontSize: '0.84rem' }}
                  >
                    <Trash2 size={14} />
                    Delete Selected
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.8rem', fontSize: '0.84rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {photoGalleryFiles.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '1.25rem',
                    background: 'rgba(215, 232, 126, 0.12)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--lime)',
                  }}
                >
                  <ImageIcon size={32} />
                </div>
                <h3 className="font-display" style={{ fontSize: '1.3rem', margin: '0 0 0.35rem', fontWeight: 800 }}>
                  Your gallery is empty
                </h3>
                <p className="muted" style={{ maxWidth: '24rem', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                  Upload your first photo to start building your visual vault.
                </p>
                <button className="primary" onClick={() => fileInputRef.current?.click()}>
                  <Plus size={16} /> Upload Photo
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: 'var(--muted)' }}>
                    <input
                      type="checkbox"
                      className="file-checkbox"
                      checked={selectedIds.size === photoGalleryFiles.length && photoGalleryFiles.length > 0}
                      onChange={() => selectAllFiltered(photoGalleryFiles)}
                    />
                    <span>Select All Photos ({photoGalleryFiles.length})</span>
                  </label>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>Tap photo to preview in high-res</span>
                </div>

                <div className="gallery-grid">
                  {photoGalleryFiles.map((file) => {
                    const isSelected = selectedIds.has(file._id);

                    return (
                      <article key={file._id} className={`gallery-card ${isSelected ? 'selected' : ''}`}>
                        <div
                          className="gallery-media-preview"
                          onClick={() => setLightboxFile(file)}
                          title="Click to zoom in high-res"
                          style={{ cursor: 'zoom-in' }}
                        >
                          <img
                            className="gallery-thumbnail"
                            src={`${apiBase}/files/${file._id}/download`}
                            alt={file.originalName}
                            loading="lazy"
                          />
                          <div
                            className="file-checkbox-overlay"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(file._id);
                            }}
                          >
                            <input
                              type="checkbox"
                              className="file-checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(file._id)}
                              aria-label={`Select ${file.originalName}`}
                            />
                          </div>
                        </div>

                        <div className="gallery-card-content">
                          <h4 className="file-name" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                            {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>

                          <div className="file-actions">
                            <a
                              className="file-action-btn"
                              href={`${apiBase}/files/${file._id}/download`}
                              target="_blank"
                              title="Download"
                            >
                              <Download size={13} /> Download
                            </a>
                            <button
                              className="file-action-btn delete"
                              onClick={() => handleDelete(file._id, file.originalName)}
                              title="Delete"
                              style={{ maxWidth: '2.8rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* ============================================================
            3. ALL FILES TAB (Professional File Manager, NO statistics cards!)
            ============================================================ */}
        {activeTab === 'files' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h1 className="font-display" style={{ margin: 0, fontSize: '1.6rem', letterSpacing: '-0.04em', fontWeight: 800 }}>
                  All Files
                </h1>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  {files.length === 0
                    ? 'Your vault is currently empty.'
                    : `Showing ${filteredFiles.length} of ${files.length} stored files`}
                </p>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-input-wrap">
                  <span className="field-icon-left">
                    <Search size={16} />
                  </span>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 0.85rem', minHeight: '2.5rem', fontSize: '0.84rem' }}
                  aria-label="Sort Files"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="name_desc">Name (Z–A)</option>
                  <option value="size_desc">Size (Largest)</option>
                  <option value="size_asc">Size (Smallest)</option>
                </select>

                <button className="primary" onClick={() => fileInputRef.current?.click()}>
                  <Plus size={16} /> Upload File
                </button>
              </div>
            </div>

            {/* Filter Category Pills */}
            <div className="filter-pills" style={{ marginBottom: '1.25rem' }}>
              {[
                { val: 'all', label: 'All Files', icon: <Folder size={14} /> },
                { val: 'image', label: 'Photos', icon: <ImageIcon size={14} /> },
                { val: 'document', label: 'Documents', icon: <FileText size={14} /> },
                { val: 'video', label: 'Videos', icon: <Video size={14} /> },
                { val: 'audio', label: 'Audio', icon: <Music size={14} /> },
              ].map((item) => (
                <button
                  key={item.val}
                  className={`pill-btn ${filterType === item.val ? 'active' : ''}`}
                  onClick={() => setFilterType(item.val as 'all' | 'image' | 'document' | 'video' | 'audio')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {item.icon}
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Smart Batch Action Toolbar */}
            {selectedIds.size > 0 && (
              <div className="batch-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    className="file-checkbox"
                    checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                    onChange={() => selectAllFiltered(filteredFiles)}
                  />
                  <span style={{ fontWeight: 800, color: 'var(--lime)', fontSize: '0.92rem' }}>
                    {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    className="primary"
                    onClick={handleDownloadSelected}
                    disabled={downloadingBatch}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.95rem', fontSize: '0.84rem' }}
                  >
                    <Download size={14} />
                    {downloadingBatch ? 'Downloading...' : `Download (${selectedIds.size})`}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleDeleteSelected}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.95rem', fontSize: '0.84rem' }}
                  >
                    <Trash2 size={14} />
                    Delete Selected
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ minHeight: '2.3rem', padding: '0.4rem 0.8rem', fontSize: '0.84rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {files.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '1.25rem',
                    background: 'rgba(215, 232, 126, 0.12)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--lime)',
                  }}
                >
                  <Folder size={32} />
                </div>
                <h3 className="font-display" style={{ fontSize: '1.3rem', margin: '0 0 0.35rem', fontWeight: 800 }}>
                  Your vault is empty
                </h3>
                <p className="muted" style={{ maxWidth: '24rem', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                  Secure your first file in TeleVault.
                </p>
                <button className="primary" onClick={() => fileInputRef.current?.click()}>
                  <Plus size={16} /> Upload File
                </button>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                <Search size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>No matching files found</p>
                <p className="muted" style={{ marginTop: '0.25rem', marginBottom: '1.25rem' }}>
                  Try adjusting your search query or category filters.
                </p>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Professional Table (screens >= 640px) */}
                <div className="file-table-wrap">
                  <table className="file-table">
                    <thead>
                      <tr>
                        <th style={{ width: '3rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="file-checkbox"
                            checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                            onChange={() => selectAllFiltered(filteredFiles)}
                            aria-label="Select all files"
                          />
                        </th>
                        <th>File Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Date Stored</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((file) => {
                        const isSelected = selectedIds.has(file._id);
                        const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
                        const details = getFileDetails(file.fileType, file.mimeType);

                        return (
                          <tr key={file._id} className={isSelected ? 'selected' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                className="file-checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(file._id)}
                                aria-label={`Select ${file.originalName}`}
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                  style={{
                                    width: '2.4rem',
                                    height: '2.4rem',
                                    borderRadius: '0.55rem',
                                    background: 'var(--bg-elevated)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                    cursor: isImg ? 'zoom-in' : 'default',
                                  }}
                                  onClick={() => isImg && setLightboxFile(file)}
                                >
                                  {isImg ? (
                                    <img
                                      src={`${apiBase}/files/${file._id}/download`}
                                      alt={file.originalName}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    details.icon
                                  )}
                                </div>
                                <div style={{ overflow: 'hidden', maxWidth: '20rem' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={file.originalName}>
                                    {file.originalName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '0.4rem',
                                  background: 'var(--bg-elevated)',
                                  color: 'var(--ink-secondary)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {file.fileType}
                              </span>
                            </td>
                            <td style={{ color: 'var(--ink-secondary)', fontSize: '0.85rem' }}>{formatSize(file.size)}</td>
                            <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                              {new Date(file.createdAt).toLocaleDateString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                <a
                                  className="file-action-btn"
                                  href={`${apiBase}/files/${file._id}/download`}
                                  target="_blank"
                                  title="Download"
                                  style={{ padding: '0.35rem 0.75rem' }}
                                >
                                  <Download size={14} /> Download
                                </a>
                                <button
                                  className="file-action-btn delete"
                                  onClick={() => handleDelete(file._id, file.originalName)}
                                  title="Delete"
                                  style={{ padding: '0.35rem 0.55rem' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Cards (screens < 640px) */}
                <div className="file-mobile-cards">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedIds.has(file._id);
                    const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
                    const details = getFileDetails(file.fileType, file.mimeType);

                    return (
                      <div key={file._id} className={`file-mobile-card ${isSelected ? 'selected' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <input
                            type="checkbox"
                            className="file-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(file._id)}
                            aria-label={`Select ${file.originalName}`}
                          />
                          <div
                            style={{
                              width: '2.5rem',
                              height: '2.5rem',
                              borderRadius: '0.55rem',
                              background: 'var(--bg-elevated)',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              overflow: 'hidden',
                              cursor: isImg ? 'zoom-in' : 'default',
                            }}
                            onClick={() => isImg && setLightboxFile(file)}
                          >
                            {isImg ? (
                              <img
                                src={`${apiBase}/files/${file._id}/download`}
                                alt={file.originalName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              details.icon
                            )}
                          </div>
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={file.originalName}>
                              {file.originalName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                              {file.fileType.toUpperCase()} · {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                          <a
                            className="file-action-btn"
                            href={`${apiBase}/files/${file._id}/download`}
                            target="_blank"
                            title="Download"
                          >
                            <Download size={13} /> Download
                          </a>
                          <button
                            className="file-action-btn delete"
                            onClick={() => handleDelete(file._id, file.originalName)}
                            title="Delete"
                            style={{ maxWidth: '3rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* HIDDEN FILE INPUT */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />

        {/* MINIMAL FOOTER */}
        <footer style={{ marginTop: '3.5rem', padding: '1.25rem 0', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
          <p>
            TeleVault Cloud Storage · Crafted by{' '}
            <a
              href="https://github.com/vishnu6383"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
              style={{ textDecoration: 'underline', fontWeight: 700 }}
            >
              vishnu
            </a>
          </p>
        </footer>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <HardDrive size={18} />
          <span>Dashboard</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          <ImageIcon size={18} />
          <span>Photos</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Folder size={18} />
          <span>Files</span>
        </button>

        <button
          className="mobile-nav-btn"
          onClick={() => setAccountMenuOpen(true)}
          style={{ color: 'var(--ink)' }}
        >
          <UserIcon size={18} />
          <span>Account</span>
        </button>
      </nav>

      {/* CLOUD VAULT SYNC UPLOAD OVERLAY / MICRO-ANIMATION */}
      {uploading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 12, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--border-active)',
              borderRadius: '1.35rem',
              padding: '2rem 1.5rem',
              maxWidth: '24rem',
              width: '100%',
              textAlign: 'center',
              boxShadow: 'var(--card-shadow), var(--glow-shadow)',
            }}
          >
            <div
              className="cloud-vault-sync-icon"
              style={{
                width: '4.5rem',
                height: '4.5rem',
                borderRadius: '1.5rem',
                background: 'linear-gradient(135deg, rgba(215, 232, 126, 0.2) 0%, rgba(13, 148, 136, 0.25) 100%)',
                border: '1.5px solid var(--border-active)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 1.25rem',
                color: 'var(--lime)',
              }}
            >
              {uploadProgressState === 'completed' ? (
                <CheckCircle2 size={36} />
              ) : (
                <UploadCloud size={36} />
              )}
            </div>

            <h3 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.35rem' }}>
              {uploadProgressState === 'uploading' && `Uploading ${uploadFileNames.length} file(s)...`}
              {uploadProgressState === 'syncing' && 'Securing to Vault...'}
              {uploadProgressState === 'completed' && '✓ Secured in your vault'}
            </h3>

            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {uploadProgressState === 'syncing'
                ? 'Streaming encrypted media to Telegram Bot cloud'
                : uploadFileNames.slice(0, 2).join(', ') + (uploadFileNames.length > 2 ? ` and ${uploadFileNames.length - 2} more` : '')}
            </p>

            <div style={{ height: '4px', width: '100%', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--teal), var(--lime))',
                  width: uploadProgressState === 'uploading' ? '45%' : uploadProgressState === 'syncing' ? '85%' : '100%',
                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {lightboxFile && (
        <div className="lightbox-modal" onClick={() => setLightboxFile(null)}>
          <div className="lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{ background: 'rgba(215, 232, 126, 0.15)', color: 'var(--lime)', padding: '0.4rem', borderRadius: '0.5rem', flexShrink: 0 }}>
                <ImageIcon size={20} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {lightboxFile.originalName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9db4ad' }}>
                  {formatSize(lightboxFile.size)} · Uploaded {new Date(lightboxFile.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              <a
                className="primary"
                href={`${apiBase}/files/${lightboxFile._id}/download`}
                target="_blank"
                style={{ textDecoration: 'none', padding: '0.45rem 0.95rem', fontSize: '0.84rem', minHeight: 'auto' }}
              >
                <Download size={14} />
                <span>Download</span>
              </a>
              <button
                className="btn-secondary"
                onClick={() => setLightboxFile(null)}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.84rem', minHeight: 'auto' }}
              >
                <X size={16} />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="lightbox-content">
            <img
              className="lightbox-img"
              src={`${apiBase}/files/${lightboxFile._id}/download`}
              alt={lightboxFile.originalName}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' ? (
                <Check size={16} strokeWidth={3} />
              ) : t.type === 'error' ? (
                <AlertCircle size={16} />
              ) : (
                <Info size={16} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{t.title}</div>
              {t.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem', wordBreak: 'break-word' }}>
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
