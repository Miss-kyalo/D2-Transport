import { useEffect, useState } from 'react';
import api from '../api';

const NEXT_STATUSES = {
  INTAKE: ['DIAGNOSING', 'AWAITING_APPROVAL', 'CLOSED'],
  DIAGNOSING: ['AWAITING_APPROVAL', 'IN_REPAIR', 'CLOSED'],
  AWAITING_APPROVAL: ['IN_REPAIR', 'CLOSED'],
  IN_REPAIR: ['READY', 'CLOSED'],
  READY: ['INVOICED', 'IN_REPAIR'],
  INVOICED: ['CLOSED'],
  CLOSED: [],
};

export default function JobCardStorePanel({
  jobStatus,
  onReserve,
  onIssue,
  onReturnCore,
  onUpdateStatus,
}) {
  const [itemId, setItemId] = useState('');
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState('');
  const [qty, setQty] = useState('1');
  const [batchPhotoUrl, setBatchPhotoUrl] = useState('');
  const availableStatuses = NEXT_STATUSES[jobStatus] || [];
  const [selectedStatus, setSelectedStatus] = useState('');
  const nextStatus = availableStatuses.includes(selectedStatus)
    ? selectedStatus
    : availableStatuses[0] || '';

  const numericItemId = Number(itemId);
  const numericQty = Number(qty);
  const canIssue = ['Admin', 'Storekeeper'].includes(localStorage.getItem('role'));

  useEffect(() => {
    let active = true;
    api.get('/garage/inventory')
      .then((response) => { if (active) setInventory(response.data); })
      .catch((error) => { if (active) setInventoryError(error.response?.data?.error || 'Failed to load inventory.'); });
    return () => { active = false; };
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-100 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Parts and job status</h2>
        <p className="mt-1 text-xs text-slate-400">
          Current status: {jobStatus || 'Job card not loaded'}
        </p>
        {inventoryError && <p role="alert" className="mt-1 text-xs text-red-300">{inventoryError}</p>}
        {!canIssue && <p className="mt-1 text-xs text-slate-400">Legacy stock reservations and issues require a storekeeper or Admin.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs space-y-1">
          <span className="text-slate-400">Inventory Item ID and Name</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm text-white border border-slate-700"
          >
            <option value="">Select a part</option>
            {inventory.map((item) => <option key={item.id} value={item.id}>#{item.id} — {item.part_name} ({item.sku})</option>)}
          </select>
        </label>

        <label className="text-xs space-y-1">
          <span className="text-slate-400">Quantity</span>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm text-white border border-slate-700"
          />
        </label>

      </div>

      <label className="block text-xs space-y-1">
        <span className="text-slate-400">Batch Photo URL (Optional)</span>
        <input
          type="text"
          value={batchPhotoUrl}
          onChange={(e) => setBatchPhotoUrl(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm text-white border border-slate-700"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canIssue || !itemId}
          onClick={() => onReserve({ item_id: numericItemId, qty: numericQty })}
          className="rounded bg-amber-600 hover:bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Reserve Stock
        </button>
        <button
          type="button"
          disabled={!canIssue || !itemId}
          onClick={() =>
            onIssue({
              item_id: numericItemId,
              qty: numericQty,
              batch_photo_url: batchPhotoUrl || null,
            })
          }
          className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Issue Part
        </button>
        <button
          type="button"
          disabled={!itemId}
          onClick={() => onReturnCore({ item_id: numericItemId, qty: numericQty })}
          className="rounded bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs font-semibold text-white"
        >
          Log Core Return
        </button>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
        <select
          value={nextStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={availableStatuses.length === 0}
          className="rounded bg-slate-800 px-3 py-2 text-xs text-white border border-slate-700"
        >
          {availableStatuses.map((status) => (
            <option value={status} key={status}>{status}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onUpdateStatus(nextStatus)}
          disabled={!nextStatus}
          className="rounded bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Transition Job Status
        </button>
      </div>
    </div>
  );
}