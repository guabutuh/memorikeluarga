import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Trash2, FolderOpen, Camera, LogOut,
  Heart, KeyRound, RefreshCw, X, ExternalLink,
  Download, ZoomIn, ImageOff
} from 'lucide-react';
import { encryptData, decryptData } from './encryption';

const FOLDER_ID = '1rvEOVGK93P2eYwnOO2FFB-_fpndCTqVo';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const MASTER_PASSWORD = 'Multatuli19'; // Password tetap untuk semua anggota keluarga

// Component that fetches private Drive images as blobs using access token
function AuthImage({ fileId, accessToken, alt, className, style, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId || !accessToken) return;
    let objectUrl = null;
    setLoading(true);
    setError(false);

    // Use thumbnail size for grid view (faster loading)
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, accessToken]);

  if (loading) return (
    <div style={{
      width: '100%', height: '100%', minHeight: 160,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(168,85,247,0.08)', borderRadius: 'inherit'
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid rgba(168,85,247,0.3)',
        borderTopColor: '#a855f7', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}/>
    </div>
  );

  if (error) return (
    <div style={{
      width: '100%', height: '100%', minHeight: 160,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(239,68,68,0.05)', borderRadius: 'inherit', gap: 8,
      color: 'var(--text-muted)'
    }}>
      <ImageOff size={28}/>
      <span style={{ fontSize: '0.72rem' }}>Gagal memuat</span>
    </div>
  );

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
    />
  );
}


