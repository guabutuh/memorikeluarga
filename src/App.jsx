import { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { Download } from 'lucide-react';

const FOLDER_ID = '1rvEOVGK93P2eYwnOO2FFB-_fpndCTqVo';
const MASTER_PASSWORD = 'Multatuli19';

const dictionary = {
  id: {
      subtitle: "Arsip Memori Keluarga",
      mascotGreeting: "Jangan Biarkan Kenangan Keluarga Kita Punah! 🦖📸",
      mascotInstructions: "Mari kumpulkan semua senyuman, liburan, dan makan bersama di album rapi ini. Mudah digunakan oleh cucu yang paling kecil hingga kakek-nenek tercinta. Klik tombol di bawah untuk mulai mengabadikan cerita kita!",
      statsLabel: "Foto",
      galleryTitle: "Galeri Foto Utama",
      searchPlaceholder: "Cari kenangan manis...",
      addMemoryBigBtn: "Unggah Foto Baru",
      catAll: "Semua Memori",
      catHoliday: "Jalan-jalan",
      catFeast: "Hari Raya",
      catBirthday: "Hari Spesial",
      catDaily: "Kumpul Rumah",
      emptyTitle: "Belum ada telur memori menetas",
      emptySubtitle: "Silakan unggah foto kenangan pertama Anda untuk mulai mengisi galeri ini.",
      btnCancel: "Batal",
      btnSave: "Simpan",
      modalAddPhotoTitle: "Unggah Kenangan Baru",
      modalAddPhotoSub: "Isi detail di bawah untuk menyimpan cerita indah Anda.",
      labelPickPhoto: "Pilih Foto",
      uploadPlaceholderText: "Pilih berkas dari perangkat Anda",
      labelMemoryTitle: "Judul Memori",
      labelDescription: "Catatan Cerita",
      descPlaceholder: "Tuliskan cerita singkat tentang momen manis ini...",
      labelCategory: "Kategori",
      labelDate: "Tanggal",
      deleteMemory: "Hapus Foto",
      alertSelectPhoto: "Pilih berkas foto dulu ya, Om & Tante! 🦖",
      confirmDeleteTitle: "Hapus Kenangan Ini?",
      confirmDeleteMsg: "Apakah Anda yakin ingin menghapus foto kenangan ini secara permanen?",
      toastPhotoSaved: "Kenangan berhasil disimpan dengan aman! 🎉",
      toastDeleted: "Kenangan berhasil dihapus.",
      unlockTitle: "Halo Keluarga! 🦖",
      unlockDesc: "Masukkan sandi rahasia untuk melihat memori kita ya.",
      unlockBtn: "Buka Album",
      wrongPass: "Sandi salah, coba ingat-ingat lagi!"
  },
  en: {
      subtitle: "Family Memory Archive",
      mascotGreeting: "Don't Let Our Family Memories Go Extinct! 🦖📸",
      mascotInstructions: "Let's gather all smiles, vacations, and dinners in this neat album. Super easy to use for everyone from the little ones to beloved grandma and grandpa!",
      statsLabel: "Photos",
      galleryTitle: "Main Photo Gallery",
      searchPlaceholder: "Search sweet memories...",
      addMemoryBigBtn: "Upload New Photo",
      catAll: "All Memories",
      catHoliday: "Vacation",
      catFeast: "Feast Day",
      catBirthday: "Special Day",
      catDaily: "Daily Meetups",
      emptyTitle: "No memory eggs hatched yet",
      emptySubtitle: "Please upload your first family photo to start filling this gallery.",
      btnCancel: "Cancel",
      btnSave: "Save",
      modalAddPhotoTitle: "Upload New Memory",
      modalAddPhotoSub: "Complete the details below to archive your sweet memory.",
      labelPickPhoto: "Select Photo",
      uploadPlaceholderText: "Select file from your device",
      labelMemoryTitle: "Memory Title",
      labelDescription: "Story Notes",
      descPlaceholder: "Write a short story about this lovely moment...",
      labelCategory: "Category",
      labelDate: "Date",
      deleteMemory: "Delete Photo",
      alertSelectPhoto: "Please select a photo file first! 🦖",
      confirmDeleteTitle: "Delete This Memory?",
      confirmDeleteMsg: "Are you sure you want to permanently delete this memory?",
      toastPhotoSaved: "Memory successfully saved! 🎉",
      toastDeleted: "Memory successfully deleted.",
      unlockTitle: "Hello Family! 🦖",
      unlockDesc: "Enter the secret password to view our memories.",
      unlockBtn: "Open Album",
      wrongPass: "Wrong password, try again!"
  }
};

export default function App() {
  const [lang, setLang] = useState('id');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState('text-base');
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState(false);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [photos, setPhotos] = useState([]);
  const [publicLoading, setPublicLoading] = useState(true);
  
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [toastMsg, setToastMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize Theme
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch Public Photos from JSON
  useEffect(() => {
    fetch('/photos.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => {
        const photosArray = data.photos || [];
        const drivePhotos = photosArray.map(p => ({
          ...p,
          source: 'drive',
          date: p.albumName === 'LEBARAN' ? '2026-04-10' : '2026-01-01',
          category: p.albumName === 'LEBARAN' ? 'hariraya' : 'liburan',
          thumbSrc: `https://drive.google.com/thumbnail?id=${p.id}&sz=w400`,
          src: `https://drive.google.com/thumbnail?id=${p.id}&sz=w2000`
        }));
        
        localforage.getItem('omaopa_dino_photos').then(localData => {
          const local = localData || [];
          setPhotos([...local, ...drivePhotos]);
          setPublicLoading(false);
        });
      })
      .catch(() => {
        localforage.getItem('omaopa_dino_photos').then(localData => {
          setPhotos(localData || []);
          setPublicLoading(false);
        });
      });
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === MASTER_PASSWORD) {
      setIsUnlocked(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    if (!file) {
      alert(dictionary[lang].alertSelectPhoto);
      return;
    }
    
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const newPhoto = {
        id: 'local_' + Date.now(),
        name: e.target.title?.value || 'Memori Baru',
        desc: e.target.desc?.value || '',
        category: e.target.category?.value || 'harian',
        date: e.target.date?.value || new Date().toISOString().split('T')[0],
        dataUrl: ev.target.result,
        source: 'local'
      };
      
      const updatedPhotos = [newPhoto, ...photos];
      setPhotos(updatedPhotos);
      
      const localOnly = updatedPhotos.filter(p => p.source === 'local');
      await localforage.setItem('omaopa_dino_photos', localOnly);
      
      setUploading(false);
      setShowUpload(false);
      showToast(dictionary[lang].toastPhotoSaved);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(dictionary[lang].confirmDeleteMsg)) return;
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    
    const localOnly = updated.filter(p => p.source === 'local');
    await localforage.setItem('omaopa_dino_photos', localOnly);
    
    setLightboxPhoto(null);
    showToast(dictionary[lang].toastDeleted);
  };

  const handleDownload = async (photo) => {
    try {
      const url = photo.dataUrl || photo.src || `https://drive.google.com/thumbnail?id=${photo.id}&sz=w2000`;
      
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${photo.name || 'foto_keluarga'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      alert("❌ Gagal membuka foto.");
    }
  };

  const filteredPhotos = photos.filter(p => {
    const matchesCat = activeCategory === 'all' || p.category === activeCategory;
    const searchString = (p.name || p.title || p.desc || '').toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const d = dictionary[lang];

  return (
    <div className={`bg-brand-light text-slate-700 transition-colors duration-300 dark:bg-brand-dark dark:text-slate-200 min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900 ${fontSize}`}>
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-blue-100/50 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-md transform hover:scale-105 hover:rotate-6 transition-transform cursor-pointer">
              <span className="text-xl">🦕</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-1.5 font-cute">
                OmaOpa <span className="text-xs px-2.5 py-0.5 bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full font-bold font-sans">DinoAlbum</span>
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 font-bold tracking-wider uppercase">{d.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 flex items-center gap-0.5 border border-slate-200/50 dark:border-slate-700/50">
              <button onClick={() => setFontSize('text-sm')} className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${fontSize==='text-sm' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}>A</button>
              <button onClick={() => setFontSize('text-base')} className={`px-2.5 py-0.5 text-sm font-bold rounded-lg transition-all ${fontSize==='text-base' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}>A</button>
              <button onClick={() => setFontSize('text-lg')} className={`px-2.5 py-0.5 text-base font-bold rounded-lg transition-all ${fontSize==='text-lg' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}>A+</button>
            </div>
            <button onClick={() => setLang(lang === 'id' ? 'en' : 'id')} className="btn-bouncy w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300 shadow-xs">
              {lang.toUpperCase()}
            </button>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="btn-bouncy w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-amber-400 shadow-xs">
              <i className={theme === 'dark' ? 'fas fa-moon text-blue-400' : 'fas fa-sun text-amber-500'}></i>
            </button>
            {isUnlocked && (
              <button onClick={() => setIsUnlocked(false)} className="btn-bouncy w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 hover:bg-red-100 flex items-center justify-center text-red-500 shadow-xs">
                <i className="fas fa-sign-out-alt"></i>
              </button>
            )}
          </div>
        </div>
      </header>

      {!isUnlocked ? (
        <main className="max-w-md mx-auto mt-20 px-5 w-full">
          <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-3xl p-8 dino-shadow text-center">
            <div className="text-5xl mb-4 elegant-float">🦕</div>
            <h2 className="text-2xl font-bold font-cute mb-2 text-slate-800 dark:text-slate-100">{d.unlockTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{d.unlockDesc}</p>
            <form onSubmit={handleUnlock} className="space-y-4">
              <input 
                type="password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Kata sandi..." 
                className="w-full text-center px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {passError && <p className="text-xs font-bold text-red-500">{d.wrongPass}</p>}
              <button type="submit" className="w-full btn-bouncy py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-md font-cute text-lg">
                {d.unlockBtn}
              </button>
            </form>
          </div>
        </main>
      ) : (
        <>
          <section className="max-w-5xl mx-auto px-5 mt-6 w-full">
            <div className="bg-gradient-to-r from-blue-100/70 via-blue-50/50 to-amber-50/30 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-800/20 border border-blue-200/50 dark:border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center gap-6 dino-shadow elegant-float">
              <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                  <path d="M 25,85 C 25,45 45,20 70,20 C 85,20 90,38 90,50 C 90,65 82,85 45,85 Z" fill="#60A5FA" />
                  <path d="M 25,38 L 18,28 L 32,32 Z" fill="#FBBF24" />
                  <path d="M 18,50 L 8,43 L 22,45 Z" fill="#FBBF24" />
                  <path d="M 20,65 L 10,58 L 24,60 Z" fill="#FBBF24" />
                  <path d="M 45,85 C 48,60 68,60 75,85" fill="#EFF6FF" opacity="0.9" />
                  <circle cx="72" cy="38" r="5" fill="#1E293B" />
                  <circle cx="70.5" cy="36.5" r="1.5" fill="#FFFFFF" />
                  <circle cx="73.5" cy="39.5" r="0.8" fill="#FFFFFF" />
                  <circle cx="65" cy="46" r="4.5" fill="#F87171" opacity="0.5" />
                  <path d="M 68,46 Q 73,50 78,44" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                  <rect x="35" y="65" width="18" height="12" rx="3" fill="#FB923C" />
                  <circle cx="44" cy="71" r="4" fill="#FFFFFF" />
                  <circle cx="44" cy="71" r="1.8" fill="#1E293B" />
                  <rect x="39" y="62" width="5" height="3" rx="0.5" fill="#F97316" />
                </svg>
              </div>
              <div className="text-center md:text-left flex-1">
                <div className="inline-block bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold px-3 py-1 rounded-full text-[11px] tracking-wider uppercase mb-2 font-cute">
                  🦕 Dino Memori Berkata:
                </div>
                <h2 className="text-lg md:text-xl font-bold mb-1.5 text-slate-800 dark:text-slate-100 font-cute">
                  {d.mascotGreeting}
                </h2>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                  {d.mascotInstructions}
                </p>
              </div>
            </div>
          </section>

          <main className="max-w-5xl mx-auto px-5 py-6 w-full flex-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-3xl p-5 dino-shadow space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={d.searchPlaceholder} 
                    className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition-all font-cute" 
                  />
                  <i className="fas fa-search absolute left-3.5 top-3.5 text-blue-400 text-[11px]"></i>
                </div>
                <button onClick={() => setShowUpload(true)} className="btn-bouncy w-full sm:w-auto px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 font-cute">
                  <span>🦖</span>
                  <span>{d.addMemoryBigBtn}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none border-t border-slate-100 dark:border-slate-800/80 pt-4">
                {[
                  { id: 'all', emoji: '🦕', label: d.catAll },
                  { id: 'liburan', emoji: '🏖️', label: d.catHoliday },
                  { id: 'hariraya', emoji: '🌙', label: d.catFeast },
                  { id: 'ultah', emoji: '🎂', label: d.catBirthday },
                  { id: 'harian', emoji: '🏡', label: d.catDaily }
                ].map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`btn-bouncy px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap ${activeCategory === cat.id ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700'}`}
                  >
                    {cat.emoji} <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 font-cute">
                <span>📂</span> <span>{d.galleryTitle}</span>
              </h3>
              <div className="px-3.5 py-1 bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-200/50 dark:border-amber-800/30">
                <span>⭐</span> <span>{filteredPhotos.length}</span> <span>{d.statsLabel}</span>
              </div>
            </div>

            {publicLoading ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3 elegant-float">⏳</div>
                <p className="font-bold text-slate-500 font-cute">Memuat telur memori...</p>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl dino-shadow">
                <div className="text-5xl mb-3 elegant-float">🥚</div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 font-cute">{d.emptyTitle}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">{d.emptySubtitle}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filteredPhotos.map((photo, index) => {
                  let catEmoji = "📸";
                  let catName = photo.category;
                  if (photo.category === 'liburan') { catEmoji = "🏖️"; catName = d.catHoliday; }
                  else if (photo.category === 'hariraya') { catEmoji = "🌙"; catName = d.catFeast; }
                  else if (photo.category === 'ultah') { catEmoji = "🎂"; catName = d.catBirthday; }
                  else if (photo.category === 'harian') { catEmoji = "🏡"; catName = d.catDaily; }

                  return (
                    <div key={photo.id} onClick={() => setLightboxPhoto(photo)} className="animate-pop bg-white dark:bg-slate-900 border border-blue-100/50 dark:border-slate-800 rounded-3xl overflow-hidden dino-shadow hover:border-blue-300 dark:hover:border-slate-700 transform hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer p-3" style={{ animationDelay: `${(index % 15) * 0.05}s` }}>
                      <div className="h-44 w-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <img src={photo.thumbSrc || photo.src || photo.dataUrl} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" alt={photo.name} loading="lazy" />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs text-[10px] font-bold rounded-xl text-slate-700 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-1 font-cute">
                          <span>{catEmoji}</span> <span>{catName}</span>
                        </span>
                      </div>
                      <div className="pt-3 pb-1 px-1 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-1">
                            <span><i className="far fa-calendar-alt text-blue-500/80 mr-1"></i> {photo.date || '2026'}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 leading-snug line-clamp-1 font-cute">{photo.name || photo.title || photo.albumName}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{photo.desc || 'Momen indah bersama keluarga tercinta.'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          <footer className="bg-white dark:bg-slate-900 border-t border-blue-50 dark:border-slate-800/80 transition-colors duration-300 py-6 mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 font-cute">🦕 OmaOpa Dino Memory Space 🦕</p>
            <p>© 2026 Keluarga Besar Oma & Opa. Hak Cipta Dilindungi.</p>
          </footer>

          {/* LIGHTBOX / DETAIL MODAL */}
          {lightboxPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs" onClick={() => setLightboxPhoto(null)}>
              <div className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-4 shadow-2xl max-h-[95vh] overflow-y-auto transform transition-transform duration-300" onClick={e => e.stopPropagation()}>
                <button onClick={() => setLightboxPhoto(null)} className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs transition-colors z-10">
                  <i className="fas fa-times"></i>
                </button>
                <div className="rounded-2xl overflow-hidden mb-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <img src={lightboxPhoto.src || lightboxPhoto.dataUrl || `https://drive.google.com/thumbnail?id=${lightboxPhoto.id}&sz=w2000`} className="w-full max-h-[50vh] object-contain mx-auto" alt={lightboxPhoto.name} />
                </div>
                <div className="space-y-3 px-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1 font-cute">{lightboxPhoto.name || lightboxPhoto.title || lightboxPhoto.albumName}</h3>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      <p className="font-bold"><i className="far fa-calendar-alt text-blue-500 mr-1"></i> {lightboxPhoto.date || '2026'}</p>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-line">
                    {lightboxPhoto.desc || 'Momen indah bersama keluarga tercinta.'}
                  </p>
                  <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                    <button onClick={() => handleDownload(lightboxPhoto)} className="btn-bouncy px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors font-cute">
                      <Download size={14}/> <span>Simpan ke HP</span>
                    </button>
                    {lightboxPhoto.source === 'local' && (
                      <button onClick={() => handleDelete(lightboxPhoto.id)} className="btn-bouncy px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors font-cute">
                        <i className="fas fa-trash-alt"></i> <span>{d.deleteMemory}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD MODAL */}
          {showUpload && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-950 border border-blue-100 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 relative shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300">
                <button onClick={() => setShowUpload(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <i className="fas fa-times"></i>
                </button>
                <div className="text-center mb-5">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto text-sm mb-2">📸</div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-cute">{d.modalAddPhotoTitle}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{d.modalAddPhotoSub}</p>
                </div>
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-cute">{d.labelPickPhoto}</label>
                    <input type="file" ref={fileInputRef} accept="image/*" className="w-full text-xs text-slate-500" required disabled={uploading}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-cute">{d.labelMemoryTitle}</label>
                    <input type="text" name="title" required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-cute">{d.labelDescription}</label>
                    <textarea name="desc" rows="2" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-cute">{d.labelCategory}</label>
                      <select name="category" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-cute">
                        <option value="liburan">🏖️ Jalan-jalan</option>
                        <option value="hariraya">🌙 Hari Raya</option>
                        <option value="ultah">🎂 Hari Spesial</option>
                        <option value="harian">🏡 Kumpul Rumah</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-cute">{d.labelDate}</label>
                      <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-xs"/>
                    </div>
                  </div>
                  <div className="flex gap-2.5 pt-2">
                    <button type="button" onClick={() => setShowUpload(false)} className="btn-bouncy flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors font-cute">{d.btnCancel}</button>
                    <button type="submit" disabled={uploading} className="btn-bouncy flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all font-cute">{uploading ? 'Menyimpan...' : d.btnSave}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-xl border border-white/10 animate-bounce">
          <span className="text-xl">✨</span>
          <p className="text-xs font-bold font-cute">{toastMsg}</p>
        </div>
      )}

    </div>
  );
}
