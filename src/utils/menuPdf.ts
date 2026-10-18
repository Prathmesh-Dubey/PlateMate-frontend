// src/utils/menuPdf.ts
// Builds the weekly-menu PDF from the on-screen #printable-menu table.
// window.print() does nothing inside the Android WebView (the Capacitor app), so there the
// table is rendered to a real PDF file and handed to the system share sheet (Save / WhatsApp / Drive...).
// On the web, the browser's own print dialog is still used.
import { isNativeApp } from '../config/appDownload';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 8;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const renderMenuPdf = async (): Promise<Blob> => {
  const el = document.getElementById('printable-menu');
  if (!el) throw new Error('Menu table not found');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    // Lay the table out at desktop width even on a phone, and un-hide it in the cloned copy
    windowWidth: 1200,
    onclone: (doc) => {
      const clone = doc.getElementById('printable-menu');
      if (!clone) return;
      let node: HTMLElement | null = clone.parentElement;
      while (node && node !== doc.body) {
        node.classList.remove('hidden');
        node.style.display = 'block';
        node.style.padding = '0';
        node.style.background = '#fff';
        node = node.parentElement;
      }
      clone.style.width = '1100px';
      clone.style.maxWidth = '1100px';
    },
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = PAGE_W_MM - MARGIN_MM * 2;
  const usableH = PAGE_H_MM - MARGIN_MM * 2;
  let w = usableW;
  let h = (canvas.height * w) / canvas.width;
  if (h > usableH) {
    h = usableH;
    w = (canvas.width * h) / canvas.height;
  }
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN_MM, MARGIN_MM, w, h);
  return pdf.output('blob');
};

/** Prints / saves the weekly menu. `fileName` should not include the extension. */
export const exportWeeklyMenu = async (fileName: string): Promise<void> => {
  if (!isNativeApp()) {
    window.print();
    return;
  }

  const blob = await renderMenuPdf();
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const path = `${fileName}.pdf`;
  const written = await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({
    title: 'Weekly Menu',
    dialogTitle: 'Save or share weekly menu',
    url: written.uri,
  });
};
