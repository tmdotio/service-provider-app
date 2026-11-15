import { useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import { Modal, Stars } from "./ui";

/** Modal asking for a reason (cancel / reject / no-show). */
export function ReasonModal({ open, title, label, confirmText, required = true, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onConfirm(reason.trim());
    setSaving(false);
    setReason("");
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="reason">{label}</label>
          <textarea
            id="reason"
            autoFocus
            className="input min-h-20"
            required={required}
            minLength={required ? 3 : 0}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Back</button>
          <button className="btn-danger" disabled={saving}>{confirmText}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Star rating + comment for a finished booking. */
export function ReviewModal({ booking, open, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/booking/${booking._id}/review`, { rating, comment: comment.trim() });
      toast.success("Thanks for your review!");
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Review ${booking.provider?.businessName}`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="label">Your rating</p>
          <Stars value={rating} onChange={setRating} size="h-8 w-8" />
        </div>
        <div>
          <label className="label" htmlFor="comment">Comment (optional)</label>
          <textarea
            id="comment"
            className="input min-h-24"
            maxLength={1000}
            placeholder="Was the work good? Did they come on time?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>Submit review</button>
        </div>
      </form>
    </Modal>
  );
}
