/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OutboundRecord } from '../types/warehouse';
import { Printer, X, Download, ShieldCheck } from 'lucide-react';

interface PrintBastModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: OutboundRecord | null;
}

export const PrintBastModal: React.FC<PrintBastModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  const isGm = record.jenisTransaksi === 'GM';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-in">
        {/* Modal Controls (Hidden when printed) */}
        <div className="no-print px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Cetak / Ekspor PDF Berita Acara Serah Terima (BAST) Material
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-tactile px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang / Simpan PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:rotate-90 transition-all duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Printable Document Container */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 sm:bg-slate-100 dark:sm:bg-slate-900/60 text-slate-900 print:p-0 print:m-0 print:bg-white flex-1">
          <div className="max-w-2xl mx-auto bg-white text-slate-900 p-6 sm:p-8 rounded-xl sm:shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 font-sans text-xs">
            {/* PLN Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/assets/aistudio/Logo_PLN_67ac91e8.png" 
                  alt="Logo Resmi PLN" 
                  className="h-12 w-auto object-contain shrink-0"
                />
                <div>
                  <div className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                    PT PLN (PERSERO)
                  </div>
                  <div className="text-[11px] text-slate-700 font-semibold leading-tight mt-0.5">
                    UNIT PELAKSANA PELAYANAN PELANGGAN (UP3)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    GUDANG MATERIAL & LOGISTIK DISTRIBUSI TENAGA LISTRIK
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">NOMOR FORMULIR:</span>
                <span className="font-mono text-xs font-bold text-slate-800">
                  BAST-MAT/PLN/{record.id.replace('OUT-', '')}
                </span>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-3">
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900 underline">
                BERITA ACARA SERAH TERIMA (BAST) MATERIAL KWH METER
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                PENGELUARAN BARANG UNTUK PEKERJAAN {record.jenisTransaksi === 'PB' ? 'PASANG BARU (PB)' : 'GANTI METER (GM)'}
              </p>
            </div>

            {/* Section 1: Customer & Work Order Info */}
            <div className="my-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <table className="w-full text-[11px] text-slate-800">
                <tbody>
                  <tr>
                    <td className="w-32 py-1 font-semibold text-slate-600">Tanggal Pengeluaran</td>
                    <td className="w-4 py-1">:</td>
                    <td className="py-1 font-mono font-bold">{record.tanggal} WIB</td>
                    <td className="w-28 py-1 font-semibold text-slate-600">Jenis Transaksi</td>
                    <td className="w-4 py-1">:</td>
                    <td className="py-1 font-bold">
                      {record.jenisTransaksi === 'PB' ? 'Pasang Baru (PB)' : 'Ganti Meter (GM)'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-slate-600">ID Pelanggan (IDPEL)</td>
                    <td className="py-1">:</td>
                    <td className="py-1 font-mono font-bold text-blue-900">{record.idPelanggan}</td>
                    <td className="py-1 font-semibold text-slate-600">Nomor Agenda</td>
                    <td className="py-1">:</td>
                    <td className="py-1 font-mono">{record.nomorAgenda}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-slate-600">Nama Pelanggan</td>
                    <td className="py-1">:</td>
                    <td className="py-1 font-bold">{record.nama}</td>
                    <td className="py-1 font-semibold text-slate-600">Tarif / Daya</td>
                    <td className="py-1">:</td>
                    <td className="py-1 font-bold">{record.tarif} / {record.daya} VA</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Material Specifications Table */}
            <div className="my-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase block mb-1.5">
                A. Rincian Material Baru yang Diserahterimakan:
              </span>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-left font-bold">
                    <th className="border border-slate-300 p-2 text-center w-8">No</th>
                    <th className="border border-slate-300 p-2">Nama Material</th>
                    <th className="border border-slate-300 p-2">Nomor Seri (SN) / Spesifikasi</th>
                    <th className="border border-slate-300 p-2 text-center w-16">Vol</th>
                    <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="border border-slate-300 p-2 text-center">1</td>
                    <td className="border border-slate-300 p-2 font-medium">
                      kWh Meter Baru ({record.meterBrand || 'PLN Standar'} - {record.meterCategory || 'kWh Meter Prabayar'})
                    </td>
                    <td className="border border-slate-300 p-2 font-mono font-bold">
                      SN: {record.snKwhMeter} (No Meter: {record.noMeter})
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold">1</td>
                    <td className="border border-slate-300 p-2 text-center">Unit</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 text-center">2</td>
                    <td className="border border-slate-300 p-2 font-medium">MCB Pembatas Arus</td>
                    <td className="border border-slate-300 p-2 font-mono">{record.snMcb}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">1</td>
                    <td className="border border-slate-300 p-2 text-center">Pcs</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 text-center">3</td>
                    <td className="border border-slate-300 p-2 font-medium">Segel kWh Meter / Terminal</td>
                    <td className="border border-slate-300 p-2 font-mono">{record.segel}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">1</td>
                    <td className="border border-slate-300 p-2 text-center">Pcs</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 text-center">4</td>
                    <td className="border border-slate-300 p-2 font-medium">Kabel Sambungan Rumah (TW/TIC)</td>
                    <td className="border border-slate-300 p-2 font-mono">Panjang: {record.kabelTw} Meter</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">{record.kabelTw}</td>
                    <td className="border border-slate-300 p-2 text-center">Meter</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: If Ganti Meter (GM) Info */}
            {isGm && (
              <div className="my-3 bg-amber-50 p-3 rounded-lg border border-amber-300 text-slate-800">
                <span className="text-[11px] font-bold text-amber-900 uppercase block mb-1">
                  B. Data Pembongkaran kWh Meter Lama (Untuk Ganti Meter):
                </span>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr>
                      <td className="w-32 py-0.5 font-semibold text-slate-600">Kategori Ganti</td>
                      <td className="w-4 py-0.5">:</td>
                      <td className="py-0.5 font-bold text-amber-900">
                        {record.gmKategori === 'METER_GANGGUAN' ? 'Meter Gangguan (Kerusakan Fisik/Sistem)' : 'Meter Tua (Peremajaan / Kadaluarsa Tera)'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold text-slate-600">Nomor Meter Lama</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-mono font-bold text-rose-800">{record.noMeterLama || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold text-slate-600">Stand Meter Akhir</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-mono">{record.standMeterLama ? `${record.standMeterLama} kWh` : '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold text-slate-600">Keterangan / Alasan</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 italic">{record.gmKeterangan || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Signatures */}
            <div className="mt-8 pt-4 border-t border-slate-300">
              <p className="text-[11px] text-slate-600 mb-6 text-center">
                Material di atas telah diperiksa fisik dan diserahterimakan dalam kondisi baik dan lengkap.
              </p>

              <div className="grid grid-cols-2 gap-8 text-center text-[11px]">
                <div>
                  <div className="font-semibold text-slate-700">Pihak Pertama (Yang Menyerahkan)</div>
                  <div className="text-[10px] text-slate-500">Petugas Gudang Material PLN</div>
                  <div className="h-16 flex items-end justify-center">
                    <span className="border-b border-slate-900 w-36 inline-block font-bold">
                      Ahmad Supriyadi
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">NIP: 891230192</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">Pihak Kedua (Yang Menerima)</div>
                  <div className="text-[10px] text-slate-500">Petugas / Teknisi Yanbung</div>
                  <div className="h-16 flex items-end justify-center">
                    <span className="border-b border-slate-900 w-36 inline-block font-bold">
                      {record.petugas}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">Pelaksana Pekerjaan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
