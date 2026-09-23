'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
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

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const getFileIcon = (type: string, mime: string) => {
  if (type === 'image' || mime.startsWith('image/')) return '🖼️';
  if (type === 'video' || mime.startsWith('video/')) return '🎥';
  if (type === 'audio' || mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '📦';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('excel') || mime.includes('sheet')) return '📊';
  return '📄';
};

export default function Dashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, size: 0, image: 0, video: 0, document: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Theme state: dark or light
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Active view: 'overview' | 'gallery' | 'files'
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'files'>('overview');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'document' | 'video' | 'audio'>('all');

  // Lightbox modal for photo gallery
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  const showToast = (title: string, description?: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const loadData = async () => {
    try {
      const me = await api<{ user: User }>('/auth/me');
      setUser(me.user);
      const [filesData, statsData] = await Promise.all([
        api<{ files: FileItem[] }>('/files'),
        api<Stats>('/files/stats'),
      ]);
      setFiles(filesData.files || []);
      setStats(statsData || { total: 0, size: 0, image: 0, video: 0, document: 0 });
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    const count = fileList.length;
    Array.from(fileList).forEach((file) => formData.append('files', file));

    try {
      const response = await fetch(`${apiBase}/files/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Upload failed.');

      await loadData();
      showToast(
        count === 1 ? 'File uploaded successfully!' : `${count} files uploaded successfully!`,
        count === 1 ? fileList[0].name : `Added ${count} items to your private Telegram vault.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Upload Failed', err instanceof Error ? err.message : 'Could not upload file.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
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
    if (!confirm(`Delete "${name}" from your vault?`)) return;
    try {
      await api(`/files/${id}`, { method: 'DELETE' });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (lightboxFile?._id === id) setLightboxFile(null);
      await loadData();
      showToast('File deleted', `"${name}" removed from vault.`, 'info');
    } catch (err: unknown) {
      showToast('Delete Failed', err instanceof Error ? err.message : 'Failed to delete file.', 'error');
    }
  };

  // Selective Selection Toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = (list: FileItem[]) => {
    if (selectedIds.size === list.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((f) => f._id)));
    }
  };

  // Selective Download (Batch download)
  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setDownloadingBatch(true);
    const selectedList = files.filter((f) => selectedIds.has(f._id));

    showToast(
      'Downloading selected files...',
      `Starting download for ${selectedList.length} files.`,
      'info'
    );

    // Download sequentially with small delay to avoid browser popup blocks
    for (let i = 0; i < selectedList.length; i++) {
      const file = selectedList[i];
      const link = document.createElement('a');
      link.href = `${apiBase}/files/${file._id}/download`;
      link.download = file.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    setDownloadingBatch(false);
  };

  // Selective Batch Delete
  const handleDeleteSelected = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`Are you sure you want to delete ${count} selected file(s)?`)) return;

    try {
      for (const id of Array.from(selectedIds)) {
        await api(`/files/${id}`, { method: 'DELETE' });
      }
      setSelectedIds(new Set());
      await loadData();
      showToast('Files Deleted', `Successfully deleted ${count} files.`, 'info');
    } catch (err: unknown) {
      showToast('Batch Delete Error', err instanceof Error ? err.message : 'Error deleting some files.', 'error');
    }
  };

  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Filtered files for Files Explorer
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.originalName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'image'
        ? f.fileType === 'image' || f.mimeType.startsWith('image/')
        : filterType === 'video'
        ? f.fileType === 'video' || f.mimeType.startsWith('video/')
        : filterType === 'audio'
        ? f.fileType === 'audio' || f.mimeType.startsWith('audio/')
        : f.fileType === 'document' || !['image', 'video', 'audio'].includes(f.fileType);

    return matchesSearch && matchesType;
  });

  // Photo gallery only items
  const photoGalleryFiles = files.filter(
    (f) => (f.fileType === 'image' || f.mimeType.startsWith('image/')) &&
           f.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <main className="auth-form-wrap" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⚡</div>
          <h2 style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.03em' }}>Opening your private vault...</h2>
        </div>
      </main>
    );
  }

  return (
    <div className="dashboard-shell" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>TeleVault</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>Overview</span>
            <b>⌂</b>
          </button>
          <button
            className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <span>Photo Gallery</span>
            <b>🖼️</b>
          </button>
          <button
            className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <span>All Files</span>
            <b>📁</b>
          </button>
        </nav>

        {/* User Account Info Chip */}
        <div className="user-profile-badge">
          <div className="user-avatar">{user?.fullName ? user.fullName[0].toUpperCase() : 'U'}</div>
          <div className="user-details" style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.fullName || 'User'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              @{user?.username}
            </div>
          </div>
        </div>

        <button className="btn-secondary" onClick={handleLogout} style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}>
          <span>Log out</span>
          <b>↗</b>
        </button>
      </aside>

      {/* MAIN VAULT AREA */}
      <main className="main">
        {/* Topbar with Theme Toggle & Upload Button */}
        <div className="topbar">
          <div>
            <p className="muted" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              PRIVATE ENCRYPTED VAULT
            </p>
            <h1 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: '2.2rem', letterSpacing: '-0.05em', margin: '0.2rem 0 0' }}>
              Welcome, {user?.fullName?.split(' ')[0] || 'Member'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* LIGHT / DARK MODE TOGGLE BUTTON */}
            <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
              <span>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</span>
            </button>

            <button className="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Uploading to Telegram...
                </>
              ) : (
                <>
                  <span>＋</span> Upload Files
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <section className="stats">
          <div className="stat-card">
            <div className="icon">📁</div>
            <small>Total Files</small>
            <strong>{stats.total}</strong>
          </div>

          <div className="stat-card">
            <div className="icon">⚡</div>
            <small>Vault Storage</small>
            <strong>{formatSize(stats.size)}</strong>
          </div>

          <div className="stat-card">
            <div className="icon">🖼️</div>
            <small>Photos & Media</small>
            <strong>{stats.image}</strong>
          </div>

          <div className="stat-card">
            <div className="icon">📄</div>
            <small>Documents</small>
            <strong>{stats.document + (stats.video || 0)}</strong>
          </div>
        </section>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '-0.03em' }}>Quick Actions & Storage</h2>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  Upload photos, browse your visual gallery, or manage all files.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="btn-secondary" onClick={() => setActiveTab('gallery')}>
                  🖼️ View Gallery ({stats.image})
                </button>
                <button className="btn-secondary" onClick={() => setActiveTab('files')}>
                  📁 Browse All ({stats.total})
                </button>
              </div>
            </div>

            {/* Quick Upload Dropzone */}
            <div
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginBottom: '2rem' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📸</div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.4rem', fontFamily: 'var(--font-space-grotesk)' }}>
                Drag & drop photos or files to store in Telegram
              </h3>
              <p className="muted" style={{ maxWidth: '28rem', margin: '0 auto 1.5rem' }}>
                Files are streamed directly to your private Telegram channel. Unlimited, secure, and encrypted.
              </p>
              <button className="primary">＋ Select files from computer</button>
            </div>

            {/* Recent Uploads Preview Grid */}
            {files.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Recent Uploads</h3>
                  <button className="link" onClick={() => setActiveTab('files')}>View all files ➔</button>
                </div>

                <div className="gallery-grid">
                  {files.slice(0, 6).map((file) => {
                    const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
                    const icon = getFileIcon(file.fileType, file.mimeType);

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
                            <div style={{ fontSize: '3.5rem' }}>{icon}</div>
                          )}
                          <div className="file-type-chip">{file.fileType}</div>
                        </div>

                        <div className="gallery-card-content">
                          <h4 className="file-name" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                            {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>

                          <div className="file-actions">
                            <a className="file-action-btn" href={`${apiBase}/files/${file._id}/download`} target="_blank">
                              ⬇️ Download
                            </a>
                            <button
                              className="file-action-btn delete"
                              onClick={() => handleDelete(file._id, file.originalName)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2. PHOTO GALLERY TAB */}
        {activeTab === 'gallery' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '-0.03em' }}>Photo & Media Gallery</h2>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  {photoGalleryFiles.length === 0
                    ? 'No photos uploaded yet.'
                    : `Showing ${photoGalleryFiles.length} photo(s)`}
                </p>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                  🔍
                </span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search photos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* SELECTIVE BATCH ACTION TOOLBAR */}
            {selectedIds.size > 0 && (
              <div className="batch-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <input
                    type="checkbox"
                    className="file-checkbox"
                    checked={selectedIds.size === photoGalleryFiles.length && photoGalleryFiles.length > 0}
                    onChange={() => selectAllFiltered(photoGalleryFiles)}
                  />
                  <span style={{ fontWeight: 800, color: 'var(--lime)', fontSize: '0.95rem' }}>
                    {selectedIds.size} {selectedIds.size === 1 ? 'photo' : 'photos'} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    className="primary"
                    onClick={handleDownloadSelected}
                    disabled={downloadingBatch}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}
                  >
                    {downloadingBatch ? 'Downloading...' : `⬇️ Download Selected (${selectedIds.size})`}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleDeleteSelected}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}
                  >
                    🗑️ Delete Selected
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ padding: '0.55rem 0.9rem', fontSize: '0.88rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {photoGalleryFiles.length === 0 ? (
              <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🖼️</div>
                <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.4rem', fontFamily: 'var(--font-space-grotesk)' }}>
                  No photos in your gallery
                </h3>
                <p className="muted" style={{ maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
                  Upload photos and images to display them in this gallery.
                </p>
                <button className="primary">＋ Upload Photos</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, color: 'var(--muted)' }}>
                    <input
                      type="checkbox"
                      className="file-checkbox"
                      checked={selectedIds.size === photoGalleryFiles.length && photoGalleryFiles.length > 0}
                      onChange={() => selectAllFiltered(photoGalleryFiles)}
                    />
                    <span>Select All Photos ({photoGalleryFiles.length})</span>
                  </label>
                  <span className="muted">Click photo to preview in high-res</span>
                </div>

                <div className="gallery-grid">
                  {photoGalleryFiles.map((file) => {
                    const isSelected = selectedIds.has(file._id);

                    return (
                      <article key={file._id} className={`gallery-card ${isSelected ? 'selected' : ''}`}>
                        <div
                          className="gallery-media-preview"
                          onClick={() => setLightboxFile(file)}
                          title="Click to preview photo"
                        >
                          <img
                            className="gallery-thumbnail"
                            src={`${apiBase}/files/${file._id}/download`}
                            alt={file.originalName}
                            loading="lazy"
                          />
                          <div className="file-checkbox-overlay" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="file-checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(file._id)}
                            />
                          </div>
                        </div>

                        <div className="gallery-card-content">
                          <h4 className="file-name" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                            {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>

                          <div className="file-actions">
                            <a
                              className="file-action-btn"
                              href={`${apiBase}/files/${file._id}/download`}
                              target="_blank"
                              title="Download"
                            >
                              ⬇️ Download
                            </a>
                            <button
                              className="file-action-btn delete"
                              onClick={() => handleDelete(file._id, file.originalName)}
                              title="Delete"
                            >
                              🗑️
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

        {/* 3. ALL FILES EXPLORER TAB */}
        {activeTab === 'files' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '-0.03em' }}>All Vault Files</h2>
                <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                  {files.length === 0
                    ? 'Your vault is empty.'
                    : `Showing ${filteredFiles.length} of ${files.length} files`}
                </p>
              </div>

              {/* Search & Category Filter */}
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                    🔍
                  </span>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search files by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-pills">
                  {[
                    ['all', 'All'],
                    ['image', 'Photos 🖼️'],
                    ['document', 'Docs 📄'],
                    ['video', 'Videos 🎥'],
                    ['audio', 'Audio 🎵'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      className={`pill-btn ${filterType === val ? 'active' : ''}`}
                      onClick={() => setFilterType(val as 'all' | 'image' | 'document' | 'video' | 'audio')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SELECTIVE BATCH ACTION TOOLBAR */}
            {selectedIds.size > 0 && (
              <div className="batch-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <input
                    type="checkbox"
                    className="file-checkbox"
                    checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                    onChange={() => selectAllFiltered(filteredFiles)}
                  />
                  <span style={{ fontWeight: 800, color: 'var(--lime)', fontSize: '0.95rem' }}>
                    {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    className="primary"
                    onClick={handleDownloadSelected}
                    disabled={downloadingBatch}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}
                  >
                    {downloadingBatch ? 'Downloading...' : `⬇️ Download Selected (${selectedIds.size})`}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleDeleteSelected}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}
                  >
                    🗑️ Delete Selected
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ padding: '0.55rem 0.9rem', fontSize: '0.88rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {files.length === 0 ? (
              <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</div>
                <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.4rem', fontFamily: 'var(--font-space-grotesk)' }}>
                  Your vault is empty
                </h3>
                <p className="muted" style={{ maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
                  Drag & drop your photos or files here, or click to browse. Files are saved securely in your private Telegram channel.
                </p>
                <button className="primary">＋ Upload your first file</button>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <p>No files match your search criteria.</p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.3rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      className="file-checkbox"
                      checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={() => selectAllFiltered(filteredFiles)}
                    />
                    <span>Select All ({filteredFiles.length})</span>
                  </label>
                </div>

                <div className="gallery-grid">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedIds.has(file._id);
                    const isImg = file.fileType === 'image' || file.mimeType.startsWith('image/');
                    const icon = getFileIcon(file.fileType, file.mimeType);

                    return (
                      <article
                        key={file._id}
                        className={`gallery-card ${isSelected ? 'selected' : ''}`}
                      >
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
                            <div style={{ fontSize: '3.5rem' }}>{icon}</div>
                          )}
                          <div className="file-checkbox-overlay" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="file-checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(file._id)}
                            />
                          </div>
                          <div className="file-type-chip">{file.fileType}</div>
                        </div>

                        <div className="gallery-card-content">
                          <h4 className="file-name" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                            {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>

                          <div className="file-actions">
                            <a
                              className="file-action-btn"
                              href={`${apiBase}/files/${file._id}/download`}
                              target="_blank"
                              title="Download"
                            >
                              ⬇️ Download
                            </a>
                            <button
                              className="file-action-btn delete"
                              onClick={() => handleDelete(file._id, file.originalName)}
                              title="Delete"
                            >
                              🗑️
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
      </main>

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {lightboxFile && (
        <div className="lightbox-modal" onClick={() => setLightboxFile(null)}>
          <div className="lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{lightboxFile.originalName}</div>
                <div style={{ fontSize: '0.82rem', color: '#a0b8b0' }}>
                  {formatSize(lightboxFile.size)} · Uploaded {new Date(lightboxFile.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <a
                className="primary"
                href={`${apiBase}/files/${lightboxFile._id}/download`}
                target="_blank"
                style={{ textDecoration: 'none', padding: '0.55rem 1.2rem', fontSize: '0.9rem' }}
              >
                ⬇️ Download Photo
              </a>
              <button
                className="btn-secondary"
                onClick={() => setLightboxFile(null)}
                style={{ padding: '0.55rem 1rem', fontSize: '0.9rem' }}
              >
                ✕ Close
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

      {/* TOAST ALERTS CONTAINER */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <div className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'ℹ'}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{t.title}</div>
              {t.description && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                  {t.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
