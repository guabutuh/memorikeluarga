import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Trash2, FolderOpen, Camera, LogOut,
  Heart, KeyRound, RefreshCw, X, ExternalLink,
  Download, ZoomIn, LogIn, CheckCircle, ImageOff
} from 'lucide-react';
import { encryptData, decryptData } from './encryption';

const FOLDER_ID = '1rvEOVGK93P2eYwnOO2FFB-_fpndCTqVo';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

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
  const [hasSetup, setHasSetup] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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

  // --- Drive Photos ---
  const [drivePhotos, setDrivePhotos] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');

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
    const savedMaster = localStorage.getItem('family_vault_master_pin_check');
    const savedFiles = localStorage.getItem('family_vault_encrypted_files');
    const savedClientId = localStorage.getItem('family_vault_client_id');
    if (savedMaster) { setHasSetup(true); setMasterPassword(savedMaster); }
    if (savedClientId) { setClientId(savedClientId); setClientIdInput(savedClientId); }
    if (savedFiles) { try { setEncryptedFiles(JSON.parse(savedFiles)); } catch (e) {} }

    // Handle OAuth2 implicit redirect: token comes back in URL hash
    // e.g. https://memorikeluarga.vercel.app/#access_token=xxx&token_type=Bearer&expires_in=3599
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const token = params.get('access_token');
      if (token) {
        setGoogleToken(token);
        setGoogleSigningIn(false);
        // Fetch user info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(user => setGoogleUser(user)).catch(() => {});
        // Clean up URL so token is not visible / bookmarkable
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

  // --- Vault Setup ---
  const handleSetupPassword = async (e) => {
    e.preventDefault();
    const cleanPw = inputPassword.trim();
    if (cleanPw.length < 4) { setPasswordError('Minimal 4 karakter!'); return; }
    if (cleanPw !== passwordConfirm.trim()) { setPasswordError('Konfirmasi tidak cocok!'); return; }
    localStorage.setItem('family_vault_master_pin_check', cleanPw);
    setMasterPassword(cleanPw);
    setHasSetup(true);
    setInputPassword(''); setPasswordConfirm(''); setPasswordError('');
  };

  // --- Unlock ---
  const handleUnlock = async (e) => {
    if (e) e.preventDefault();
    const pw = inputPassword.trim();
    if (!pw) { setPasswordError('Masukkan kata sandi.'); return; }
    if (pw !== masterPassword) { setPasswordError('Kata sandi salah!'); return; }
    setUnlocking(true);
    try {
      const decrypted = [];
      for (const encFile of encryptedFiles) {
        const fd = JSON.parse(await decryptData(encFile.payload, pw));
        const fm = JSON.parse(await decryptData(encFile.metadata, pw));
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
        updEnc.push({ id, payload: await encryptData(fp, masterPassword), metadata: await encryptData(mp, masterPassword) });
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

  // Combine photos
  const allPhotos = [
    ...drivePhotos.map(p => ({ ...p, source: 'drive', category: p.albumName || 'LEBARAN' })),
    ...localFiles.map(p => ({ ...p, source: 'local' }))
  ];
  const filteredPhotos = allPhotos.filter(p =>
    selectedCategory === 'SEMUA' || p.category === selectedCategory
  );

  return (
    <div className="app-container">
      {/* Lightbox */}
      {lightboxPhoto && (
        <div onClick={() => setLightboxPhoto(null)} style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.93)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'zoom-out', animation: 'fadeIn 0.2s ease', padding: 16
        }}>
          <button onClick={() => setLightboxPhoto(null)} style={{
            position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
            width: 44, height: 44, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><X size={20}/></button>
          <img src={lightboxPhoto.src || lightboxPhoto.dataUrl} alt={lightboxPhoto.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '93vw', maxHeight: '90vh', borderRadius: 16,
              boxShadow: '0 30px 80px rgba(0,0,0,0.8)', objectFit: 'contain', cursor: 'default' }}
          />
          <p style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80vw' }}>
            {lightboxPhoto.name}
          </p>
        </div>
      )}

      {/* Client ID Setup Modal */}
      {showClientIdSetup && (
        <div onClick={() => setShowClientIdSetup(false)} style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--border)', borderRadius: 24,
            padding: 32, maxWidth: 520, width: '100%'
          }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>⚙️ Setup Google OAuth Client ID</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 6, lineHeight: 1.65 }}>
              Untuk muat semua foto Drive otomatis, perlu <strong>OAuth 2.0 Client ID</strong>. Cara mendapatkannya:
            </p>
            <ol style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: 20, marginBottom: 16, lineHeight: 2 }}>
              <li>Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', fontWeight: 700 }}>console.cloud.google.com/apis/credentials</a></li>
              <li>Klik <strong>"Create Credentials"</strong> → <strong>"OAuth 2.0 Client ID"</strong></li>
              <li>Application type: <strong>Web application</strong></li>
              <li>Authorized JavaScript origins: tambah <code style={{ background: 'rgba(168,85,247,0.15)', padding: '1px 6px', borderRadius: 4 }}>http://localhost:5173</code></li>
              <li>Klik <strong>Create</strong> → Copy <strong>Client ID</strong>-nya</li>
            </ol>
            <input type="text" value={clientIdInput} onChange={e => setClientIdInput(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com" className="text-input"
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleSaveClientId} className="btn btn-primary"
                style={{ flex: 1, background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' }}>
                Simpan & Aktifkan
              </button>
              <button onClick={() => setShowClientIdSetup(false)} className="btn btn-outline" style={{ padding: '10px 16px' }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <div className="shield-icon-wrapper" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' }}>
            <Heart size={24}/>
          </div>
          <div className="app-title-container">
            <h1>
              Galeri Kenangan Keluarga Besar
              <span className="e2e-badge" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' }}>Privat</span>
            </h1>
            <p className="subtitle">Mengingat Momen Indah Bersama Secara Aman & Rahasia</p>
          </div>
        </div>
        <div className="header-controls">
          {isUnlocked && googleUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12, padding: '6px 14px' }}>
              <img src={googleUser.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}/>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#22c55e' }}>{googleUser.name}</span>
              <button onClick={handleGoogleSignOut} style={{ background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>Keluar</button>
            </div>
          )}
          {isUnlocked && (
            <button onClick={handleLock} className="btn btn-danger" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
              <LogOut size={16}/> <span>Kunci</span>
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Lock Screen */}
        {!isUnlocked && (
          <div className="lock-container">
            {!hasSetup ? (
              <form onSubmit={handleSetupPassword} style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                <div className="lock-header">
                  <div className="lock-icon-wrapper" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
                    <KeyRound size={32}/>
                  </div>
                  <h2 className="lock-title">Buat Sandi Keluarga</h2>
                  <p className="lock-desc">Buat kata sandi rahasia yang mudah diingat seluruh keluarga.</p>
                </div>
                <div className="setup-pin-fields" style={{ width: '100%' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'left' }}>Kata Sandi Baru:</label>
                    <input type={showPassword ? 'text' : 'password'} value={inputPassword}
                      onChange={e => setInputPassword(e.target.value)} className="text-input"
                      placeholder="Masukkan kata sandi baru..." style={{ fontSize: '1.1rem' }}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'left' }}>Konfirmasi:</label>
                    <input type={showPassword ? 'text' : 'password'} value={passwordConfirm}
                      onChange={e => setPasswordConfirm(e.target.value)} className="text-input"
                      placeholder="Ulangi kata sandi..." style={{ fontSize: '1.1rem' }}/>
                  </div>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="reset-vault-link">
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                {passwordError && <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{passwordError}</p>}
                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
                  Simpan & Aktifkan Galeri
                </button>
              </form>
            ) : (
              <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                <div className="lock-header">
                  <div className="lock-icon-wrapper" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
                    <KeyRound size={32}/>
                  </div>
                  <h2 className="lock-title">Pintu Masuk Keluarga</h2>
                  <p className="lock-desc">Masukkan kata sandi rahasia keluarga besar.</p>
                </div>
                <div className="form-group" style={{ width: '100%' }}>
                  <input type={showPassword ? 'text' : 'password'} value={inputPassword}
                    onChange={e => setInputPassword(e.target.value)} className="text-input"
                    placeholder="Ketik kata sandi keluarga..." style={{ textAlign: 'center', fontSize: '1.1rem' }}
                    disabled={unlocking}/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="reset-vault-link" style={{ marginTop: 8 }}>
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                {passwordError && <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{passwordError}</p>}
                <button type="submit" className="btn btn-primary" disabled={unlocking}
                  style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
                  {unlocking ? 'Membuka...' : 'Buka Pintu Masuk 🔑'}
                </button>
                <div className="lock-footer-info">
                  <span>🛡️ Enkripsi AES-256</span>
                  <button type="button" className="reset-vault-link"
                    onClick={() => { if (window.confirm('Hapus semua data?')) { localStorage.clear(); window.location.reload(); } }}>
                    Setel Ulang
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Unlocked Dashboard */}
        {isUnlocked && (
          <div className="vault-workspace">
            <div className="vault-header-bar">
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>📸 Album Foto Keluarga Besar</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                  {drivePhotos.length > 0
                    ? `${drivePhotos.length} foto dari Google Drive`
                    : 'Login Google Drive untuk muat semua foto otomatis'}
                  {localFiles.length > 0 ? ` • ${localFiles.length} foto lokal` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!googleToken ? (
                  <button onClick={handleGoogleSignIn} disabled={googleSigningIn}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)', fontSize: '0.9rem', padding: '10px 20px', gap: 8 }}>
                    {googleSigningIn
                      ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }}/> Menghubungkan...</>
                      : <><LogIn size={16}/> Masuk dengan Google Drive</>}
                  </button>
                ) : (
                  <button onClick={() => fetchDrivePhotos(googleToken)} disabled={driveLoading}
                    className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '8px 14px' }}>
                    <RefreshCw size={14} style={{ animation: driveLoading ? 'spin 1s linear infinite' : 'none' }}/>
                    {driveLoading ? 'Memuat...' : 'Refresh Drive'}
                  </button>
                )}
                <div className="vault-status-badge" style={{ color: '#ec4899', borderColor: 'rgba(236,72,153,0.2)', backgroundColor: 'rgba(236,72,153,0.1)' }}>
                  <span className="status-dot" style={{ backgroundColor: '#ec4899', boxShadow: '0 0 8px #ec4899' }}></span>
                  <span>Galeri Aktif</span>
                </div>
              </div>
            </div>

            {/* Drive error */}
            {driveError && !driveLoading && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 12,
                alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.9rem' }}>⚠️ {driveError}</span>
              </div>
            )}

            {/* Drive loading */}
            {driveLoading && (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12, animation: 'pulse 1.5s ease infinite' }}>📂</div>
                <p style={{ fontWeight: 700 }}>Memuat semua foto dari Google Drive Anda...</p>
              </div>
            )}

            <div className="vault-grid-layout">
              {/* Upload Panel */}
              <div className="upload-panel">

                {/* Google Sign-in CTA (when not connected) */}
                {!googleToken && !googleSigningIn && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(66,133,244,0.12), rgba(52,168,83,0.12))',
                    border: '1px solid rgba(66,133,244,0.3)', borderRadius: 16, padding: '20px 18px', marginBottom: 20 }}>
                    <p style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>
                      ☁️ Muat Semua Foto dari Google Drive
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.6, marginBottom: 14 }}>
                      Login Google Drive sekali, semua foto Lebaran 2026 di folder Anda langsung muncul otomatis — tanpa unduh, tanpa upload manual!
                    </p>
                    {!clientId ? (
                      <button onClick={() => setShowClientIdSetup(true)} className="btn btn-primary"
                        style={{ width: '100%', background: 'linear-gradient(135deg, #4285F4, #34A853)', fontSize: '0.88rem' }}>
                        ⚙️ Setup Sekali → Login Google Drive
                      </button>
                    ) : (
                      <button onClick={handleGoogleSignIn} className="btn btn-primary"
                        style={{ width: '100%', background: 'linear-gradient(135deg, #4285F4, #34A853)', fontSize: '0.88rem' }}>
                        <LogIn size={16}/> Masuk dengan Google Drive
                      </button>
                    )}
                  </div>
                )}

                {googleToken && googleUser && (
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CheckCircle size={20} color="#22c55e"/>
                    <div>
                      <p style={{ fontWeight: 800, color: '#22c55e', fontSize: '0.9rem' }}>Google Drive Terhubung!</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{googleUser.email}</p>
                    </div>
                  </div>
                )}

                <h3 style={{ fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={20}/> Upload Foto Lokal
                </h3>
                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Kategori Album:</label>
                  <div className="category-select-grid">
                    {['LEBARAN','LIBURAN','PERNIKAHAN','LAIN'].map(cat => (
                      <button key={cat} type="button" onClick={() => setUploadCategory(cat)}
                        className={`btn-select-category ${uploadCategory === cat ? 'active' : ''}`}
                        style={uploadCategory === cat ? { background: 'linear-gradient(135deg, #ec4899, #db2777)', borderColor: '#ec4899' } : {}}>
                        {cat === 'LAIN' ? 'Lainnya' : cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <div className="dropzone" style={{ backgroundColor: 'rgba(236,72,153,0.08)', borderColor: '#ec4899' }}>
                    <input type="file" accept="image/*" multiple onChange={handleFileUpload}
                      className="dropzone-file-input" disabled={uploading}/>
                    <div className="dropzone-icon-wrapper" style={{ color: '#ec4899' }}><Camera size={28}/></div>
                    <div>
                      <p style={{ fontWeight: 800, color: '#ec4899' }}>{uploading ? 'Mengenkripsi...' : 'Pilih Banyak Foto Sekaligus'}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Bisa pilih banyak foto sekaligus</p>
                    </div>
                  </div>
                </div>
                {uploadProgress && <p style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>{uploadProgress}</p>}
                {uploadError && <p style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.85rem' }}>{uploadError}</p>}
              </div>

              {/* Photos Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="filters-bar">
                  {['SEMUA','LEBARAN','LIBURAN','PERNIKAHAN','LAIN'].map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
                      style={selectedCategory === cat ? { background: 'linear-gradient(135deg, #ec4899, #db2777)' } : {}}>
                      {cat === 'SEMUA' ? `Semua (${allPhotos.length})` : cat === 'LAIN' ? 'Lainnya' : `${cat} (${allPhotos.filter(p => p.category === cat).length})`}
                    </button>
                  ))}
                </div>

                {filteredPhotos.length === 0 && !driveLoading ? (
                  <div className="empty-state-card">
                    <div className="empty-icon-wrapper" style={{ color: '#ec4899', backgroundColor: 'rgba(236,72,153,0.1)' }}>
                      <FolderOpen size={32}/>
                    </div>
                    <h3 style={{ fontWeight: 800 }}>Belum Ada Foto</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 340 }}>
                      {!googleToken
                        ? 'Klik tombol "Masuk dengan Google Drive" untuk memuat semua foto Lebaran 2026 secara otomatis!'
                        : 'Tidak ada foto di kategori ini.'}
                    </p>
                  </div>
                ) : (
                  <div className="docs-grid-container">
                    {filteredPhotos.map(photo => (
                      <div key={photo.id} className="document-item-card animate-fade-in">
                        <div className="doc-preview-area" onClick={() => setLightboxPhoto(photo)} style={{ cursor: 'zoom-in' }}>
                          {photo.source === 'drive' ? (
                            <AuthImage
                              fileId={photo.id}
                              accessToken={googleToken}
                              alt={photo.name}
                              className="doc-preview-img"
                            />
                          ) : (
                            <img
                              src={photo.dataUrl}
                              alt={photo.name}
                              className="doc-preview-img"
                              loading="lazy"
                            />
                          )}
                          <div className="photo-overlay" style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.25s', borderRadius: 'inherit'
                          }}>
                            <ZoomIn size={32} color="white" className="zoom-icon" style={{ opacity: 0, transition: 'opacity 0.25s' }}/>
                          </div>
                          <span className="doc-category-badge" style={{
                            background: photo.source === 'drive'
                              ? 'linear-gradient(135deg, #4285F4, #34A853)'
                              : 'linear-gradient(135deg, #ec4899, #db2777)'
                          }}>
                            {photo.source === 'drive' ? '☁️ Drive' : photo.category}
                          </span>
                        </div>
                        <div className="doc-details-area">
                          <div>
                            <h4 className="doc-title" title={photo.name}>{photo.name}</h4>
                            <p className="doc-meta" style={{ marginTop: 4 }}>
                              {photo.createdTime || photo.dateAdded}
                              {photo.size && photo.size !== '—' ? ` • ${photo.size}` : ''}
                            </p>
                          </div>
                          <div className="doc-card-actions">
                            {photo.source === 'drive' ? (
                              <a href={photo.driveLink} target="_blank" rel="noopener noreferrer"
                                className="btn btn-outline" style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}>
                                <ExternalLink size={13}/> Buka Drive
                              </a>
                            ) : (
                              <>
                                <a href={photo.dataUrl} download={photo.fileName} className="btn btn-outline"
                                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}>
                                  <Download size={13}/> Unduh
                                </a>
                                <button onClick={() => handleDeleteLocal(photo.id, photo.name)} className="btn btn-danger"
                                  style={{ padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                                  <Trash2 size={16}/>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p style={{ fontWeight: 'bold' }}>❤️ Dibuat dengan kasih sayang untuk keluarga besar kita.</p>
        <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Galeri Lebaran 2026 · Foto Google Drive via OAuth2 · Data lokal dienkripsi AES-256
        </p>
      </footer>
    </div>
  );
}
