// backup.js
// Backup modal, export and import of JSON data.

function openBackupModal() { document.getElementById('backup-modal').classList.remove('hidden'); }
function closeBackupModal() { document.getElementById('backup-modal').classList.add('hidden'); }

function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function exportDataJSON() {
  const json = JSON.stringify({ medicines, salesHistory, userProfile });
  const fileName = `medstore_backup_${Date.now()}.json`;

  if (isNativeApp()) {
    exportDataNative(fileName, json);
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(json);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Export downloaded!');
}

// Inside the APK a download link does nothing, so the backup is written to the
// app cache and opened in the Android share sheet (save to Files, Drive, WhatsApp...).
async function exportDataNative(fileName, json) {
  const { Filesystem, Share } = window.Capacitor.Plugins;
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: 'CACHE',
      encoding: 'utf8'
    });
    await Share.share({ title: 'MedStoreMgr backup', files: [result.uri] });
    showToast('Export ready!');
  } catch (err) {
    // Closing the share sheet without picking an app is not an error
    if (/cancel/i.test(String(err && err.message))) return;
    showToast('Export failed!');
  }
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        if (data.medicines) medicines = data.medicines;
        if (data.salesHistory) salesHistory = data.salesHistory;
        if (data.userProfile) userProfile = data.userProfile;
        removeDuplicateMedicines(true);
        saveToLocalStorage();
        renderCategoryPills();
        renderMedicineList();
        closeBackupModal();
        showToast('Backup restored successfully!');
      } catch (err) {
        showToast('Invalid backup file!');
      }
    };
    reader.readAsText(file);
  }
}
