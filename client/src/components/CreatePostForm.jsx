import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import { checkImageFile, MAX_POST_IMAGE_MB } from "../utils/format";

const MAX_PHOTOS = 4;

/** Optional work and promotional photos. */
function Photos({ title, hint, files, setFiles, disabled }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const valid = [];
    for (const file of picked) {
      const problem = checkImageFile(file, MAX_POST_IMAGE_MB);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    const next = [...files, ...valid];
    if (next.length > MAX_PHOTOS) toast.error(`Up to ${MAX_PHOTOS} photos for "${title}"`);
    setFiles(next.slice(0, MAX_PHOTOS));
  };

  return (
    <div className="rounded-[22px] border border-dashed border-line p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {previews.map((p, i) => (
          <div key={p.url} className="relative aspect-square">
            <img src={p.url} alt="" className="h-full w-full rounded-2xl object-cover" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label={`Remove ${title} photo`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-surface-2 text-muted transition hover:text-accent">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs font-medium">Add photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-label="Add photos" className="hidden" onChange={add} />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Provider shares work, service updates and promotions with optional photos.
 * Only providers see this form; customers take part through comments.
 */
export default function CreatePostForm({ placeholder, onCreated }) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (text.trim().length < 3) return toast.error("Please write a few words about the job");

    const form = new FormData();
    form.append("text", text.trim());
    photos.forEach((file) => form.append("images", file));

    setSaving(true);
    try {
      const res = await api.post("/posts", form);
      toast.success("Your work is posted!");
      setText("");
      setPhotos([]);
      onCreated?.(res.data.post);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
      <div>
        <p className="font-semibold">Post your work</p>
        <p className="text-sm text-muted">Share your work, services, offers or promotions. Photos are optional—no before/after needed.</p>
      </div>

      <Photos title="Photos (optional)" hint={`Up to 4 · ${MAX_POST_IMAGE_MB} MB each`} files={photos} setFiles={setPhotos} disabled={saving} />

      <textarea
        className="input min-h-24 resize-y"
        placeholder={placeholder || "Share recent work, your services or a special offer..."}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        aria-label="Post text"
        required
        minLength={3}
        disabled={saving}
      />

      <button className="btn-primary h-12 w-full sm:w-auto sm:px-8" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Post work
      </button>
    </form>
  );
}
