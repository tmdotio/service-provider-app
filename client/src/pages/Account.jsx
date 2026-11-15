import { Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import api, { getErrorMessage } from "../api/axios";
import { Avatar, PageHeader } from "../components/ui";
import useAuth from "../hooks/useAuth";
import { updateUser } from "../store/authSlice";
import { checkImageFile } from "../utils/format";

export default function Account() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { name: form.name.trim() };
      if (form.phone.trim()) data.phone = form.phone.trim();
      const res = await api.patch("/auth/update-profile", data);
      dispatch(updateUser({ name: res.data.user.name, phone: res.data.user.phone }));
      toast.success("Profile saved");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = checkImageFile(file);
    if (problem) return toast.error(problem);

    const form = new FormData();
    form.append("image", file);
    setUploading(true);
    try {
      const res = await api.patch("/upload/avatar", form);
      dispatch(updateUser({ avatar: res.data.image.url }));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageHeader title="My account" subtitle={`${user.email} · ${user.role}`} />

      <div className="card p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={user} size="h-20 w-20" />
          <label className="btn-outline cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Change photo
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} disabled={uploading} />
          </label>
          <span className="text-xs text-gray-500">Max 1 MB</span>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" required minLength={2} maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" className="input" pattern="\+?[0-9]{10,15}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={saving}>Save changes</button>
        </form>
      </div>
    </div>
  );
}
