/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Phone, Plus, X, Trash2, BookUser, Pencil } from 'lucide-react';
import { Card, Button } from '../components/UIComponents';
import { Vendor } from '../types';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useIsReadOnly } from '../contexts/AccessContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { validatePhone } from '../lib/validation';
import { useEscapeKey } from '../lib/useEscapeKey';

export default function VendorSOS() {
  const isReadOnly = useIsReadOnly();
  const [contacts, setContacts] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState<Vendor | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 5000);
    const unsub = onSnapshot(collection(db, 'vendors'), (snap) => {
      clearTimeout(fallback);
      setContacts(snap.docs.map(d => d.data() as Vendor));
      setLoading(false);
    }, (error) => {
      clearTimeout(fallback);
      handleFirestoreError(error, OperationType.LIST, 'vendors');
      setLoading(false);
    });
    return () => { clearTimeout(fallback); unsub(); };
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = fd.get('phone') as string;
    const pErr = validatePhone(phone) ?? (phone.trim() ? null : 'Phone number is required');
    if (pErr) { setPhoneError(pErr); return; }
    setPhoneError(null);
    const id = editingContact?.id ?? `C${Date.now()}`;
    const entry: Vendor = {
      id,
      name: fd.get('name') as string,
      role: fd.get('role') as string,
      phone: phone.trim(),
      notes: (fd.get('notes') as string) || undefined,
    };
    if (!entry.notes) delete entry.notes;
    try {
      await setDoc(doc(db, 'vendors', id), entry);
      setEditingContact(null);
      setIsAdding(false);
      setPhoneError(null);
    } catch (error) {
      handleFirestoreError(error, editingContact ? OperationType.UPDATE : OperationType.CREATE, `vendors/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'vendors', id));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vendors/${id}`);
    }
  };

  const closeModal = () => { setIsAdding(false); setEditingContact(null); setPhoneError(null); };
  useEscapeKey(() => { if (isAdding || editingContact) closeModal(); });

  const filtered = contacts.filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.role.toLowerCase().includes(s);
  });

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const modalOpen = isAdding || !!editingContact;
  const prefill = editingContact;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Wedding Team</p>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-primary">Contacts</h2>
        <p className="text-sm text-on-surface-variant mt-1">Who's responsible for what — tap a number to call.</p>
      </div>

      {/* Search + Add */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name or role..."
            className="w-full pl-10 pr-10 py-3 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:border-secondary transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface">
              <X size={15} />
            </button>
          )}
        </div>
        {!isReadOnly && (
          <Button variant="primary" onClick={() => setIsAdding(true)} className="shrink-0">
            <Plus size={18} />
            <span className="hidden sm:inline">Add Contact</span>
          </Button>
        )}
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2 border-outline-variant/40">
          <BookUser size={40} className="mx-auto text-outline-variant mb-3" />
          <p className="font-bold text-primary">
            {contacts.length === 0 ? 'No contacts yet' : 'No results'}
          </p>
          <p className="text-sm text-on-surface-variant mt-1">
            {contacts.length === 0
              ? 'Add the people responsible for each job at the wedding.'
              : 'Try a different name or role.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(contact => (
            <div
              key={contact.id}
              className="bg-white border border-outline-variant rounded-2xl px-5 py-4 flex items-center gap-4 group shadow-sm"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                {initials(contact.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-primary text-sm">{contact.name}</p>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest truncate">{contact.role}</p>
                {contact.notes && (
                  <p className="text-[10px] text-outline mt-0.5 truncate">{contact.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {confirmDeleteId === contact.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-600">Delete?</span>
                    <button onClick={() => handleDelete(contact.id)}
                      className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors">
                      Yes
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 border border-outline-variant text-[10px] font-bold rounded-lg hover:bg-surface-container transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                    >
                      <Phone size={14} />
                      <span className="hidden sm:inline">{contact.phone}</span>
                      <span className="sm:hidden">Call</span>
                    </a>
                    {!isReadOnly && (
                      <>
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-outline hover:text-primary transition-all rounded-lg"
                          title="Edit contact"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(contact.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-outline hover:text-red-500 transition-all rounded-lg"
                          title="Delete contact"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in" onClick={closeModal} />
          <Card className="relative w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 rounded-t-3xl sm:rounded-2xl" padded={false}>
            <form onSubmit={handleSave}>
              <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-base font-bold text-primary uppercase tracking-widest">
                  {prefill ? 'Edit Contact' : 'Add Contact'}
                </h3>
                <button type="button" onClick={closeModal} className="p-2 hover:bg-surface-container rounded-full text-outline">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Name *</label>
                  <input name="name" required autoFocus defaultValue={prefill?.name ?? ''}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="e.g. Ramesh Sharma" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Responsible For *</label>
                  <input name="role" required defaultValue={prefill?.role ?? ''}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="e.g. Décor, Catering, Sound & AV, Transport" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Phone *</label>
                  <input name="phone" required type="tel" defaultValue={prefill?.phone ?? ''}
                    onChange={() => setPhoneError(null)}
                    className={`w-full p-3 border rounded-xl bg-surface-container-low text-sm focus:bg-white transition-all outline-none ${phoneError ? 'border-red-400 focus:border-red-400' : 'border-outline-variant focus:border-secondary'}`}
                    placeholder="+91 XXXXX XXXXX" />
                  {phoneError && <p className="text-[10px] font-bold text-red-600">{phoneError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Notes (optional)</label>
                  <input name="notes" defaultValue={prefill?.notes ?? ''}
                    className="w-full p-3 border border-outline-variant rounded-xl bg-surface-container-low text-sm focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="e.g. Available after 6pm, WhatsApp only" />
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
                <Button type="submit" variant="primary">
                  {prefill ? 'Save Changes' : 'Save Contact'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