export default function App() {
  // --- Vault Auth ---
  const [inputPassword, setInputPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // --- Google OAuth ---
  const [clientId, setClientId] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [showClientIdSetup, setShowClientIdSetup] = useState(false);
  const [googleToken, setGoogleToken] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  // Note: tokenClientRef removed - now using redirect flow (mobile-friendly)

  // --- Drive Photos (admin only, optional) ---
  const [drivePhotos, setDrivePhotos] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');

  // --- Public Photos (from photos.json, no login needed) ---
  const [publicPhotos, setPublicPhotos] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');

  // --- Local Uploads ---
  const [localFiles, setLocalFiles] = useState([]);
  const [encryptedFiles, setEncryptedFiles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('SEMUA');
  const [uploadCategory, setUploadCategory] = useState('LEBARAN');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');

  // --- Lightbox ---
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // --- Upload sheet ---
  const [showUploadSheet, setShowUploadSheet] = useState(false);

  const idleTimeoutRef = useRef(null);

  // --- Auto Lock ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (isUnlocked) idleTimeoutRef.current = setTimeout(handleLock, 300000);
  }, [isUnlocked]);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  // --- Load saved state + handle OAuth redirect token from URL hash ---
  useEffect(() => {
    const savedFiles = localStorage.getItem('family_vault_encrypted_files');
    const savedClientId = localStorage.getItem('family_vault_client_id');
    if (savedClientId) { setClientId(savedClientId); setClientIdInput(savedClientId); }
    if (savedFiles) { try { setEncryptedFiles(JSON.parse(savedFiles)); } catch (e) {} }

    // Handle OAuth2 implicit redirect: token comes back in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const token = params.get('access_token');
      if (token) {
        setGoogleToken(token);
        setGoogleSigningIn(false);
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(user => setGoogleUser(user)).catch(() => {});
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // --- Auto fetch when token available & unlocked ---
  useEffect(() => {
    if (isUnlocked && googleToken) {
      fetchDrivePhotos(googleToken);
    }
  }, [isUnlocked, googleToken]);

  // --- Auto load public photos (no login needed) on unlock ---
  useEffect(() => {
    if (isUnlocked) {
      fetchPublicPhotos();
    }
  }, [isUnlocked]);

  // --- Sign in with Google (redirect flow — works on all mobile browsers) ---
  const handleGoogleSignIn = () => {
    if (!clientId) { setShowClientIdSetup(true); return; }
    setGoogleSigningIn(true);
    setDriveError('');
    // Build Google OAuth2 implicit flow URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin + window.location.pathname,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'true',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // --- Sign out Google ---
  const handleGoogleSignOut = () => {
    if (googleToken && window.google) {
      window.google.accounts.oauth2.revoke(googleToken);
    }
    setGoogleToken(null);
    setGoogleUser(null);
    setDrivePhotos([]);
  };

  // --- Save Client ID ---
  const handleSaveClientId = () => {
    const id = clientIdInput.trim();
    if (!id) return;
    localStorage.setItem('family_vault_client_id', id);
    setClientId(id);
    setShowClientIdSetup(false);
    // No need to re-init token client — redirect flow handles it
  };

  // --- Load public photos from photos.json (no login needed) ---
  const fetchPublicPhotos = async () => {
    setPublicLoading(true);
    setPublicError('');
    try {
      const res = await fetch('/photos.json?t=' + Date.now());
      if (!res.ok) throw new Error('Gagal memuat daftar foto');
      const data = await res.json();
      const photos = (data.photos || []).map(f => ({
        ...f,
        id: f.id,
        source: 'public',
        category: f.albumName || 'LEBARAN',
        // Public thumbnail (works because folder is shared publicly)
        src: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1200`,
        thumbSrc: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1200`,
        driveLink: `https://drive.google.com/file/d/${f.id}/view`,
      }));
      setPublicPhotos(photos);
    } catch (err) {
      setPublicError(err.message);
    } finally {
      setPublicLoading(false);
    }
  };

  // --- Recursively fetch files from a folder and all its subfolders ---
  const fetchFilesFromFolder = async (folderId, token, albumName = 'LEBARAN') => {
    const photos = [];

    // 1. Fetch all image files directly in this folder
    let pageToken = null;
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,createdTime,thumbnailLink)');
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('orderBy', 'createdTime desc');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        const code = data.error?.code || res.status;
        const msg = data.error?.message || 'Gagal memuat foto';
        if (code === 401) throw new Error('Sesi Google habis. Silakan Sign In ulang.');
        if (code === 403) throw new Error('Akses ditolak (403). Pastikan akun Anda punya akses ke folder ini.');
        throw new Error(`Error ${code}: ${msg}`);
      }

      for (const file of (data.files || [])) {
        photos.push({
          id: file.id,
          name: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          mimeType: file.mimeType,
          albumName,
          size: file.size ? (parseInt(file.size) / 1024 / 1024).toFixed(2) + ' MB' : '—',
          createdTime: file.createdTime
            ? new Date(file.createdTime).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
            : '—',
          // Use browser Google session (cookie-based) — works since user is logged in to Google
          src: `https://drive.google.com/uc?id=${file.id}&export=view`,
          thumbSrc: file.thumbnailLink
            ? file.thumbnailLink.replace(/=s\d+$/, '=s600')
            : `https://drive.google.com/thumbnail?id=${file.id}&sz=w600`,
          driveLink: `https://drive.google.com/file/d/${file.id}/view`,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    // 2. Fetch all subfolders in this folder, then recurse
    const subRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const subData = await subRes.json();
    for (const subfolder of (subData.files || [])) {
      const subPhotos = await fetchFilesFromFolder(subfolder.id, token, subfolder.name);
      photos.push(...subPhotos);
    }

    return photos;
  };

  // --- Fetch ALL Drive Photos (recursive through subfolders) ---
  const fetchDrivePhotos = async (token) => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const photos = await fetchFilesFromFolder(FOLDER_ID, token, 'LEBARAN');

      if (photos.length === 0) {
        setDriveError('Tidak ada foto ditemukan di folder maupun subfoldernya. Pastikan folder berisi foto.');
      } else {
        setDrivePhotos(photos);
      }
    } catch (err) {
      console.error('Drive error:', err);
      setDriveError(err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  // --- Unlock (password hardcoded) ---
  const handleUnlock = async (e) => {
    if (e) e.preventDefault();
    const pw = inputPassword.trim();
    if (!pw) { setPasswordError('Masukkan kata sandi.'); return; }
    if (pw !== MASTER_PASSWORD) { setPasswordError('Kata sandi salah!'); return; }
    setUnlocking(true);
    try {
      const decrypted = [];
      for (const encFile of encryptedFiles) {
        const fd = JSON.parse(await decryptData(encFile.payload, MASTER_PASSWORD));
        const fm = JSON.parse(await decryptData(encFile.metadata, MASTER_PASSWORD));
        decrypted.push({ id: encFile.id, ...fm, dataUrl: fd.dataUrl });
      }
      setLocalFiles(decrypted);
      setIsUnlocked(true);
      setPasswordError('');
      setInputPassword('');
    } catch { setPasswordError('Kata sandi salah!'); }
    finally { setUnlocking(false); }
  };

  // --- Lock ---
  const handleLock = () => {
    setIsUnlocked(false);
    setLocalFiles([]);
    setInputPassword('');
    handleGoogleSignOut();
  };

  // --- Batch Upload ---
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true); setUploadError('');
    const updEnc = [...encryptedFiles];
    const newDec = [...localFiles];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Mengenkripsi ${i + 1}/${files.length}...`);
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const id = Date.now() + '-' + i;
        const fp = JSON.stringify({ dataUrl });
        const mp = JSON.stringify({
          name: file.name.split('.')[0], fileName: file.name, fileType: file.type,
          category: uploadCategory, size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          dateAdded: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
        });
        updEnc.push({ id, payload: await encryptData(fp, MASTER_PASSWORD), metadata: await encryptData(mp, MASTER_PASSWORD) });
        newDec.push({ id, category: uploadCategory, name: file.name.split('.')[0], fileName: file.name,
          fileType: file.type, dateAdded: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
          dataUrl, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
      }
      setEncryptedFiles(updEnc);
      localStorage.setItem('family_vault_encrypted_files', JSON.stringify(updEnc));
      setLocalFiles(newDec);
    } catch { setUploadError('Gagal mengunggah foto.'); }
    finally { setUploading(false); setUploadProgress(''); }
  };

  // --- Delete Local ---
  const handleDeleteLocal = (id, name) => {
    if (!window.confirm(`Hapus "${name}"?`)) return;
    const updEnc = encryptedFiles.filter(f => f.id !== id);
    setEncryptedFiles(updEnc);
    localStorage.setItem('family_vault_encrypted_files', JSON.stringify(updEnc));
    setLocalFiles(localFiles.filter(f => f.id !== id));
  };

  // Combine photos — publicPhotos first (no login needed), then drivePhotos (admin), then local
  const allPhotos = [
    ...publicPhotos,
    // Merge drivePhotos that are not already in publicPhotos
    ...drivePhotos
      .filter(dp => !publicPhotos.some(pp => pp.id === dp.id))
      .map(p => ({ ...p, source: 'drive', category: p.albumName || 'LEBARAN' })),
    ...localFiles.map(p => ({ ...p, source: 'local' }))
  ];
  const filteredPhotos = allPhotos.filter(p =>
    selectedCategory === 'SEMUA' || p.category === selectedCategory
  );


  return (
    <div className="app-container">

      {/* LIGHTBOX */}
      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close"><X size={20}/></button>
          <img className="lightbox-img"
            src={lightboxPhoto.src || lightboxPhoto.dataUrl}
            alt={lightboxPhoto.name}
            onClick={e => e.stopPropagation()}
          />
          <div className="lightbox-caption">
            {lightboxPhoto.albumName && lightboxPhoto.albumName !== 'LEBARAN' ? lightboxPhoto.albumName : lightboxPhoto.name}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="header">
        <div className="logo-section">
          <div className="shield-icon-wrapper"><Heart size={22}/></div>
          <div className="app-title-container">
            <h1>Galeri Keluarga <span className="e2e-badge">Privat</span></h1>
            <p className="subtitle">Kenangan indah keluarga besar kita 💕</p>
          </div>
        </div>
        <div className="header-controls">
          {isUnlocked && (
            <button onClick={handleLock} className="btn btn-outline" style={{ fontSize:'0.82rem', padding:'8px 14px' }}>
              <LogOut size={15}/> Kunci
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1 }}>

        {/* LOCK SCREEN */}
        {!isUnlocked && (
          <div className="lock-container">
            <form onSubmit={handleUnlock} style={{ display:'flex', flexDirection:'column', gap:18, width:'100%' }}>
              <div className="lock-header">
                <div className="lock-icon-wrapper">
                  <span style={{ fontSize:'2rem' }}>📸</span>
                </div>
                <h2 className="lock-title">Galeri Foto Keluarga</h2>
                <p className="lock-desc">Masukkan kata sandi untuk melihat foto-foto keluarga 🏠</p>
              </div>
              <div className="form-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputPassword}
                  onChange={e => setInputPassword(e.target.value)}
                  className="text-input"
                  placeholder="Ketik kata sandi di sini..."
                  style={{ textAlign:'center', fontSize:'1.15rem' }}
                  disabled={unlocking} autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="reset-vault-link" style={{ textAlign:'center' }}>
                  {showPassword ? '🙈 Sembunyikan' : '👁️ Tampilkan kata sandi'}
                </button>
              </div>
              {passwordError && (
                <p style={{ color:'#ef4444', fontWeight:700, textAlign:'center', background:'#fee2e2', padding:10, borderRadius:10 }}>
                  ❌ {passwordError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={unlocking}
                style={{ width:'100%', padding:16, fontSize:'1rem', borderRadius:14 }}>
                {unlocking ? '⏳ Membuka...' : '🔓 Masuk Lihat Foto'}
              </button>
            </form>
          </div>
        )}

        {/* GALLERY */}
        {isUnlocked && (
          <div className="vault-workspace">

            {publicLoading && (
              <div style={{ textAlign:'center', padding:'64px 0' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>⏳</div>
                <p style={{ fontWeight:700, color:'var(--text-muted)' }}>Memuat foto keluarga...</p>
              </div>
            )}

            {!publicLoading && (
              <>
                <div className="vault-header-bar">
                  <div>
                    <p style={{ fontWeight:800, fontSize:'1.05rem' }}>
                      📸 {allPhotos.length > 0 ? `${allPhotos.length} Foto Tersimpan` : 'Album Foto Keluarga'}
                    </p>
                    {allPhotos.length > 0 && (
                      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:2 }}>Ketuk foto untuk melihat lebih besar</p>
                    )}
                  </div>
                  <div className="vault-status-badge">
                    <span className="status-dot"></span> Aktif
                  </div>
                </div>

                {/* Filter tabs */}
                <div className="filters-bar">
                  {[
                    { key:'SEMUA', label:'📷 Semua' },
                    { key:'LEBARAN', label:'🌙 Lebaran' },
                    { key:'LIBURAN', label:'✈️ Liburan' },
                    { key:'PERNIKAHAN', label:'💍 Pernikahan' },
                    { key:'LAIN', label:'📁 Lainnya' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setSelectedCategory(key)}
                      className={`filter-tab ${selectedCategory === key ? 'active' : ''}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Photo grid */}
                {filteredPhotos.length === 0 ? (
                  <div className="empty-state">
                    <div className="emoji">🖼️</div>
                    <h3>Belum ada foto</h3>
                    <p>Foto keluarga akan muncul di sini. Tekan tombol <strong>+</strong> di bawah kanan untuk tambah foto.</p>
                  </div>
                ) : (
                  <div className="photo-grid">
                    {filteredPhotos.map(photo => (
                      <div key={photo.id} className="photo-tile" onClick={() => setLightboxPhoto(photo)}>
                        <img
                          src={photo.thumbSrc || photo.src || photo.dataUrl}
                          alt=""
                          loading="lazy"
                          onError={e => { e.target.style.opacity = '0'; }}
                        />
                        {photo.albumName && photo.albumName !== 'LEBARAN' && (
                          <span className="photo-tile-badge">{photo.albumName}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* FLOATING UPLOAD BUTTON */}
        {isUnlocked && (
          <button className="fab-upload" onClick={() => setShowUploadSheet(true)} title="Tambah Foto">
            +
          </button>
        )}

        {/* UPLOAD BOTTOM SHEET */}
        {showUploadSheet && (
          <div className="upload-sheet-overlay" onClick={() => setShowUploadSheet(false)}>
            <div className="upload-sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-handle"/>
              <h3 style={{ fontWeight:800, fontSize:'1.1rem' }}>📤 Tambah Foto</h3>
              <div className="form-group">
                <label className="form-label">Pilih Album:</label>
                <div className="category-select-grid">
                  {[['LEBARAN','🌙 Lebaran'],['LIBURAN','✈️ Liburan'],['PERNIKAHAN','💍 Pernikahan'],['LAIN','📁 Lainnya']].map(([cat,label]) => (
                    <button key={cat} type="button"
                      onClick={() => setUploadCategory(cat)}
                      className={`btn-select-category ${uploadCategory === cat ? 'active' : ''}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dropzone">
                <input type="file" accept="image/*" multiple
                  onChange={async e => { await handleFileUpload(e); setShowUploadSheet(false); }}
                  className="dropzone-file-input" disabled={uploading}/>
                <div className="dropzone-icon-wrapper"><Camera size={26}/></div>
                <p style={{ fontWeight:800, color:'var(--pink)' }}>{uploading ? '⏳ Menyimpan...' : '📷 Pilih Foto dari HP'}</p>
                <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Bisa pilih banyak foto sekaligus</p>
              </div>
              {uploadProgress && <p style={{ textAlign:'center', color:'var(--pink)', fontWeight:700 }}>{uploadProgress}</p>}
              {uploadError && <p style={{ textAlign:'center', color:'#ef4444', fontWeight:700 }}>{uploadError}</p>}
              <button onClick={() => setShowUploadSheet(false)} className="btn btn-outline" style={{ width:'100%' }}>Batal</button>
            </div>
          </div>
        )}

      </main>

      <footer className="footer">❤️ Dibuat dengan kasih sayang untuk keluarga besar kita</footer>
    </div>
  );
}
