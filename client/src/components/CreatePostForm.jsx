import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import { checkImageFile, MAX_IMAGE_MB } from "../utils/format";

const MAX_IMAGES = 4;

/**
 * Create a post with 1-4 images (each under 1 MB) about a provider.
 * Images are checked here first so the user gets instant feedback;
 * the server checks them again.
 */
export default function CreatePostForm({ providerId, placeholder, onCreated }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  // One preview URL per file; freed when the files change
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";

    const valid = [];
    for (const file of picked) {
      const problem = checkImageFile(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }

    const next = [...files, ...valid];
    if (next.length > MAX_IMAGES) {
      toast.error(`You can add up to ${MAX_IMAGES} images`);
    }
    setFiles(next.slice(0, MAX_IMAGES));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return toast.error("Please add at least one image");
    if (text.trim().length < 3) return toast.error("Please write a few words");

    const form = new FormData();
    form.append("providerId", providerId);
    form.append("text", text.trim());
    files.forEach((file) => form.append("images", file));

    setSaving(true);
    try {
      const res = await api.post("/posts", form);
      toast.success("Post shared");
      setText("");
      setFiles([]);
      onCreated?.(res.data.post);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <textarea
        className="input min-h-24 resize-y"
        placeholder={placeholder}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
      />

      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((p, i) => (
            <div key={p.url} className="relative aspect-square">
              <img src={p.url} alt="" className="h-full w-full rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className={`btn-outline cursor-pointer ${files.length >= MAX_IMAGES ? "pointer-events-none opacity-50" : ""}`}>
          <ImagePlus className="h-4 w-4" />
          Add photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={addFiles}
          />
        </label>
        <span className="hidden text-xs text-muted sm:block">
          {files.length}/{MAX_IMAGES} · max {MAX_IMAGE_MB} MB each
        </span>
        <button className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Post
        </button>
      </div>
    </form>
  );
}
