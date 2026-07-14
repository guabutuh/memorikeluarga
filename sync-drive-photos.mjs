/**
 * sync-drive-photos.mjs
 * 
 * Script untuk update daftar foto dari Google Drive ke photos.json
 * Jalankan sekali saat ada foto baru: node sync-drive-photos.mjs
 * 
 * Cara pakai:
 * 1. Isi GOOGLE_API_KEY di bawah (buat di console.cloud.google.com, gratis)
 * 2. Jalankan: node sync-drive-photos.mjs
 * 3. Push ke git: git add public/photos.json && git commit -m "update foto" && git push
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ============================================================
// KONFIGURASI - Isi ini sesuai punya kamu
// ============================================================
const FOLDER_ID = '1rvEOVGK93P2eYwnOO2FFB-_fpndCTqVo';
const GOOGLE_API_KEY = 'ISI_API_KEY_KAMU_DI_SINI'; // Buat di: console.cloud.google.com
// ============================================================

async function fetchFilesFromFolder(folderId, apiKey, albumName = 'LEBARAN') {
  const photos = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,createdTime)',
      pageSize: '100',
      orderBy: 'createdTime desc',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Drive API error: ${data.error?.message || res.status}`);
    }

    for (const file of (data.files || [])) {
      photos.push({
        id: file.id,
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        albumName,
        createdTime: file.createdTime
          ? new Date(file.createdTime).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—',
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Fetch subfolders
  const subParams = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: '50',
    key: apiKey,
  });
  const subRes = await fetch(`https://www.googleapis.com/drive/v3/files?${subParams}`);
  const subData = await subRes.json();
  for (const sub of (subData.files || [])) {
    const subPhotos = await fetchFilesFromFolder(sub.id, apiKey, sub.name);
    photos.push(...subPhotos);
  }

  return photos;
}

async function main() {
  if (GOOGLE_API_KEY === 'ISI_API_KEY_KAMU_DI_SINI') {
    console.error('❌ Isi GOOGLE_API_KEY dulu di dalam file sync-drive-photos.mjs!');
    console.log('\nCara buat API Key (gratis, 2 menit):');
    console.log('1. Buka https://console.cloud.google.com/apis/credentials');
    console.log('2. Klik "Create Credentials" → "API Key"');
    console.log('3. Copy key-nya, tempel di script ini');
    console.log('4. Jalankan lagi: node sync-drive-photos.mjs');
    process.exit(1);
  }

  console.log('📂 Mengambil daftar foto dari Google Drive...');
  const photos = await fetchFilesFromFolder(FOLDER_ID, GOOGLE_API_KEY, 'LEBARAN');
  console.log(`✅ Ditemukan ${photos.length} foto`);

  const output = {
    updatedAt: new Date().toISOString(),
    totalPhotos: photos.length,
    photos,
  };

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, 'public', 'photos.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`💾 Disimpan ke public/photos.json`);
  console.log('\n🚀 Sekarang push ke git:');
  console.log('   git add public/photos.json && git commit -m "update foto" && git push');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
